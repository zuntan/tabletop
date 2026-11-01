import {mkdtemp,open,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {TransferSink} from './binary-transfer';
/** Incoming chunks are acknowledged only after being written to a private temp file. */
export async function temporaryTransferSink():Promise<TransferSink>{
 const directory=await mkdtemp(join(tmpdir(),'tabletop-transfer-')),path=join(directory,'payload');
 const file=await open(path,'wx',0o600);let closed=false;
 const close=async()=>{if(!closed){closed=true;await file.close();}};
 return{async write(bytes){await file.writeFile(bytes);},async finish(){await close();return readFile(path);},async dispose(){await close();await rm(directory,{recursive:true,force:true});}};
}
