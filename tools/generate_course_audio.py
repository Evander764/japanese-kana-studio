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


def entries(lesson_ids=None):
    script = "process.stdout.write(JSON.stringify(require(process.argv[1]).lessons))"
    lessons = json.loads(subprocess.check_output(
        ["node", "-e", script, str(ROOT / "course-data.js")],
        text=True, encoding="utf-8"
    ))
    for lesson in lessons:
        if lesson_ids is not None and lesson["id"] not in lesson_ids:
            continue
        yield f'course-{lesson["id"]}-example.mp3', lesson["example"]["kana"]
        for number, example in enumerate(lesson.get("examples", [])[1:], 2):
            yield f'course-{lesson["id"]}-example-{number}.mp3', example["kana"]
        for word in lesson["vocabulary"]:
            yield Path(word["audio"]).name, word["kana"]
        for question in lesson["questions"]:
            yield Path(question["audio"]).name, question["spoken"]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--voice", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--lessons", nargs="+", help="Only render these lesson IDs, e.g. 09 10; preserve the other manifest entries")
    parser.add_argument("--missing-only", action="store_true", help="Keep matching existing clips and render only added or changed content")
    args = parser.parse_args()
    all_entries = list(entries())
    if args.lessons:
        known_ids = {filename.split("-")[1] for filename, _ in all_entries}
        if not set(args.lessons) <= known_ids:
            parser.error("--lessons contains an unknown lesson ID")
    args.output.mkdir(parents=True, exist_ok=True)
    model = Kokoro(str(args.model), str(args.voice))
    work = list(entries(set(args.lessons) if args.lessons else None))
    if args.limit:
        work = work[:args.limit]
    manifest_path = args.output / "course-manifest.json"
    previous = json.loads(manifest_path.read_text(encoding="utf-8")) if (args.lessons or args.missing_only) and manifest_path.exists() else []
    manifest = {entry["file"]: entry for entry in previous}
    cache = {entry["kana"]: entry for entry in previous if (args.output / entry["file"]).exists()}
    for number, (filename, kana) in enumerate(work, 1):
        target = args.output / filename
        if args.missing_only and target.exists() and manifest.get(filename, {}).get("kana") == kana:
            print(f"{number}/{len(work)} keep {kana}", flush=True)
            continue
        if kana in cache and (args.output / cache[kana]["file"]).exists():
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
        manifest[filename] = {"file": filename, "kana": kana, "phonemes": phonemes, "seconds": duration}
        print(f"{number}/{len(work)} {kana} {phonemes} {duration:.2f}s", flush=True)
    ordered_manifest = [manifest[filename] for filename, _ in all_entries if filename in manifest]
    manifest_path.write_text(
        json.dumps(ordered_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
