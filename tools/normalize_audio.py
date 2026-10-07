"""Normalize existing offline kana clips to a consistent, clearer loudness."""

import json
import os
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "audio"


def main():
    manifest = json.loads((AUDIO_DIR / "manifest.json").read_text(encoding="utf-8"))
    files = sorted({entry["file"] for entry in manifest})
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
