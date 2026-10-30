import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jpegPagePdf,pdfRasterSize,pdfOuterBounds} from '../src/pdf-document';
test('PDF outer margin uses the short side and preserves the content center',()=>{
 assert.deepEqual(pdfOuterBounds({x:-10,y:20,width:100,height:200}),{x:-34,y:-4,width:148,height:248});
 assert.deepEqual(pdfOuterBounds({x:-1000,y:500,width:10000,height:20000}),{x:-1300,y:200,width:10600,height:20600});
 assert.deepEqual(pdfOuterBounds({x:500,y:-1000,width:20000,height:10000}),{x:200,y:-1300,width:20600,height:10600});
});
test('PDF is one page, has exact object byte offsets, and fits large pages uniformly',()=>{
 const bytes=jpegPagePdf(new Uint8Array([255,216,255,217]),10,20,'日本語',{width:100_000,height:50_000});
 const pdf=new TextDecoder('latin1').decode(bytes);
 assert.match(pdf,/\/Count 1/);assert.match(pdf,/\/MediaBox \[0 0 14400 7200\]/);
 const start=Number(/startxref\n(\d+)/.exec(pdf)![1]);assert.equal(pdf.slice(start,start+4),'xref');
 const rows=pdf.slice(start).split('\n').slice(3,9);
 rows.forEach((row,i)=>assert.ok(pdf.slice(Number(row.slice(0,10))).startsWith(`${i+1} 0 obj`)));
 for(const [w,h]of [[100,200],[1_000_000,300_000]]){const r=pdfRasterSize(w,h);assert.ok(r.width<=8192&&r.height<=8192&&r.width*r.height<=32_000_000);}
 assert.throws(()=>jpegPagePdf(new Uint8Array(),10,20));
});
