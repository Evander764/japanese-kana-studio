"""Rebuild every packaged Japanese clip with the local Qwen3-TTS VoiceDesign model.

Render to a staging directory first. Each completed clip is checkpointed so a
long run can resume safely. The browser still only needs the final MP3 files.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
import torch
from qwen_tts import Qwen3TTSModel


ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ("manifest.json", "phrase-manifest.json", "course-manifest.json")
VOICE_INSTRUCTION = (
    "A native Japanese female teacher in her thirties. Speak in clear standard "
    "Japanese with natural Tokyo intonation and a calm, friendly, neutral voice. "
    "Use an ordinary conversational pace. No acting, no music, no extra words."
)
CUSTOM_INSTRUCTION = ""


def source_entries():
    for manifest_name in MANIFESTS:
        entries = json.loads((ROOT / "audio" / manifest_name).read_text(encoding="utf-8"))
        for entry in entries:
            yield manifest_name, entry


def encode_mp3(samples, sample_rate, target):
    samples = np.asarray(samples, dtype=np.float32).reshape(-1)
    duration = len(samples) / sample_rate
    if duration < 0.2 or duration > 30 or not np.isfinite(samples).all():
        raise ValueError(f"invalid synthesis duration/data: {target.name}: {duration:.2f}s")
    if np.sqrt(np.mean(samples ** 2)) < 0.002:
        raise ValueError(f"silent synthesis: {target.name}")
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        wav_path = Path(temporary) / "clip.wav"
        with wave.open(str(wav_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm.tobytes())
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
            "-af", "loudnorm=I=-18:TP=-2:LRA=7",
            "-codec:a", "libmp3lame", "-q:a", "4", str(target),
        ], check=True)
    return round(duration, 3)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--stage", required=True, type=Path)
    parser.add_argument("--files", nargs="*", help="Render only named MP3 files for audition")
    parser.add_argument("--text-override", help="Audition alternate spoken input for one named file")
    parser.add_argument("--instruct-override", help="Audition alternate voice instruction")
    parser.add_argument("--seed", type=int, default=20261008, help="Change to regenerate a flagged clip")
    parser.add_argument("--overrides", type=Path, help="JSON map of filename to alternate text and seed")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--sentences-only", action="store_true", help="Render course sentences and mixed phrases only")
    parser.add_argument("--words-only", action="store_true", help="Render word examples and course vocabulary")
    parser.add_argument("--kana-only", action="store_true", help="Render basic, voiced and contracted kana only")
    parser.add_argument("--custom-speaker", help="Use a CustomVoice model with this speaker, e.g. Ono_Anna")
    args = parser.parse_args()
    if not args.model.is_dir():
        parser.error("local model directory does not exist")
    args.stage.mkdir(parents=True, exist_ok=True)
    overrides = json.loads(args.overrides.read_text(encoding="utf-8")) if args.overrides else {}
    checkpoint_path = args.stage / "checkpoint.json"
    checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8")) if checkpoint_path.exists() else {}
    entries = list(source_entries())
    if args.sentences_only:
        entries = [(name, entry) for name, entry in entries if name == "phrase-manifest.json" or
                   (name == "course-manifest.json" and
                    ("-example" in entry["file"] or re.search(r"-q[123567]\.mp3$|-listen\.mp3$", entry["file"]))) ]
    if args.words_only:
        entries = [(name, entry) for name, entry in entries if
                   (name == "manifest.json" and entry["file"].startswith("special-")) or
                   (name == "course-manifest.json" and re.search(r"-v\d+\.mp3$|-q[48]\.mp3$", entry["file"]))]
    if args.kana_only:
        entries = [(name, entry) for name, entry in entries if name == "manifest.json" and not entry["file"].startswith("special-")]
    if args.files:
        filenames = set(args.files)
        entries = [(name, entry) for name, entry in entries if entry["file"] in filenames]
        if len(entries) != len(filenames):
            parser.error("some --files names were not found in the audio manifests")
    if args.text_override and len(entries) != 1:
        parser.error("--text-override needs exactly one selected file")
    if args.limit:
        entries = entries[:args.limit]
    model = Qwen3TTSModel.from_pretrained(
        str(args.model), device_map="cuda:0", dtype=torch.bfloat16,
        attn_implementation="sdpa", local_files_only=True,
    )
    for index, (manifest_name, entry) in enumerate(entries, 1):
        filename = entry["file"]
        override = overrides.get(filename, {})
        text = args.text_override or override.get("text") or entry["kana"]
        instruction = args.instruct_override if args.instruct_override is not None else (CUSTOM_INSTRUCTION if args.custom_speaker else VOICE_INSTRUCTION)
        seed = override.get("seed", args.seed)
        target = args.stage / filename
        signature_input = text + "\n" + instruction + (f"\n{seed}" if seed != 20261008 else "")
        if args.custom_speaker:
            signature_input += "\ncustom:" + args.custom_speaker
        signature = hashlib.sha256(signature_input.encode("utf-8")).hexdigest()
        old = checkpoint.get(filename)
        if old and old.get("signature") == signature and target.exists() and old.get("sha256") == hashlib.sha256(target.read_bytes()).hexdigest():
            print(f"{index}/{len(entries)} keep {filename}", flush=True)
            continue
        duplicate = next((other for other_name, other in checkpoint.items() if other_name != filename and
                          other.get("signature") == signature and other.get("kana") == entry["kana"] and
                          (args.stage / other_name).exists() and
                          hashlib.sha256((args.stage / other_name).read_bytes()).hexdigest() == other.get("sha256")), None)
        if duplicate:
            source = args.stage / duplicate["file"]
            shutil.copyfile(source, target)
            duration = duplicate["seconds"]
        else:
            torch.manual_seed(seed)
            if args.custom_speaker:
                wavs, sample_rate = model.generate_custom_voice(
                    text=text, language="Japanese", speaker=args.custom_speaker, instruct=instruction,
                )
            else:
                wavs, sample_rate = model.generate_voice_design(
                    text=text, language="Japanese", instruct=instruction,
                )
            duration = encode_mp3(wavs[0], sample_rate, target)
        checkpoint[filename] = {
            "manifest": manifest_name, "file": filename, "kana": entry["kana"], "synthesis_text": text,
            "seed": seed,
            "engine": "qwen3-tts-custom-voice" if args.custom_speaker else "qwen3-tts-voice-design",
            "voice": args.custom_speaker or "Japanese tutor prompt v1",
            "signature": signature, "seconds": duration,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        }
        checkpoint_path.write_text(json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{index}/{len(entries)} {filename} {text} {duration:.2f}s", flush=True)


if __name__ == "__main__":
    main()
