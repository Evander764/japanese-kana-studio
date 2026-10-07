"""Normalize existing offline kana clips to a consistent, clearer loudness."""

import json
import os
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "audio"


def main():
    manifests = [AUDIO_DIR / "manifest.json", AUDIO_DIR / "phrase-manifest.json"]
    files = set()
    for manifest_path in manifests:
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            files.update(entry["file"] for entry in manifest)
    files = sorted(files)
    with tempfile.TemporaryDirectory(prefix="kana-audio-") as temporary:
        temporary_dir = Path(temporary)
        for index, filename in enumerate(files, 1):
            source = AUDIO_DIR / filename
            target = temporary_dir / filename
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                "-af", "loudnorm=I=-18:TP=-2:LRA=7",
                "-codec:a", "libmp3lame", "-q:a", "4", str(target)
            ], check=True)
            os.replace(target, source)
            print(f"{index}/{len(files)} normalized {filename}", flush=True)


if __name__ == "__main__":
    main()
