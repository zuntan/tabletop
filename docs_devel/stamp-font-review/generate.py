from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from xml.sax.saxutils import escape
import json
root=Path('/tmp/tabletop-selected-fonts');outdir=root/'svg';outdir.mkdir(exist_ok=True)
rows=[('a','A / Japanese Mincho','notoserifjp','Noto Serif JP',900,['済　却下　封印　保留','合格　不合格　現物確認']),('b','B / Japanese Bold Gothic','notosansjp','Noto Sans JP',900,['しらんがな　なんでやねん','がんばりましょう　よくできました']),('c','C / Japanese Rounded Gothic','zenmarugothic','Zen Maru Gothic',700,['済　却下　封印　保留','しらんがな　なんでやねん']),('d','D / Sharp Serif','librebodoni','Libre Bodoni',700,['DONE   GOOD   BAD   EXCELLENT','CONFIDENTIAL   REJECTED   ON HOLD']),('e','E / Heavy Sans','anton','Anton',400,['DONE   GOOD   BAD   EXCELLENT','CONFIDENTIAL   REJECTED   ON HOLD']),('f','F / Soft Symbols','chewy','Chewy',400,[])]
def label(t,x,y,size=32):return f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="#334155">{escape(t)}</text>'
manifest=[]
for key,title,slug,family,weight,texts in rows:
 file=root/slug/'ZenMaruGothic-Bold.ttf' if slug=='zenmarugothic' else next((root/slug).glob('*.ttf'))
 font=TTFont(file)
 if 'fvar' in font:font=instantiateVariableFont(font,{'wght':weight},inplace=False)
 glyphs=font.getGlyphSet();cmap=font.getBestCmap();upm=font['head'].unitsPerEm
 def path(text,x,y,size,wide=1,stroke=0):
  missing=[c for c in text if ord(c) not in cmap]
  assert not missing,(family,missing)
  adv=sum(font['hmtx'][cmap[ord(c)]][0] for c in text);size=min(size,2208*upm/(adv*wide));s=size/upm;pen=SVGPathPen(glyphs)
  for c in text:
   glyphs[cmap[ord(c)]].draw(TransformPen(pen,(s*wide,0,0,-s,x,y)));x+=font['hmtx'][cmap[ord(c)]][0]*s*wide
  return f'<path fill="#c93428" stroke="#c93428" stroke-width="{stroke}" stroke-linejoin="round" d="{pen.getCommands()}"/>'
 license='Apache-2.0' if key=='f' else 'SIL OFL 1.1'
 parts=['<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1000" viewBox="0 0 2400 1000">',f'<title>{family} weight {weight}</title>','<rect width="2400" height="1000" rx="24" fill="white"/>','<rect width="2400" height="170" rx="24" fill="#eff6ff"/>',label(title,72,85,54),label('Selected family / provisional weight and proportions',72,140),label(f'{family} / weight {weight} / {license}',72,250,46)]
 if key!='f':
  for i,t in enumerate(texts):parts.append(path(t,96,530+i*250,155 if i==0 else 130))
 else:
  for i,(caption,wide,stroke) in enumerate([('Original',1,0),('Width 120%',1.2,0),('Slightly heavier (+3 SVG units)',1,3)]):
   x=80+i*780;parts.append(label(caption,x,350,30));parts.append(path('! ?',x+100,750,430,wide,stroke))
 parts.extend([label('Red specimens: SVG paths. No external font or embedded font file.',72,900,30),label('Source: google/fonts. License and exact source hashes retained separately.',72,950,28),'</svg>'])
 (outdir/(key+'.svg')).write_text('\n'.join(parts));manifest.append({'key':key,'family':family,'weight':weight,'file':file.name,'license':license})
(root/'specimens.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
