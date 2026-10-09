"""Measure the voiced vowels in a staged word-audio batch.

Requires numpy, praat-parselmouth and ffmpeg. The audit compares measured F0 against the
accent high/low pattern; devoiced vowels and final-mora accent drops cannot
be judged from an isolated word.
"""

import argparse
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import parselmouth


def levels(accent, count):
    return ['high' if (index == 0 if accent == 1 else index > 0 and (accent == 0 or index < accent)) else 'low'
            for index in range(count)]


def inspect(file, record):
    raw = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(file), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'
    ])
    samples = np.frombuffer(raw, dtype=np.float32)
    pitch_track = parselmouth.Sound(samples, sampling_frequency=16000).to_pitch(
        time_step=0.005, pitch_floor=110, pitch_ceiling=500
    )
    expected = record['pre_phoneme_length'] + sum(record['mora_timing']) + record['post_phoneme_length']
    scale = len(samples) / 16000 / expected
    cursor = record['pre_phoneme_length']
    measured = []
    expected_levels = levels(record['target_accent'], len(record['mora_pitch']))
    for consonant, vowel, target, level in zip(record['mora_consonants'], record['mora_vowels'], record['mora_pitch'], expected_levels):
        begin = (cursor + consonant) * scale
        cursor += consonant + vowel
        if target <= 0 or vowel < 0.035:
            measured.append(None)
            continue
        values = [pitch_track.get_value_at_time(begin + vowel * scale * fraction)
                  for fraction in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7)]
        values = [value for value in values if np.isfinite(value)]
        # Accent peaks can arrive late and voicing can end early; compare the
        # stable upper/lower quartile rather than one arbitrary vowel instant.
        measured.append(float(np.quantile(values, 0.75 if level == 'high' else 0.25)) if values else None)
    matched = [(level, value) for level, value in zip(expected_levels, measured) if value]
    highs = [value for level, value in matched if level == 'high']
    lows = [value for level, value in matched if level == 'low']
    if not highs or not lows:
        return measured, None
    gap = 12 * math.log2(float(np.median(highs)) / float(np.median(lows)))
    return measured, round(gap, 2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', type=Path, required=True)
    parser.add_argument('--only-file', action='append')
    args = parser.parse_args()
    records = json.loads((args.stage / 'checkpoint.json').read_text(encoding='utf-8'))
    failures = []
    inconclusive = []
    for filename, record in records.items():
        if args.only_file and filename not in args.only_file:
            continue
        measured, gap = inspect(args.stage / filename, record)
        if gap is None:
            inconclusive.append(filename)
        elif gap < 1:
            failures.append((filename, record['kana'], record['target_accent'], gap, measured))
        if args.only_file:
            print(filename, record['kana'], record['target_accent'], measured, gap)
    print(f'audited={len(records) if not args.only_file else len(args.only_file)} failures={len(failures)} inconclusive={len(inconclusive)}')
    for failure in failures[:30]:
        print('FAIL', failure)
    for filename in inconclusive[:30]:
        print('INCONCLUSIVE', filename)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
