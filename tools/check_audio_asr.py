"""Spot-check rendered Japanese clips with a separate local Whisper recognizer."""

import argparse
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", required=True, type=Path)
    parser.add_argument("--audio-root", type=Path, help="Read clips from this directory while using staging metadata")
    parser.add_argument("--model", type=Path, help="Local CTranslate2 Whisper model directory")
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()
    checkpoint = json.loads((args.stage / "checkpoint.json").read_text(encoding="utf-8"))
    model_path = args.model or args.stage / "asr-model-manual"
    model = WhisperModel(str(model_path), device="cpu", compute_type="int8")
    for filename in args.files:
        clip = (args.audio_root or args.stage) / filename
        segments, _ = model.transcribe(str(clip), language="ja", beam_size=5, vad_filter=False)
        print(json.dumps({
            "file": filename, "expected": checkpoint[filename]["kana"],
            "recognized": "".join(segment.text for segment in segments).strip(),
            "seconds": checkpoint[filename]["seconds"],
        }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
