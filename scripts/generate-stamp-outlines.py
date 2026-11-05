#!/usr/bin/env python3
"""Regenerate committed fixed-stamp paths. Development only: Python fontTools required.
Pass --font-root to a directory containing the exact original font files.
The application/build never loads these fonts or runs this script.
"""
import argparse, hashlib, json, re
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--font-root', type=Path, default=Path('/usr/share/fonts'))
args = parser.parse_args()
metrics = json.loads((root / 'scripts/data/stamp-outline-metrics.json').read_text())
fonts = {}
for name, info in metrics['fonts'].items():
    matches = list(args.font_root.rglob(info['file']))
    path = next((p for p in matches if hashlib.sha256(p.read_bytes()).hexdigest() == info['sha256']), None)
    if path is None:
        raise SystemExit(f"Missing exact source font: {info['file']} ({info['sha256']})")
    font = TTFont(path, fontNumber=info['index'])
    if font['name'].getDebugName(6) != name:
        raise SystemExit(f'Unexpected font face: {name}')
    fonts[name] = (font, font.getGlyphSet(), font.getBestCmap())

outlines = {}
for case in metrics['cases']:
    pen = SVGPathPen(None)
    for char in case['glyphs']:
        if not char['font']:
            continue  # Spaces retain their measured advance, but have no ink.
        font, glyphs, cmap = fonts[char['font']]
        glyph = cmap.get(ord(char['char']))
        if glyph is None:
            raise SystemExit(f"Missing glyph: {char['char']} in {char['font']}")
        scale = 1000 / font['head'].unitsPerEm
        glyphs[glyph].draw(TransformPen(pen, (scale, 0, 0, -scale, char['x'], char['y'] + case['baseline'])))
    # Milliprecision at a 1000-unit em is well below displayed SVG pixel sizes.
    path = re.sub(r'-?\d+\.\d+', lambda m: format(round(float(m[0]), 3), 'g'), pen.getCommands())
    outlines[case['key']] = {'width': case['width'], 'd': path}
(root / 'src/stamp-outlines.json').write_text(json.dumps(outlines, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Generated {len(outlines)} fixed labels from {len(fonts)} source faces.')
