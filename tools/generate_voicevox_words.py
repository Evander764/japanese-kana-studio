"""Stage course vocabulary with a local VOICEVOX Nemo voice.

The runtime, dictionary, and voice model are supplied externally and are never
checked into Git. Each completed MP3 is checkpointed for safe resumption.
"""

import argparse
import hashlib
import json
import re
import shutil
import statistics
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


def set_pitch_contour(phrase, accent):
    """Keep VOICEVOX timing/devoicing, but make the displayed high/low contour audible."""
    unvoiced = {'A', 'E', 'I', 'O', 'U', 'cl'}
    voiced = [mora.pitch for mora in phrase.moras if mora.pitch > 0 and mora.vowel not in unvoiced]
    original_center = statistics.median(voiced) if voiced else 5.5
    # Open JTalk occasionally predicts an implausibly low isolated-word base.
    # Bring those outliers into Nemo's speaking range before applying the contour.
    center = max(5.4, original_center) if original_center < 5.1 else original_center
    for index, mora in enumerate(phrase.moras):
        if mora.vowel in unvoiced:
            mora.pitch = 0.0
            continue
        high = index > 0 and (accent == 0 or index < accent)
        if accent == 1:
            high = index == 0
        # VOICEVOX uses log F0. A 0.36 log-unit gap stays audible after smoothing.
        residual = mora.pitch - original_center if mora.pitch > 0 else 0
        mora.pitch = center + (0.18 if high else -0.18) + 0.04 * residual


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
    parser.add_argument('--only-file', action='append', help='Generate just this filename; repeat for samples')
    parser.add_argument('--inspect', action='store_true', help='Check segmentation and pitch without generating audio')
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
    selected = [(manifest, entry) for manifest, entry in entries() if entry['kana'] in pitch]
    if args.only_file:
        wanted = set(args.only_file)
        selected = [(manifest, entry) for manifest, entry in selected if entry['file'] in wanted]
        if {entry['file'] for _, entry in selected} != wanted:
            raise ValueError(f'unknown or unpitched file(s): {wanted - {entry["file"] for _, entry in selected}}')
    failures = []
    for index, (manifest, entry) in enumerate(selected, 1):
        filename = entry['file']
        spoken = overrides.get(filename, entry['kana'])
        query = synthesizer.create_audio_query(spoken, args.style_id)
        query.speed_scale = args.speed
        target_pitch = pitch[entry['kana']]
        if len(query.accent_phrases) != 1 or len(query.accent_phrases[0].moras) != len(moras(entry['kana'])):
            failures.append((filename, spoken, [len(phrase.moras) for phrase in query.accent_phrases], len(moras(entry['kana']))))
            print(f'{index}/{len(selected)} UNALIGNED {failures[-1]}', flush=True)
            continue
        phrase = query.accent_phrases[0]
        target_accent = target_pitch['accents'][0]
        phrase.accent = target_accent or len(phrase.moras)
        # AudioQuery already contains mora pitches. Changing only the accent
        # number leaves the old contour in place; recalculate it explicitly.
        query.accent_phrases = synthesizer.replace_mora_pitch(query.accent_phrases, args.style_id)
        set_pitch_contour(query.accent_phrases[0], target_accent)
        pronunciation = '/'.join(''.join(mora.text for mora in phrase.moras) for phrase in query.accent_phrases)
        accents = [phrase.accent for phrase in query.accent_phrases]
        mora_pitch = [round(mora.pitch, 4) for mora in query.accent_phrases[0].moras]
        mora_timing = [round((mora.consonant_length or 0) + mora.vowel_length, 4) for mora in query.accent_phrases[0].moras]
        mora_consonants = [round(mora.consonant_length or 0, 4) for mora in query.accent_phrases[0].moras]
        mora_vowels = [round(mora.vowel_length, 4) for mora in query.accent_phrases[0].moras]
        signature = json.dumps(['course-dictionary-v2', spoken, args.style_id, args.speed, target_accent, pronunciation, mora_pitch], ensure_ascii=False)
        if args.inspect:
            print(f'{index}/{len(selected)} {filename} {spoken} [{pronunciation}] target={target_accent} query={accents} pitches={mora_pitch} timing={mora_timing}', flush=True)
            continue
        target = args.stage / filename
        old = checkpoint.get(filename)
        if old and old.get('signature') == signature and old.get('mora_timing') == mora_timing and target.exists() and old.get('sha256') == hashlib.sha256(target.read_bytes()).hexdigest():
            old.update({'mora_consonants': mora_consonants, 'mora_vowels': mora_vowels,
                        'pre_phoneme_length': round(query.pre_phoneme_length, 4),
                        'post_phoneme_length': round(query.post_phoneme_length, 4)})
            checkpoint_path.write_text(json.dumps(checkpoint, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
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
            'pitch_aligned': True, 'target_accent': target_accent,
            'pitch_source': target_pitch['source'], 'mora_pitch': mora_pitch,
            'mora_timing': mora_timing,
            'mora_consonants': mora_consonants, 'mora_vowels': mora_vowels,
            'pre_phoneme_length': round(query.pre_phoneme_length, 4),
            'post_phoneme_length': round(query.post_phoneme_length, 4),
            'signature': signature, 'seconds': seconds,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'engine': 'voicevox-core-0.17.0', 'voice': args.voice_name,
        }
        checkpoint_path.write_text(json.dumps(checkpoint, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{index}/{len(selected)} {filename} {spoken} [{pronunciation}] {accents}', flush=True)
    if failures:
        raise ValueError(f'{len(failures)} word(s) could not be aligned; add explicit synthesis overrides')


if __name__ == '__main__':
    main()
