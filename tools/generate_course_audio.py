"""Render the original beginner course examples and listening prompts as offline MP3s.

Authoring only: the published site uses the generated audio/course-*.mp3 files.
Requires the same Kokoro Japanese ONNX assets and FFmpeg as generate_audio.py.
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from kokoro_onnx import Kokoro
from generate_audio import write_mp3


ROOT = Path(__file__).resolve().parents[1]


def entries():
    script = "process.stdout.write(JSON.stringify(require(process.argv[1]).lessons))"
    lessons = json.loads(subprocess.check_output(
        ["node", "-e", script, str(ROOT / "course-data.js")],
        text=True, encoding="utf-8"
    ))
    for lesson in lessons:
        yield f'course-{lesson["id"]}-example.mp3', lesson["example"]["kana"]
        for word in lesson["vocabulary"]:
            yield Path(word["audio"]).name, word["kana"]
        listening = next(question for question in lesson["questions"] if question["type"] == "listen")
        yield Path(listening["audio"]).name, listening["kana"]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--voice", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    model = Kokoro(str(args.model), str(args.voice))
    work = list(entries())
    if args.limit:
        work = work[:args.limit]
    manifest = []
    cache = {}
    for number, (filename, kana) in enumerate(work, 1):
        target = args.output / filename
        if kana in cache:
            shutil.copyfile(args.output / cache[kana]["file"], target)
            phonemes = cache[kana]["phonemes"]
            duration = cache[kana]["seconds"]
        else:
            phonemes = model.phonemize(kana)
            if not model._tokenize(phonemes):
                raise ValueError(f"no phonemes for {kana}")
            original = model.phonemize
            model.phonemize = lambda _text: phonemes
            try:
                samples, sample_rate = model.create(kana, speed=0.9)
            finally:
                model.phonemize = original
            duration = round(write_mp3(samples, sample_rate, target), 3)
            cache[kana] = {"file": filename, "phonemes": phonemes, "seconds": duration}
        manifest.append({"file": filename, "kana": kana, "phonemes": phonemes, "seconds": duration})
        print(f"{number}/{len(work)} {kana} {phonemes} {duration:.2f}s", flush=True)
    (args.output / "course-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
