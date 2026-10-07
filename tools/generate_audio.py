"""Build offline MP3 pronunciation clips from the KanaData item list.

This is an optional authoring tool. The published webpage only needs audio/*.mp3.
Requires kokoro-onnx-ja, the Kokoro int8 ONNX model, jf_alpha.bin, Node, and ffmpeg.
"""

import argparse
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parents[1]
YOON_PREFIX = {
    "ky": "kʲ", "sh": "ɕ", "ch": "ʨ", "ny": "ɲ", "hy": "ç",
    "my": "mʲ", "ry": "ɾʲ", "gy": "ɡʲ", "j": "ʥ", "dy": "ʥ",
    "by": "bʲ", "py": "pʲ",
}


def items_for_audio(only_words: bool, only_mixed_examples: bool):
    script = "const d=require(process.argv[1]);process.stdout.write(JSON.stringify({items:d.items,mixedExamples:d.mixedExamples||[]}))"
    data = json.loads(subprocess.check_output(
        ["node", "-e", script, str(ROOT / "kana-data.js")], text=True, encoding="utf-8"
    ))
    if only_mixed_examples:
        return data["mixedExamples"]
    all_items = data["items"]
    result = []
    for item in all_items:
        if item["script"] == "katakana" and item["kind"] != "word":
            continue  # Its hiragana pair has the same reading and shares the clip.
        if only_words and item["kind"] != "word":
            continue
        result.append(item)
    return result


def write_mp3(samples, sample_rate: int, target: Path):
    samples = np.asarray(samples).reshape(-1)
    if len(samples) < sample_rate // 5 or np.sqrt(np.mean(samples ** 2)) < 0.001:
        raise ValueError(f"empty or silent synthesis for {target.name}")
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
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
            "-codec:a", "libmp3lame", "-q:a", "4", str(target)
        ], check=True)
    return len(samples) / sample_rate


def pronunciation(item, model):
    if item["key"] == "phrase-suupaa-kau":
        # Kana-only input can be guessed as こう by the phrase phonemizer.
        return "sɨːpaː de kaɯ"
    # Isolated は and へ are often parsed as particles (wa/e). In a kana chart
    # they must be pronounced ha/he. Some isolated yoon are parsed as two morae.
    if item["group"] == "base" and item["key"] in {"ha", "he"}:
        return item["key"]
    if item["group"] == "yoon":
        return YOON_PREFIX[item["key"][:-1]] + {"a": "a", "u": "ɨ", "o": "o"}[item["key"][-1]]
    return model.phonemize(item["kana"])


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--voice", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--only-words", action="store_true")
    selection.add_argument("--only-mixed-examples", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    model = Kokoro(str(args.model), str(args.voice))
    entries = items_for_audio(args.only_words, args.only_mixed_examples)
    if args.limit:
        entries = entries[:args.limit]
    manifest = []
    for index, item in enumerate(entries, 1):
        filename = f'{item["group"]}-{item["key"]}.mp3'
        target = args.output / filename
        phonemes = pronunciation(item, model)
        if not model._tokenize(phonemes):
            raise ValueError(f'no phonemes for {item["kana"]}')
        natural_phonemizer = model.phonemize
        model.phonemize = lambda _text: phonemes
        samples, sample_rate = model.create(item["kana"], speed=0.9)
        model.phonemize = natural_phonemizer
        duration = write_mp3(samples, sample_rate, target)
        manifest.append({"id": item["id"], "kana": item["kana"],
                         "phonemes": phonemes, "file": filename,
                         "seconds": round(duration, 3)})
        print(f'{index}/{len(entries)} {item["kana"]} {phonemes} {duration:.2f}s', flush=True)
    manifest_name = "phrase-manifest.json" if args.only_mixed_examples else "manifest.json"
    (args.output / manifest_name).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
