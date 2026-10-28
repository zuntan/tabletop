import QRCode from 'qrcode';

export type RenderedQr={svg:string;src:string;status:'ready'|'too-long'|'empty'};
export const defaultQrText='https://github.com/zuntan/tabletop';
const cache=new Map<string,Promise<RenderedQr>>();

/** The input is encoded verbatim. Generated SVG is a view cache, never saved data. */
export function renderQrCode(text:string):Promise<RenderedQr>{
  const known=cache.get(text);if(known){cache.delete(text);cache.set(text,known);return known;}
  const task=(async():Promise<RenderedQr>=>{
    let svg:string,status:RenderedQr['status']='ready';
    if(!text.length){
      status='empty';svg='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="white"/><text x="150" y="150" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="18" fill="#64748b">文字を入力してください</text></svg>';
    }else{
      try{svg=await QRCode.toString(text,{type:'svg'});}
      catch(error){
        if(!(error instanceof Error)||!error.message.includes('amount of data is too big'))throw error;
        status='too-long';svg=await QRCode.toString('長すぎます',{type:'svg'});
        const size=Number(/viewBox="0 0 (\d+) (\d+)"/.exec(svg)?.[1]);
        if(!size)throw new Error('QRコードの表示寸法を取得できませんでした');
        svg=svg.replace('</svg>',`<rect x="2" y="${size*.36}" width="${size-4}" height="${size*.28}" rx=".5" fill="white" stroke="black" stroke-width=".45"/><text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${size*.12}" font-weight="bold" fill="black">長すぎます</text></svg>`);
      }
    }
    return {svg,src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,status};
  })();
  cache.set(text,task);while(cache.size>32)cache.delete(cache.keys().next().value!);return task;
}
