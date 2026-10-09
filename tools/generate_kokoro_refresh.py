"""Re-render packaged clips with a local Kokoro Japanese voice at natural speed.

Uses the curated phonemes already in the three audio manifests and writes to a
checkpointed staging directory; publishing is a separate verified step.
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from kokoro_onnx import Kokoro
from generate_audio import write_mp3


ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ("manifest.json", "phrase-manifest.json", "course-manifest.json")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--voice", required=True, type=Path)
    parser.add_argument("--stage", required=True, type=Path)
    parser.add_argument("--files", nargs="*")
    parser.add_argument("--only-special", action="store_true", help="Render the 19 original word examples")
    parser.add_argument("--words-only", action="store_true", help="Render word examples and course vocabulary")
    args = parser.parse_args()
    args.stage.mkdir(parents=True, exist_ok=True)
    checkpoint_path = args.stage / "checkpoint.json"
    checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8")) if checkpoint_path.exists() else {}
    voice_hash = hashlib.sha256(args.voice.read_bytes()).hexdigest()
    entries = [(name, entry) for name in MANIFESTS for entry in json.loads((ROOT / "audio" / name).read_text(encoding="utf-8"))]
    if args.only_special:
        entries = [(name, entry) for name, entry in entries if name == "manifest.json" and entry["file"].startswith("special-")]
    if args.words_only:
        entries = [(name, entry) for name, entry in entries if
                   (name == "manifest.json" and entry["file"].startswith("special-")) or
                   (name == "course-manifest.json" and re.search(r"-v\d+\.mp3$|-q[48]\.mp3$", entry["file"]))]
    if args.files:
        selected = set(args.files)
        entries = [(name, entry) for name, entry in entries if entry["file"] in selected]
        if len(entries) != len(selected):
            parser.error("some --files names were not found")
    model = Kokoro(str(args.model), str(args.voice))
    for index, (manifest_name, entry) in enumerate(entries, 1):
        filename = entry["file"]
        phonemes = entry.get("phonemes") or model.phonemize(entry["kana"])
        signature = hashlib.sha256((phonemes + "\n" + voice_hash + "\n1.0").encode()).hexdigest()
        target = args.stage / filename
        old = checkpoint.get(filename)
        if old and old.get("signature") == signature and target.exists() and old.get("sha256") == hashlib.sha256(target.read_bytes()).hexdigest():
            print(f"{index}/{len(entries)} keep {filename}", flush=True)
            continue
        if not model._tokenize(phonemes):
            raise ValueError(f"invalid phonemes: {filename} {phonemes}")
        original = model.phonemize
        model.phonemize = lambda _text: phonemes
        try:
            samples, sample_rate = model.create(entry["kana"], speed=1.0)
        finally:
            model.phonemize = original
        seconds = round(write_mp3(samples, sample_rate, target), 3)
        checkpoint[filename] = {
            "manifest": manifest_name, "file": filename, "kana": entry["kana"],
            "phonemes": phonemes,
            "signature": signature, "seconds": seconds,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        }
        checkpoint_path.write_text(json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{index}/{len(entries)} {filename} {entry['kana']} {seconds:.2f}s", flush=True)


if __name__ == "__main__":
    main()
