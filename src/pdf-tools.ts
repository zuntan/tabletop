import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {deskTargetFields,deskTargetDescription,type DeskRequestFactory} from './desk-target';
import {DeskFileStore} from './desk-file-store';
import {MAX_PDF_EXPORT_BYTES,pdfExportFields} from './pdf-export';

const renderedSchema=z.object({sessionId:z.string().uuid(),revision:z.number().int().nonnegative(),
  bounds:z.object({x:z.number().finite(),y:z.number().finite(),width:z.number().positive().finite(),height:z.number().positive().finite()}),
  raster:z.object({width:z.number().int().positive(),height:z.number().int().positive(),scale:z.number().positive().finite()}),
  webCount:z.number().int().nonnegative(),base64:z.string().max(Math.ceil(MAX_PDF_EXPORT_BYTES/3)*4)});

export function registerPdfTools(mcp:McpServer,forDesk:DeskRequestFactory,store=new DeskFileStore(undefined,'.pdf')){
  mcp.registerTool('desk_pdf',{
    description:deskTargetDescription+'Export the entire desk as a single-page PDF to a server-local path without opening a tab. Reuses human PDF rendering: wallpaper and offscreen objects included; editing/selection/pointing controls excluded; aspect ratio preserved, no A4 pagination. Output is rasterized at canonical 100% with browser/PDF size limits. path must be an absolute .pdf path with an existing parent, or a basename under TABLETOP_SAVE_ROOT. overwrite:true explicitly permits atomic replacement; otherwise existing files are preserved. Optional expectedRevision guards capture. Returns path, bytes, captured session/revision, bounds, raster dimensions and webCount (Web iframe bodies use placeholders). Does not edit the desk or mark it saved. Requires a connected compatible browser. No automatic retry. Maximum PDF transfer 14 MiB.',
    inputSchema:{...deskTargetFields,path:z.string().min(1).max(4096),overwrite:z.boolean().default(false),...pdfExportFields},
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false},
  },async({deskId,path,overwrite,expectedRevision}):Promise<CallToolResult>=>{
    try{
      const request=forDesk(deskId);
      const target=await store.reference(path);
      const {base64,...metadata}=renderedSchema.parse(await request({method:'pdf_export',expectedRevision}));
      const bytes=Buffer.from(base64,'base64');
      if(bytes.toString('base64')!==base64)throw new Error('Invalid PDF encoding');
      if(!bytes.length||bytes.length>MAX_PDF_EXPORT_BYTES||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-32).toString().includes('%%EOF'))throw new Error('Invalid PDF data or PDF exceeds 14 MiB');
      const saved=await store.writeReference(target,bytes,overwrite);
      return{content:[{type:'text',text:JSON.stringify({...metadata,path:saved,bytes:bytes.length,mimeType:'application/pdf'})}]};
    }catch(error){return{isError:true,content:[{type:'text',text:error instanceof Error?error.message:String(error)}]};}
  });
}
