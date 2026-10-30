/** Minimal one-page PDF with a single composited JPEG. No print layout or document editor. */
export function jpegPagePdf(jpeg:Uint8Array,width:number,height:number,title='Tabletop',page={width,height}) {
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>32768||height>32768)throw new Error('Invalid PDF image dimensions');
 if(!Number.isFinite(page.width)||!Number.isFinite(page.height)||page.width<=0||page.height<=0)throw new Error('Invalid PDF page dimensions');
 if(jpeg[0]!==0xff||jpeg[1]!==0xd8)throw new Error('Expected JPEG');
 // PDF 1.4 readers commonly cap a page at 14,400 pt. Uniform scaling preserves aspect.
 const factor=Math.min(.75,14400/Math.max(page.width,page.height));
 const pw=Number((page.width*factor).toFixed(6)),ph=Number((page.height*factor).toFixed(6));
 const encoder=new TextEncoder(),text=(s:string)=>encoder.encode(s);
 const metadata='FEFF'+[...title.slice(0,100)].flatMap(char=>{const bytes=[];for(let i=0;i<char.length;i++)bytes.push(char.charCodeAt(i).toString(16).padStart(4,'0'));return bytes;}).join('');
 const content=text(`q\n${pw} 0 0 ${ph} 0 0 cm\n/DeskImage Do\nQ\n`);
 const objects:Uint8Array[][]=[
  [text('<< /Type /Catalog /Pages 2 0 R >>')],
  [text('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')],
  [text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /DeskImage 4 0 R >> >> /Contents 5 0 R >>`)],
  [text(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,text('\nendstream')],
  [text(`<< /Length ${content.length} >>\nstream\n`),content,text('endstream')],
  [text(`<< /Title <${metadata}> /Creator (Tabletop) /Producer (Tabletop raster export) >>`)],
 ];
 const chunks:Uint8Array[]=[text('%PDF-1.4\n%Tabletop\n')],offsets=[0];let length=chunks[0].length;
 for(let i=0;i<objects.length;i++){
  offsets.push(length);const parts=[text(`${i+1} 0 obj\n`),...objects[i],text('\nendobj\n')];
  for(const part of parts){chunks.push(part);length+=part.length;}
 }
 const start=length;
 chunks.push(text(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${start}\n%%EOF\n`));
 const result=new Uint8Array(chunks.reduce((sum,c)=>sum+c.length,0));let cursor=0;for(const chunk of chunks){result.set(chunk,cursor);cursor+=chunk.length;}
 return result;
}
/** Equal outer breathing room, still visible when exporting a very large desk. */
export function pdfOuterBounds(bounds:{x:number;y:number;width:number;height:number}){
 const margin=Math.max(24,Math.min(bounds.width,bounds.height)*.03);
 return{x:bounds.x-margin,y:bounds.y-margin,width:bounds.width+2*margin,height:bounds.height+2*margin};
}
export function pdfRasterSize(width:number,height:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid desk bounds');
 const scale=Math.min(2,8192/Math.max(width,height),Math.sqrt(32_000_000/(width*height)));
 return{width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale};
}
