#!/usr/bin/env python3
"""Build the separate English tutorial from its Japanese layout and reviewed text.
No user desk or application locale is changed. Run from any working directory.
"""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/tabletop/tabletop-guide.tabletop'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'docs/tabletop/tabletop-guide-en.tabletop')
DESTINATION = parser.parse_args().output
with zipfile.ZipFile(SOURCE) as archive:
    document = json.loads(archive.read('manifest.json'))
    payloads = {name: archive.read(name) for name in archive.namelist() if name != 'manifest.json'}
objects = {item['id']: item for item in document['objects']}
translations = json.loads((ROOT / 'scripts/data/tutorial-en.json').read_text())
for object_id, patch in translations.items():
    if object_id not in objects:
        raise SystemExit(f'Tutorial object no longer exists: {object_id}')
    objects[object_id].update(patch)
document['settings']['name'] = 'Tabletop — English tool tour'
for series in document['settings']['series']:
    key = series['id'].removeprefix('guide-sample-pair-')
    detail = objects.get('tool-detail-' + key)
    if detail:
        heading = detail['text'].splitlines()[0].removeprefix('### ').split(' — ')[0]
        series['name'] = heading + ': details and example'
    elif series['id'] == 'guide-tools-numbering':
        series['name'] = 'Tools 01–44'
    elif series['id'] == 'guide-sample-pin-abc-series':
        series['name'] = 'Try pins A B C'
    elif series['id'] == 'guide-sample-pin-star-series':
        series['name'] = 'Five-card star route'
    elif series['id'] == 'series-1':
        series['name'] = 'Numbers'
    elif re.search('[\u3040-\u9fff]', series['name']):
        raise SystemExit(f'Untranslated pin series: {series["id"]}')

def set_asset(object_id, data, mime='image/svg+xml', extension='svg'):
    path = 'assets/' + hashlib.sha256(data).hexdigest() + '.' + extension
    document['assets'][object_id] = {'path': path, 'mime': mime}
    payloads[path] = data

# Use the separately designed English area prop. Retain the Japanese stamp designs.
set_asset('guide-sample-prop-area', (ROOT / 'public/props/temporary-area-en.svg').read_bytes())
logo_asset = document['assets']['guide-decoration-tabletop-logo']
logo = payloads[logo_asset['path']].decode().replace('人間とAIの共有作業机', 'A shared desk for people and AI')
set_asset('guide-decoration-tabletop-logo', logo.encode())
# A rendered English camera example is reviewed alongside the tutorial, not fetched.
camera = ROOT / 'docs/images/tabletop-camera-en.png'
if camera.exists():
    set_asset('image-18cb43a8', camera.read_bytes(), 'image/png', 'png')
else:
    raise SystemExit('Missing English camera example: docs/images/tabletop-camera-en.png')
for item in document['objects']:
    for key, value in item.items():
        if isinstance(value, str) and key != 'src' and re.search('[\u3040-\u9fff]', value):
            raise SystemExit(f'Untranslated object field: {item["id"]}.{key}')
# Drop orphaned Japanese assets and retain the saved object order and IDs.
used = {asset['path'] for asset in document['assets'].values()}
with zipfile.ZipFile(DESTINATION, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(used):
        archive.writestr(name, payloads[name])
    archive.writestr('manifest.json', json.dumps(document, ensure_ascii=False, separators=(',', ':')))
print(f'Built {DESTINATION}: {len(objects)} objects, {len(used)} assets')
