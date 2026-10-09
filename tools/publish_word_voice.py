"""Publish pitch-controlled vocabulary clips without touching sentence audio."""

import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ('manifest.json', 'course-manifest.json')


def pitch_data():
    source = (ROOT / 'pitch-data.js').read_text(encoding='utf-8')
    match = re.search(r'const entries = (\{.*?\});\s*if \(typeof module', source, re.S)
    if not match:
        raise ValueError('cannot parse pitch-data.js')
    return json.loads(match.group(1))


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
    pitches = pitch_data()
    expected = {(name, entry['file']) for name, entries in manifests.items() for entry in entries
                if is_word(name, entry['file']) and entry['kana'] in pitches}
    if len(expected) != 272 or {file for _, file in expected} != set(checkpoint):
        raise ValueError('stage must contain exactly the 272 words with pitch data')
    plan = []
    for manifest, entries in manifests.items():
        for entry in entries:
            if (manifest, entry['file']) not in expected:
                continue
            record = checkpoint[entry['file']]
            source = args.stage / entry['file']
            if record['kana'] != entry['kana'] or record['manifest'] != manifest:
                raise ValueError(f'mismatched reading: {entry["file"]}')
            if not 0.2 < float(record['seconds']) < 10 or source.stat().st_size < 1000:
                raise ValueError(f'invalid duration or size: {entry["file"]}')
            if hashlib.sha256(source.read_bytes()).hexdigest() != record['sha256']:
                raise ValueError(f'hash mismatch: {entry["file"]}')
            reference = pitches[entry['kana']]
            if (record['engine'] != 'voicevox-core-0.17.0' or not record['voice'].startswith('VOICEVOX Nemo')
                    or record['pitch_aligned'] is not True or record['target_accent'] != reference['accents'][0]
                    or record['pitch_source'] != reference['source']):
                raise ValueError(f'unexpected voice: {entry["file"]}')
            mora_pitch = record['mora_pitch']
            target_accent = record['target_accent']
            if record['accents'] != [target_accent or len(mora_pitch)] or any(value < 0 for value in mora_pitch):
                raise ValueError(f'invalid mora pitch: {entry["file"]}')
            highs = [value for index, value in enumerate(mora_pitch) if value > 0 and
                     (index == 0 if target_accent == 1 else index > 0 and (target_accent == 0 or index < target_accent))]
            lows = [value for index, value in enumerate(mora_pitch) if value > 0 and
                    not (index == 0 if target_accent == 1 else index > 0 and (target_accent == 0 or index < target_accent))]
            if highs and lows and min(highs) - max(lows) < 0.2:
                raise ValueError(f'unclear high/low contour: {entry["file"]}')
            updated = {k: v for k, v in entry.items() if k not in {'phonemes', 'model', 'synthesisText'}}
            updated.update({k: record[k] for k in ('seconds', 'sha256', 'engine', 'voice')})
            updated['synthesisText'] = record['synthesis_text']
            updated['pitchAccent'] = record['target_accent']
            updated['pitchSource'] = record['pitch_source']
            updated['pitchControl'] = 'explicit-mora-f0-v1'
            plan.append((manifest, entry['file'], source, updated))
    if len(plan) != 272:
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
