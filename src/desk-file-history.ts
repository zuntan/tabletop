export type DeskHistoryEntry={path:string;name:string;usedAt:string};
const key='tabletop.files.recent.v1';
export class DeskFileHistory{
  private entries:DeskHistoryEntry[]=[];
  constructor(private storage:Pick<Storage,'getItem'|'setItem'>|null){
    try{const value=JSON.parse(storage?.getItem(key)??'[]');if(Array.isArray(value))this.entries=value.filter(e=>e&&typeof e.path==='string'&&e.path.length<=4096&&typeof e.name==='string'&&typeof e.usedAt==='string').slice(0,30);}catch{/* Storage is optional. */}
  }
  list(){return structuredClone(this.entries);}
  private persist(){try{this.storage?.setItem(key,JSON.stringify(this.entries));}catch{/* Session-only fallback. */}}
  record(path:string,name:string){this.entries=[{path,name,usedAt:new Date().toISOString()},...this.entries.filter(e=>e.path!==path)].slice(0,30);this.persist();}
  remove(path:string){this.entries=this.entries.filter(e=>e.path!==path);this.persist();}
}
