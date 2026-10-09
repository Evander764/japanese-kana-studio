"""Stage course vocabulary with a local VOICEVOX Nemo voice.

The runtime, dictionary, and voice model are supplied externally and are never
checked into Git. Each completed MP3 is checkpointed for safe resumption.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from voicevox_core import UserDictWord
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, UserDict, VoiceModelFile


ROOT = Path(__file__).resolve().parents[1]


def entries():
    for manifest in ('manifest.json', 'course-manifest.json'):
        for entry in json.loads((ROOT / 'audio' / manifest).read_text(encoding='utf-8')):
            name = entry['file']
            if (manifest == 'manifest.json' and name.startswith('special-')) or (
                manifest == 'course-manifest.json' and re.search(r'-v\d+\.mp3$|-q[48]\.mp3$', name)
            ):
                yield manifest, entry


def pitch_data():
    source = (ROOT / 'pitch-data.js').read_text(encoding='utf-8')
    match = re.search(r'const entries = (\{.*?\});\s*if \(typeof module', source, re.S)
    if not match:
        raise ValueError('cannot parse pitch-data.js')
    return json.loads(match.group(1))


def moras(reading):
    result = []
    for char in reading:
        if char in 'ゃゅょャュョぁぃぅぇぉァィゥェォ' and result:
            result[-1] += char
        else:
            result.append(char)
    return result


def to_katakana(reading):
    return ''.join(chr(ord(char) + 96) if 'ぁ' <= char <= 'ゖ' else char for char in reading)


def encode(wav, target):
    with tempfile.TemporaryDirectory() as temporary:
        source = Path(temporary) / 'clip.wav'
        source.write_bytes(wav)
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
            '-af', 'loudnorm=I=-18:TP=-2:LRA=7', '-codec:a', 'libmp3lame', '-q:a', '4', str(target)
        ], check=True)
    seconds = float(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', str(target)
    ], text=True).strip())
    if not 0.2 < seconds < 10 or target.stat().st_size < 1000:
        raise ValueError(f'invalid audio: {target.name}')
    return round(seconds, 3)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime', required=True, type=Path)
    parser.add_argument('--dictionary', required=True, type=Path)
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--stage', required=True, type=Path)
    parser.add_argument('--style-id', type=int, default=10008)
    parser.add_argument('--voice-name', default='VOICEVOX Nemo 女声5')
    parser.add_argument('--speed', type=float, default=1.0)
    parser.add_argument('--overrides', type=Path, help='JSON map from MP3 filename to synthesis text')
    args = parser.parse_args()
    args.stage.mkdir(parents=True, exist_ok=True)
    checkpoint_path = args.stage / 'checkpoint.json'
    checkpoint = json.loads(checkpoint_path.read_text(encoding='utf-8')) if checkpoint_path.exists() else {}
    overrides = json.loads(args.overrides.read_text(encoding='utf-8-sig')) if args.overrides else {}
    pitch = pitch_data()
    open_jtalk = OpenJtalk(str(args.dictionary))
    user_dictionary = UserDict()
    for reading, data in pitch.items():
        user_dictionary.add_word(UserDictWord(
            reading, to_katakana(reading), data['accents'][0], priority=10
        ))
    open_jtalk.use_user_dict(user_dictionary)
    synthesizer = Synthesizer(Onnxruntime.load_once(filename=str(args.runtime)), open_jtalk)
    with VoiceModelFile.open(str(args.model)) as model:
        synthesizer.load_voice_model(model)
    cache = {}
    selected = list(entries())
    for index, (manifest, entry) in enumerate(selected, 1):
        filename = entry['file']
        spoken = overrides.get(filename, entry['kana'])
        query = synthesizer.create_audio_query(spoken, args.style_id)
        query.speed_scale = args.speed
        target_pitch = pitch.get(entry['kana'])
        pitch_aligned = False
        if target_pitch and len(query.accent_phrases) == 1:
            phrase = query.accent_phrases[0]
            if len(phrase.moras) == len(moras(entry['kana'])):
                accent = target_pitch['accents'][0]
                phrase.accent = accent or len(phrase.moras)
                pitch_aligned = True
        pronunciation = '/'.join(''.join(mora.text for mora in phrase.moras) for phrase in query.accent_phrases)
        accents = [phrase.accent for phrase in query.accent_phrases]
        signature = json.dumps(['course-dictionary-v1', spoken, args.style_id, args.speed, accents, pronunciation], ensure_ascii=False)
        target = args.stage / filename
        old = checkpoint.get(filename)
        if old and old.get('signature') == signature and target.exists() and old.get('sha256') == hashlib.sha256(target.read_bytes()).hexdigest():
            cache[signature] = target
            print(f'{index}/{len(selected)} keep {filename}', flush=True)
            continue
        if signature in cache and cache[signature].exists():
            shutil.copyfile(cache[signature], target)
            seconds = checkpoint[cache[signature].name]['seconds']
        else:
            seconds = encode(synthesizer.synthesis(query, args.style_id), target)
            cache[signature] = target
        checkpoint[filename] = {
            'manifest': manifest, 'file': filename, 'kana': entry['kana'],
            'synthesis_text': spoken, 'pronunciation': pronunciation, 'accents': accents,
            'pitch_aligned': pitch_aligned, 'signature': signature, 'seconds': seconds,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'engine': 'voicevox-core-0.17.0', 'voice': args.voice_name,
        }
        checkpoint_path.write_text(json.dumps(checkpoint, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{index}/{len(selected)} {filename} {spoken} [{pronunciation}] {accents}', flush=True)


if __name__ == '__main__':
    main()
