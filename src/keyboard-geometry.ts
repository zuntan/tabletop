import {gestureOperations,type Gesture} from './diagram-gestures';
import {headSelectedProp} from './prop-selection';
import {fileFor} from './clear-files';
import {isConnector,resolveConnections} from './geometry';
import {snapInterval,type GridSettings} from './grid-settings';
import type {DeskObject,Operation} from './model';

export function keyboardGeometry(scene:DeskObject[],ids:string[],key:string,resize:boolean,alt:boolean,grid:GridSettings,zoom:number):Operation[]{
  const direction=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[key];
  if(!direction)return [];
  const originals=scene.filter(o=>ids.includes(o.id));
  const snapping=grid.enabled&&!alt,step=snapping?snapInterval(grid):1;
  const [dx,dy]=direction.map(n=>n*step);
  if(resize){
    if(originals.length!==1)return [];
    const o=originals[0];
    if(o.locked||isConnector(o)||['label','clip','file','ruler'].includes(o.type)||headSelectedProp(o)||fileFor(scene,o.id))return [];
    const minimum=Math.max(1,snapping?step:1);
    const size=(value:number,delta:number,min:number)=>Math.min(100000,Math.max(min,snapping?(delta>0?Math.floor(value/step+1e-9)+1:Math.ceil(value/step-1e-9)-1)*step:value+delta));
    const patch:Partial<DeskObject>={};
    if(dx)patch.width=size(o.width,dx,minimum);
    if(dy)patch.height=size(o.height,dy,Math.max(minimum,o.cutout&&o.type!=='text'?35:1));
    return [{kind:'update',id:o.id,patch}];
  }
  const gesture:Gesture={mode:'move',keyboard:true,start:{x:0,y:0},screen:{x:0,y:0},originals,scene,preview:scene,revision:0,camera:{x:0,y:0},additive:[],grid:snapping,gridSettings:grid};
  // Use existing container, anchor and junction movement rules.
  return gestureOperations(gesture,{x:dx,y:dy},zoom);
}

/** Like a mouse drag: lightweight previews, then one atomic commit on release. */
export class KeyboardGeometryEdit {
  scene:DeskObject[];
  private patches=new Map<string,Partial<DeskObject>>();
  constructor(readonly original:DeskObject[],readonly ids:string[],readonly grid:GridSettings){this.scene=original;}
  step(key:string,resize:boolean,alt:boolean,zoom:number){
    const operations=keyboardGeometry(this.scene,this.ids,key,resize,alt,this.grid,zoom);
    const patches=new Map(operations.flatMap(op=>op.kind==='update'?[[op.id,op.patch] as const]:[]));
    const next=resolveConnections(this.scene.map(o=>patches.has(o.id)?{...o,...patches.get(o.id)}:o),this.scene);
    for(const [id,patch] of patches)this.patches.set(id,{...this.patches.get(id),...patch});
    this.scene=next;
  }
  operations():Operation[]{return [...this.patches].map(([id,patch])=>({kind:'update',id,patch}));}
}
