import { constants } from 'node:fs';
import { mkdir, realpath, open, lstat, rename, unlink, link } from 'node:fs/promises';
import { resolve, join, dirname, basename, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { MAX_DESK_FILE_BYTES } from './desk-file';

export function validateDeskFilename(name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.tabletop$/.test(name)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(name)) {
    throw new Error('Use a simple filename ending in .tabletop (letters, digits, dash, underscore; no paths)');
  }
  return name;
}
/** The configured root and its parents must be trusted, local directories. */
export class DeskFileStore {
  constructor(private root = process.env.TABLETOP_SAVE_ROOT ?? join(homedir(), '.tabletop', 'saves'), private extension = '.tabletop') {}
  async reference(value: string): Promise<string> {
    if (!value || value.length > 4096 || /[\x00-\x1f]/.test(value) || !value.endsWith(this.extension)) throw new Error(`保存先には${this.extension}ファイルのパスを指定してください`);
    if (!isAbsolute(value) && basename(value) !== value) throw new Error('相対指定はファイル名のみ使用できます。別の場所は絶対パスで指定してください');
    const path = isAbsolute(value) ? resolve(value) : resolve(this.root, value);
    if (!isAbsolute(value)) await mkdir(resolve(this.root), {recursive:true,mode:0o700});
    return join(await realpath(dirname(path)), basename(path));
  }
  async writeReference(value:string, bytes:Uint8Array, overwrite=false):Promise<string>{
    if(!bytes.length||bytes.length>MAX_DESK_FILE_BYTES)throw new Error('Invalid desk file size');
    const path=await this.reference(value);
    let before;
    try{before=await lstat(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    if(before&&(!before.isFile()||before.isSymbolicLink()))throw new Error('Desk file must be a regular file, not a symlink');
    if(before&&!overwrite)throw new Error('同名ファイルが存在します。上書きの確認が必要です');
    const temporary=join(dirname(path),`.tabletop-${crypto.randomUUID()}.tmp`);
    const file=await open(temporary,'wx',0o600);
    try{
      await file.writeFile(bytes);await file.sync();await file.close();
      if(overwrite){
        const now=await lstat(path).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
        if(now&&(!now.isFile()||now.isSymbolicLink()||!before||now.ino!==before.ino||now.dev!==before.dev||now.mtimeMs!==before.mtimeMs||now.size!==before.size))throw new Error('保存先が処理中に変更されました');
        if(before&&!now)throw new Error('保存先が処理中に削除されました');
        await rename(temporary,path);
      }else{await link(temporary,path);await unlink(temporary);}
      return path;
    }finally{await file.close().catch(()=>{});await unlink(temporary).catch(()=>{});}
  }
  async readReference(value:string){return this.readPath(await this.reference(value));}
  private async path(name: string) {
    validateDeskFilename(name);
    await mkdir(resolve(this.root), { recursive: true, mode: 0o700 });
    return join(await realpath(resolve(this.root)), name);
  }
  async save(name: string, bytes: Uint8Array): Promise<string> {
    if (!bytes.length || bytes.length > MAX_DESK_FILE_BYTES) throw new Error('Invalid desk file size');
    const path = await this.path(name);
    const file = await open(path, 'wx', 0o600);
    try { await file.writeFile(bytes); await file.sync(); }
    finally { await file.close(); }
    return path;
  }
  async load(name: string): Promise<Uint8Array> {
    return this.readPath(await this.path(name));
  }
  private async readPath(path:string):Promise<Uint8Array>{
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink()) throw new Error('Desk file must be a regular file, not a symlink');
    const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const info = await file.stat();
      if (!info.isFile() || info.ino !== before.ino || info.dev !== before.dev || info.size > MAX_DESK_FILE_BYTES) throw new Error('Desk file changed or exceeds 50 MiB');
      // Read one extra byte so growth after stat cannot bypass the size ceiling.
      const bytes = Buffer.alloc(Math.min(info.size + 1, MAX_DESK_FILE_BYTES + 1));
      let length = 0;
      while (length < bytes.length) {
        const result = await file.read(bytes, length, bytes.length - length, length);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      const after = await file.stat();
      if (!length || length !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs) throw new Error('Desk file changed during reading');
      return bytes.subarray(0, length);
    } finally { await file.close(); }
  }
}
