"""Extract course pitch accents from Irodori and OJAD for editorial review.

Usage: python tools/build_pitch_data.py WORDLIST.xlsx VOCAB.json OUTPUT.json
The downloaded reference workbook and fetched pages stay outside Git.
"""

import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

import openpyxl
import requests
import truststore
from bs4 import BeautifulSoup
import pyopenjtalk


def moras(text):
    result = []
    for char in text:
        if char in 'ゃゅょャュョぁぃぅぇぉァィゥェォ' and result:
            result[-1] += char
        else:
            result.append(char)
    return result


def irodori_entries(path):
    sheet = openpyxl.load_workbook(path, read_only=True, data_only=True).active
    entries = defaultdict(set)
    for row in list(sheet.values)[1:]:
        reading, marked = row[3], row[4]
        if not isinstance(reading, str) or not isinstance(marked, str):
            continue
        for variant in marked.split('／'):
            if '↓' in variant:
                before = variant.split('↓', 1)[0]
                accent = len(moras(before))
            elif '○' in variant:
                accent = 0
            else:
                continue
            entries[reading].add(accent)
    return entries


def ojad_entries(page):
    soup = BeautifulSoup(page, 'html.parser')
    found = defaultdict(set)
    for word in soup.select('#word_table tr[id^="word_"]'):
        for accent_word in word.select('.accented_word'):
            pieces = accent_word.find_all('span', class_=re.compile(r'mola_-'), recursive=False)
            if not pieces:
                continue
            reading = ''.join(''.join(char.get_text() for char in part.select('.char')) for part in pieces)
            accent = next((index for index, part in enumerate(pieces, 1) if 'accent_top' in part.get('class', [])), 0)
            found[reading].add(accent)
    return found


def main():
    workbook, vocab_json, output_json = map(Path, sys.argv[1:4])
    targets = [entry['kana'] for entry in json.loads(vocab_json.read_text(encoding='utf-8'))]
    verified = irodori_entries(workbook)
    result = {word: {'accents': sorted(verified[word]), 'source': 'irodori'} for word in targets if word in verified}
    missing = [word for word in targets if word not in result]
    # OJAD Word Search accepts space/comma-separated terms and returns inflected forms.
    truststore.inject_into_ssl()
    for offset in range(0, len(missing), 8):
        batch = missing[offset:offset + 8]
        url = 'https://www.gavo.t.u-tokyo.ac.jp/ojad/eng/search/index/limit:100/word:' + quote(','.join(batch))
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        found = ojad_entries(response.text)
        for word in batch:
            if word in found:
                result[word] = {'accents': sorted(found[word]), 'source': 'ojad'}
        print(offset, 'resolved', sum(word in result for word in batch), 'of', len(batch), flush=True)
        time.sleep(0.4)
    # Kana-only searches can conflate homophones. Resolve these with the
    # course's intended kanji/meaning before exporting the public data.
    semantic_queries = {
        'よんで': '読む', 'かいて': '書く', 'かって': '買う', 'まって': '待つ',
        'きて': '来る', 'とって': '撮る', 'たって': '立つ', 'おいて': '置く',
    }
    for reading, query in semantic_queries.items():
        if reading not in targets:
            continue
        url = 'https://www.gavo.t.u-tokyo.ac.jp/ojad/eng/search/index/word:' + quote(query)
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        candidates = ojad_entries(response.text).get(reading, set())
        if candidates:
            result[reading] = {'accents': sorted(candidates), 'source': 'ojad'}
        else:
            print('SEMANTIC QUERY MISSING', reading, query)
        time.sleep(0.4)
    for word in targets:
        if word in result:
            continue
        phrases = set(re.findall(r'/F:(\d+)_(\d+)#', '\n'.join(pyopenjtalk.extract_fullcontext(word))))
        if len(phrases) == 1:
            length, accent = map(int, next(iter(phrases)))
            if length == len(moras(word)) and accent <= length:
                result[word] = {'accents': [accent], 'source': 'openjtalk'}
                continue
        print('UNRESOLVED', word, phrases)
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    if output_json.suffix == '.js':
        output_json.write_text("(function (root) {\n  'use strict';\n  const entries = " + payload + ";\n  if (typeof module !== 'undefined' && module.exports) module.exports = entries;\n  root.PitchData = entries;\n})(typeof globalThis !== 'undefined' ? globalThis : window);\n", encoding='utf-8')
    else:
        output_json.write_text(payload + '\n', encoding='utf-8')
    print('COVERED', len(result), '/', len(targets))
    print('MISSING', [word for word in targets if word not in result])


if __name__ == '__main__':
    main()
