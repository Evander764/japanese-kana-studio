"""Publish a verified 285-clip word voice stage without touching sentence audio."""

import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ('manifest.json', 'course-manifest.json')


def is_word(manifest, filename):
    return (manifest == 'manifest.json' and filename.startswith('special-')) or (
        manifest == 'course-manifest.json' and bool(re.search(r'-v\d+\.mp3$|-q[48]\.mp3$', filename))
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', required=True, type=Path)
    args = parser.parse_args()
    checkpoint = json.loads((args.stage / 'checkpoint.json').read_text(encoding='utf-8-sig'))
    manifests = {name: json.loads((ROOT / 'audio' / name).read_text(encoding='utf-8')) for name in MANIFESTS}
    expected = {(name, entry['file']) for name, entries in manifests.items() for entry in entries if is_word(name, entry['file'])}
    if len(expected) != 285 or {file for _, file in expected} != set(checkpoint):
        raise ValueError('stage must contain exactly the 285 currently published word clips')
    plan = []
    for manifest, entries in manifests.items():
        for entry in entries:
            if not is_word(manifest, entry['file']):
                continue
            record = checkpoint[entry['file']]
            source = args.stage / entry['file']
            if record['kana'] != entry['kana'] or record['manifest'] != manifest:
                raise ValueError(f'mismatched reading: {entry["file"]}')
            if not 0.2 < float(record['seconds']) < 10 or source.stat().st_size < 1000:
                raise ValueError(f'invalid duration or size: {entry["file"]}')
            if hashlib.sha256(source.read_bytes()).hexdigest() != record['sha256']:
                raise ValueError(f'hash mismatch: {entry["file"]}')
            if record['engine'] != 'windows-sapi5' or record['voice'] not in {'Microsoft Ayumi', 'Microsoft Sayaka'}:
                raise ValueError(f'unexpected voice: {entry["file"]}')
            updated = {k: v for k, v in entry.items() if k not in {'phonemes', 'model', 'synthesisText'}}
            updated.update({k: record[k] for k in ('seconds', 'sha256', 'engine', 'voice')})
            updated['synthesisText'] = record['synthesis_text']
            plan.append((manifest, entry['file'], source, updated))
    if len(plan) != 285:
        raise ValueError('word selection mismatch')
    for _, filename, source, _ in plan:
        target = ROOT / 'audio' / filename
        temporary = target.with_suffix('.mp3.pending')
        shutil.copyfile(source, temporary)
        os.replace(temporary, target)
    replacements = {(manifest, filename): updated for manifest, filename, _, updated in plan}
    for manifest, entries in manifests.items():
        refreshed = [replacements.get((manifest, entry['file']), entry) for entry in entries]
        target = ROOT / 'audio' / manifest
        temporary = target.with_suffix('.json.pending')
        temporary.write_text(json.dumps(refreshed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        os.replace(temporary, target)
    print(f'Published {len(plan)} verified word clips from {args.stage}')


if __name__ == '__main__':
    main()
