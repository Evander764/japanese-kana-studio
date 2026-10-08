"""Combine audited word voice stages outside Git, retaining per-clip provenance."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path


def read(stage):
    return json.loads((stage / 'checkpoint.json').read_text(encoding='utf-8-sig'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--primary', required=True, type=Path)
    parser.add_argument('--alternate', required=True, type=Path)
    parser.add_argument('--alternate-files', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    primary, alternate = read(args.primary), read(args.alternate)
    primary_audit = json.loads((args.primary / 'asr-audit-words.json').read_text(encoding='utf-8'))
    alternate_audit = json.loads((args.alternate / 'asr-audit-words.json').read_text(encoding='utf-8'))
    chosen = set(json.loads(args.alternate_files.read_text(encoding='utf-8')))
    if len(primary) != 285 or set(primary) != set(alternate) or not chosen <= set(primary):
        raise ValueError('incomplete stage or unknown alternate file')
    args.output.mkdir(parents=True, exist_ok=True)
    merged = {}
    merged_audit = {}
    for name, record in primary.items():
        stage = args.alternate if name in chosen else args.primary
        item = alternate[name] if name in chosen else record
        if item['kana'] != record['kana'] or item['manifest'] != record['manifest']:
            raise ValueError(f'mismatched word: {name}')
        source = stage / name
        if hashlib.sha256(source.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError(f'bad source hash: {name}')
        audit = (alternate_audit if name in chosen else primary_audit).get(name)
        if not audit or audit['sha256'] != item['sha256']:
            raise ValueError(f'missing or stale ASR audit: {name}')
        shutil.copyfile(source, args.output / name)
        merged[name] = item
        merged_audit[name] = audit
    (args.output / 'checkpoint.json').write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (args.output / 'asr-audit-words.json').write_text(json.dumps(merged_audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Assembled {len(merged)} word clips; {len(chosen)} alternate clips')


if __name__ == '__main__':
    main()
