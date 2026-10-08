"""Publish validated staged audio and update its three manifests atomically."""

import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ("manifest.json", "phrase-manifest.json", "course-manifest.json")


def is_sentence(manifest, filename):
    return bool(manifest == "phrase-manifest.json" or (
        manifest == "course-manifest.json" and
        ("-example" in filename or re.search(r"-q[123567]\.mp3$|-listen\.mp3$", filename))
    ))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--qwen-stage", required=True, type=Path)
    parser.add_argument("--kokoro-stage", required=True, type=Path)
    parser.add_argument("--fallback-files", nargs="*", default=[], help="Qwen sentence files to use the Kokoro version for")
    parser.add_argument("--alternate-kokoro-stage", type=Path)
    parser.add_argument("--alternate-files", type=Path, help="JSON list of word files to use from the alternate Kokoro voice")
    parser.add_argument("--custom-stage", type=Path, help="Audited Qwen CustomVoice word clips")
    parser.add_argument("--custom-files", nargs="*", default=[])
    parser.add_argument("--qwen-word-stage", type=Path, help="Audited Qwen VoiceDesign word clips")
    parser.add_argument("--qwen-word-files", type=Path, help="JSON list of word files to use from Qwen VoiceDesign")
    args = parser.parse_args()
    qwen = json.loads((args.qwen_stage / "checkpoint.json").read_text(encoding="utf-8"))
    kokoro = json.loads((args.kokoro_stage / "checkpoint.json").read_text(encoding="utf-8"))
    alternate_files = set(json.loads(args.alternate_files.read_text(encoding="utf-8"))) if args.alternate_files else set()
    if alternate_files and not args.alternate_kokoro_stage:
        parser.error("--alternate-kokoro-stage is required with --alternate-files")
    alternate = json.loads((args.alternate_kokoro_stage / "checkpoint.json").read_text(encoding="utf-8")) if alternate_files else {}
    custom_files = set(args.custom_files)
    if custom_files and not args.custom_stage:
        parser.error("--custom-stage is required with --custom-files")
    custom = json.loads((args.custom_stage / "checkpoint.json").read_text(encoding="utf-8")) if custom_files else {}
    custom_audit = json.loads((args.custom_stage / "asr-audit-words.json").read_text(encoding="utf-8")) if custom_files else {}
    qwen_word_files = set(json.loads(args.qwen_word_files.read_text(encoding="utf-8"))) if args.qwen_word_files else set()
    if qwen_word_files and not args.qwen_word_stage:
        parser.error("--qwen-word-stage is required with --qwen-word-files")
    qwen_words = json.loads((args.qwen_word_stage / "checkpoint.json").read_text(encoding="utf-8")) if qwen_word_files else {}
    qwen_word_audit = json.loads((args.qwen_word_stage / "asr-audit-words.json").read_text(encoding="utf-8")) if qwen_word_files else {}
    audit = json.loads((args.qwen_stage / "asr-audit.json").read_text(encoding="utf-8"))
    originals = {name: json.loads((ROOT / "audio" / name).read_text(encoding="utf-8")) for name in MANIFESTS}
    expected = {entry["file"] for entries in originals.values() for entry in entries}
    if len(expected) != 527:
        raise ValueError(f"unexpected packaged audio count: {len(expected)}")
    fallback = set(args.fallback_files)
    if not fallback <= expected:
        raise ValueError("unknown fallback file")
    if (not alternate_files <= expected or not custom_files <= expected or not qwen_word_files <= expected or
            alternate_files & custom_files or alternate_files & qwen_word_files or custom_files & qwen_word_files):
        raise ValueError("unknown or overlapping alternate file")
    plan = []
    for manifest, entries in originals.items():
        for entry in entries:
            filename = entry["file"]
            use_qwen = is_sentence(manifest, filename) and filename not in fallback
            use_alternate = filename in alternate_files
            use_custom = filename in custom_files
            use_qwen_word = filename in qwen_word_files
            if (use_alternate or use_custom or use_qwen_word) and (use_qwen or is_sentence(manifest, filename)):
                raise ValueError(f"alternate voice only supports words: {filename}")
            stage = args.qwen_stage if use_qwen else args.qwen_word_stage if use_qwen_word else args.custom_stage if use_custom else args.alternate_kokoro_stage if use_alternate else args.kokoro_stage
            record = (qwen if use_qwen else qwen_words if use_qwen_word else custom if use_custom else alternate if use_alternate else kokoro).get(filename)
            if not record or record["kana"] != entry["kana"]:
                raise ValueError(f"missing/mismatched staged audio: {filename}")
            source = stage / filename
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            if digest != record["sha256"] or source.stat().st_size < 1000:
                raise ValueError(f"invalid staged audio: {filename}")
            if use_qwen and (filename not in audit or audit[filename]["sha256"] != digest or audit[filename]["suspicious"]):
                raise ValueError(f"unreviewed or flagged Qwen audio: {filename}")
            if use_custom and (filename not in custom_audit or custom_audit[filename]["sha256"] != digest or custom_audit[filename]["suspicious"]):
                raise ValueError(f"unreviewed or flagged CustomVoice audio: {filename}")
            if use_qwen_word and (filename not in qwen_word_audit or qwen_word_audit[filename]["sha256"] != digest or qwen_word_audit[filename]["suspicious"] or qwen_word_audit[filename]["score"] < 1):
                raise ValueError(f"unreviewed or flagged Qwen word audio: {filename}")
            plan.append((manifest, entry, record, source, use_qwen, use_alternate, use_custom, use_qwen_word))
    # Validate the full plan before changing any published file.
    updates = {name: [] for name in MANIFESTS}
    for manifest, entry, record, source, use_qwen, use_alternate, use_custom, use_qwen_word in plan:
        refreshed = {key: value for key, value in entry.items() if key not in {"phonemes", "seconds", "engine", "voice", "model", "sha256", "synthesisText"}}
        refreshed.update({
            "seconds": record["seconds"], "sha256": record["sha256"],
            "engine": "qwen3-tts-voice-design" if use_qwen or use_qwen_word else "qwen3-tts-custom-voice" if use_custom else "kokoro-82m",
            "voice": "Japanese tutor prompt v1" if use_qwen or use_qwen_word else "Ono_Anna" if use_custom else "jf_alpha" if use_alternate else "jf_gongitsune",
        })
        if use_qwen or use_qwen_word or use_custom:
            refreshed["synthesisText"] = record.get("synthesis_text", record["kana"])
        else:
            phonemes = entry.get("phonemes") or record.get("phonemes")
            if not phonemes:
                raise ValueError(f"missing Kokoro phonemes: {entry['file']}")
            refreshed["phonemes"] = phonemes
        updates[manifest].append(refreshed)
    for _manifest, entry, _record, source, _use_qwen, _use_alternate, _use_custom, _use_qwen_word in plan:
        target = ROOT / "audio" / entry["file"]
        temporary = target.with_suffix(".mp3.pending")
        shutil.copyfile(source, temporary)
        os.replace(temporary, target)
    for name, entries in updates.items():
        target = ROOT / "audio" / name
        temporary = target.with_suffix(".json.pending")
        temporary.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, target)
    print(f"published {len(plan)} clips: {sum(use_qwen or use_qwen_word for *_, use_qwen, _alternate, _custom, use_qwen_word in plan)} Qwen VoiceDesign, {len(custom_files)} Qwen CustomVoice, {sum(not use_qwen and not use_custom and not use_qwen_word for *_, use_qwen, _alternate, use_custom, use_qwen_word in plan)} Kokoro ({len(alternate_files)} alternate voice)")


if __name__ == "__main__":
    main()
