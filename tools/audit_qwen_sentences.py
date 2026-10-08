"""ASR spot/full audit for the newly synthesized sentence clips.

Whisper is an independent check, not a pronunciation authority. Review flags
and use the Kokoro fallback or regenerate a clip before publishing.
"""

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

from faster_whisper import WhisperModel
from pykakasi import kakasi


ROOT = Path(__file__).resolve().parents[1]


def is_sentence(manifest, filename):
    return manifest == "phrase-manifest.json" or (
        manifest == "course-manifest.json" and
        ("-example" in filename or re.search(r"-q[123567]\.mp3$|-listen\.mp3$", filename))
    )


def reading(text, converter):
    numbers = {"0": "ぜろ", "1": "いち", "2": "に", "3": "さん", "4": "よん", "5": "ご", "6": "ろく", "7": "なな", "8": "はち", "9": "きゅう", "10": "じゅう", "11": "じゅういち", "12": "じゅうに"}
    text = re.sub(r"\d+", lambda match: numbers.get(match.group(), match.group()), text)
    converted = "".join(part["hira"] for part in converter.convert(text))
    converted = "".join(chr(ord(char) - 96) if "ァ" <= char <= "ヶ" else char for char in converted)
    return "".join(char for char in converted if "ぁ" <= char <= "ん" or char == "ー")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--words", action="store_true", help="Audit vocabulary and example words instead of sentences")
    parser.add_argument("--rescore", action="store_true", help="Rescore stored transcripts without rerunning recognition")
    args = parser.parse_args()
    checkpoint = json.loads((args.stage / "checkpoint.json").read_text(encoding="utf-8"))
    filenames = [name for name, entry in checkpoint.items() if (
        (entry["manifest"] == "manifest.json" and name.startswith("special-")) or
        re.search(r"-v\d+\.mp3$|-q[48]\.mp3$", name)
    )] if args.words else [name for name, entry in checkpoint.items() if is_sentence(entry["manifest"], name)]
    if args.limit:
        filenames = filenames[:args.limit]
    audit_path = args.stage / ("asr-audit-words.json" if args.words else "asr-audit.json")
    audit = json.loads(audit_path.read_text(encoding="utf-8")) if audit_path.exists() else {}
    model = WhisperModel(str(args.model), device="cpu", compute_type="int8", cpu_threads=4)
    converter = kakasi()
    for index, filename in enumerate(filenames, 1):
        entry = checkpoint[filename]
        stored = audit.get(filename)
        if stored and stored.get("sha256") == entry["sha256"] and not args.rescore:
            print(f"{index}/{len(filenames)} keep {filename}", flush=True)
            continue
        if args.rescore and stored and stored.get("sha256") == entry["sha256"]:
            recognized = stored["recognized"]
        else:
            segments, _ = model.transcribe(str(args.stage / filename), language="ja", beam_size=1, best_of=1, vad_filter=False)
            recognized = "".join(segment.text for segment in segments).strip()
        expected_reading = reading(entry["kana"], converter)
        actual_reading = reading(recognized, converter)
        score = round(difflib.SequenceMatcher(None, expected_reading, actual_reading).ratio(), 3)
        repeated = len(actual_reading) > len(expected_reading) * 1.35 + 2
        suspicious = score < 0.72 or repeated
        audit[filename] = {
            "expected": entry["kana"], "recognized": recognized,
            "expectedReading": expected_reading, "recognizedReading": actual_reading,
            "score": score, "suspicious": suspicious, "seconds": entry["seconds"],
            "sha256": entry["sha256"],
        }
        audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{index}/{len(filenames)} {'FLAG' if suspicious else 'ok'} {filename} score={score} {recognized}", flush=True)


if __name__ == "__main__":
    main()
