#!/usr/bin/env python3
"""Generate fixed stamp artwork from reviewed Google Fonts. Development-only fontTools.
No font binary is bundled or fetched by the application/build.
"""
import argparse, hashlib, json, re
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--font-root', type=Path, required=True)
parser.add_argument('--categories', nargs='+', choices=list('ABCDEF'), help='Regenerate only these categories in the existing outline file')
args = parser.parse_args()
review = root / 'docs_devel/stamp-font-review'
sources = json.loads((review / 'sources.json').read_text())
selection = {'A': ('notoserifjp', 900), 'B': ('notosansjp', 900), 'C': ('zenmarugothic', 700),
             'D': ('librebodoni', 700), 'E': ('anton', 400), 'F': ('chewy', 400)}
fonts = {}
for category, (slug, weight) in selection.items():
    if args.categories and category not in args.categories:
        continue
    info = next(f for f in sources['families'] if f['slug'] == slug)
    record = next(f for f in info['files'] if f['name'].endswith('.ttf') and
                  (slug != 'zenmarugothic' or f['name'] == 'ZenMaruGothic-Bold.ttf'))
    matches = [p for p in args.font_root.rglob('*') if p.name == record['name']]
    path = next((p for p in matches if hashlib.sha256(p.read_bytes()).hexdigest() == record['sha256']), None)
    if path is None:
        raise SystemExit(f"Missing exact source font: {record['name']} ({record['sha256']})")
    font = TTFont(path)
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': weight}, inplace=False)
    fonts[category] = font

# Existing assignments are preserved: Japanese serif A, Japanese gothic B,
# English E, background punctuation F. Individual overrides may use C/D.
metrics = json.loads((root / 'scripts/data/stamp-outline-metrics.json').read_text())
assignments = json.loads((root / 'scripts/data/stamp-font-assignments.json').read_text())
outlines = json.loads((root / 'src/stamp-outlines.json').read_text()) if args.categories else {}
vertical_chars = json.loads((root / 'scripts/data/stamp-vertical-labels.json').read_text())
vertical_cases = [{'key': json.dumps(['sans-serif', '800', char], ensure_ascii=False, separators=(',', ':')), 'text': char, 'family': 'sans-serif'} for char in vertical_chars]
extra_labels = json.loads((root / 'scripts/data/stamp-extra-labels.json').read_text())
extra_cases = [{'key': json.dumps(['sans-serif', '800', value], separators=(',', ':')), 'text': value, 'family': 'sans-serif'} for value in extra_labels]
for case in metrics['cases'] + vertical_cases + extra_cases:
    text = case['text']
    category = 'F' if text in ('!', '?') else 'A' if case['family'] == 'serif' else 'B' if any(ord(c) > 127 for c in text) else 'E'
    category = assignments.get(case['key'], category)
    if args.categories and category not in args.categories:
        continue
    font = fonts[category]; glyphs = font.getGlyphSet(); cmap = font.getBestCmap()
    bounds = BoundsPen(glyphs); advance = 0
    for char in text:
        glyph = cmap.get(ord(char))
        if glyph is None:
            raise SystemExit(f'Missing {char!r} in category {category}')
        glyphs[glyph].draw(TransformPen(bounds, (1, 0, 0, 1, advance, 0)))
        advance += font['hmtx'][glyph][0]
    if bounds.bounds is None:
        raise SystemExit(f'Empty fixed label: {text}')
    x0, y0, x1, y1 = bounds.bounds
    if case in vertical_cases:
        # Use one common em square for vertical Japanese. Per-glyph ink-height
        # normalization makes naturally small/narrow kana look inconsistent.
        em = 1000 / font['head'].unitsPerEm
        pen = SVGPathPen(glyphs)
        glyphs[cmap[ord(text)]].draw(TransformPen(pen, (em, 0, 0, -em, 0, 380)))
        path = re.sub(r'-?\d+\.\d+', lambda m: format(round(float(m[0]), 3), 'g'), pen.getCommands())
        outlines[case['key']] = {'width': 1000, 'd': path, 'category': category}
        continue
    # Normalize visible ink height, not the font's em box. Width may change
    # independently at layout time so long labels retain their visual height.
    height = 880 if category in ('A', 'B', 'C') else 750 if category == 'F' else 900
    if text in 'ぁぃぅぇぉゃゅょっゎ' and len(text) == 1:
        height *= .75
    # Small punctuation must stay small: normalizing an ellipsis to a capital's
    # ink height would turn its three dots into large circles.
    sy = 1000 / font['head'].unitsPerEm if text == '…' else height / (y1 - y0)
    sx = sy * (1.2 if category == 'F' else 1)
    width = (x1 - x0) * sx
    pen = SVGPathPen(glyphs); advance = 0
    for char in text:
        glyph = cmap[ord(char)]
        glyphs[glyph].draw(TransformPen(pen, (sx, 0, 0, -sy, (advance - x0) * sx, (y0 + y1) / 2 * sy)))
        advance += font['hmtx'][glyph][0]
    path = re.sub(r'-?\d+\.\d+', lambda m: format(round(float(m[0]), 3), 'g'), pen.getCommands())
    outlines[case['key']] = {'width': round(width, 3), 'd': path, 'category': category}
(root / 'src/stamp-outlines.json').write_text(json.dumps(outlines, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Generated {len(outlines)} fixed labels; source fonts verified by SHA256.')
