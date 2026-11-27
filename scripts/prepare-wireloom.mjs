import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const upstream=new URL('node_modules/wireloom/',root);
const target=new URL('src/vendor/wireloom/',root);
const pkg=JSON.parse(await readFile(new URL('package.json',upstream),'utf8'));
if(pkg.version!=='0.7.0')throw new Error('Review the Wireloom width patch before upgrading');
const original=await readFile(new URL('dist/index.js',upstream),'utf8');
const hash=createHash('sha256').update(original).digest('hex');
if(hash!=='d7507958e4e48d7e1cb13937f8a4346045a46add852bfabcb611f58761f4ac2f')throw new Error('Wireloom distribution changed; review the width patch');
let count=0;
let patched=original.replace(/([\w.]+)\.length \* theme\.averageCharWidth/g,(_,text)=>{count++;return `tabletopTextWidth(${text}, theme)`;});
patched=patched.replace('text.length * charW','text.length * charW + tabletopExtraWidth(text, theme) * (charW / theme.averageCharWidth)');
if(count!==38)throw new Error(`Wireloom width patch expected 38 sites; found ${count} (SHA256 ${hash})`);
function replaceOnce(from,to) {
  if(!patched.includes(from)||patched.indexOf(from)!==patched.lastIndexOf(from))throw new Error('Review Wireloom wrap patch: '+from.slice(0,60));
  patched=patched.replace(from,to);
}
replaceOnce('  text: {\n    attrs: {','  text: {\n    attrs: {\n      width: { kind: "number" },');
replaceOnce('function measureText(node, theme) {\n  return {','function measureText(node, theme) {\n  if (getAttrNumber(node.attributes, "width") !== undefined) return tabletopTextBlock(node, theme);\n  return {');
replaceOnce('function positionText(node, x, y, width, theme) {\n  return {','function positionText(node, x, y, width, theme) {\n  if (getAttrNumber(node.attributes, "width") !== undefined) return {node, x, y, ...tabletopTextBlock(node, theme), children: []};\n  return {');
replaceOnce('function emitText(laid, theme, out) {\n  const node = laid.node;','function emitText(laid, theme, out) {\n  const node = laid.node;\n  if (getAttrNumber(node.attributes, "width") !== undefined) {\n    const block=tabletopTextBlock(node,theme), style=textStyle(node.attributes,theme), step=textLineHeight(node.attributes,theme);\n    block.lines.forEach((line,index)=>out.push(`<text x="${laid.x}" y="${laid.y+step*(index+.75)}"${style}>${escapeText(line)}</text>`));\n    return;\n  }');
replaceOnce('title.length * (theme.averageCharWidth * (theme.titleFontSize / theme.fontSize))','title.length * (theme.averageCharWidth * (theme.titleFontSize / theme.fontSize)) + tabletopExtraWidth(title, theme) * (theme.titleFontSize / theme.fontSize)');
replaceOnce('node.value.length * textSizeScale(node.attributes, theme) * theme.averageCharWidth','node.value.length * textSizeScale(node.attributes, theme) * theme.averageCharWidth + tabletopExtraWidth(node.value, theme) * textSizeScale(node.attributes, theme)');
const helper=`
// Tabletop: retain upstream estimates for Latin text, count full-width glyphs at font size.
function tabletopExtraWidth(text, theme) {
  let extra = 0;
  for (const char of text) if (!/[\\uff61-\\uff9f]/u.test(char) && /[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\u3000-\\u303f\\uff01-\\uff60\\uffe0-\\uffe6]/u.test(char)) extra += theme.fontSize - char.length * theme.averageCharWidth;
  return extra;
}
function tabletopTextWidth(text, theme) {
  return text.length * theme.averageCharWidth + tabletopExtraWidth(text, theme);
}
function tabletopTextBlock(node, theme) {
  const width = getAttrNumber(node.attributes, "width");
  if(getAttr(node.attributes, "width").unit!=="px"||!Number.isFinite(width)||width<1||width>100000)throw new WireloomError('text width must be between 1 and 100000 pixels',node.position.line,node.position.column);
  const lines=wrapWireloomText(node.content,width,value=>textWidth(value,node.attributes,theme));
  return {width,height:lines.length*textLineHeight(node.attributes,theme),lines};
}
`;
patched=patched.replace(/\/\/# sourceMappingURL=.*\n?/g,'');
await mkdir(target,{recursive:true});
async function writeChanged(name,text) {
  const file=new URL(name,target);
  try{if((await readFile(file,'utf8')).replace(/\r\n?/g,'\n')===text)return;}catch(error){if(error.code!=='ENOENT')throw error;}
  await writeFile(file,text);
}
await writeChanged('index.js',`/*! Wireloom 0.7.0 | MIT | Stardock | Upstream SHA256: ${hash} | Tabletop text patch: scripts/prepare-wireloom.mjs */\nimport {wrapWireloomText} from '../../wireloom-text-layout.js';\n`+patched+helper);
await writeChanged('index.d.ts',await readFile(new URL('dist/index.d.ts',upstream),'utf8'));
await writeChanged('LICENSE',await readFile(new URL('LICENSE',upstream),'utf8'));
console.log(`Prepared Wireloom ${pkg.version}: ${count+3} text-width sites`);
