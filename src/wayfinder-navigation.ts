import type {DeskObject} from './model';
import type {Camera} from './camera-control';
import {wayfinderDirection} from './wayfinder-drawing';
import './pin-navigation.css';
/** Like pin navigation, this control keeps a fixed clickable screen area at every zoom. */
export function createWayfinderNavigation(canvas:SVGSVGElement,start:(id:string)=>void){
 const panel=document.createElement('div');panel.id='wayfinder-navigation';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','道しるべの移動');
 const button=document.createElement('button');button.type='button';panel.append(button);let id='';button.onclick=()=>start(id);
 for(const name of ['pointerdown','click','keydown'])panel.addEventListener(name,e=>e.stopPropagation());
 document.body.append(panel);
 return{update(object:DeskObject|undefined,scene:DeskObject[],camera:Camera,travelling:boolean){
  panel.hidden=true;if(!object||travelling)return;
  const rect=canvas.getBoundingClientRect(),x=rect.left+camera.x+(object.x+object.width/2)*camera.zoom,top=rect.top+camera.y+object.y*camera.zoom,bottom=top+object.height*camera.zoom;
  if(x<rect.left||x>rect.right||bottom<rect.top||top>rect.bottom)return;
  id=object.id;button.dataset.wayfinderRun=id;
  const direction=wayfinderDirection(scene,id);button.textContent={top:'▲',right:'▶',bottom:'▼',left:'◀'}[direction];button.dataset.direction=direction;
  const title=object.wayfinderMode==='tour'?'観光を開始':'移動を開始';button.setAttribute('aria-label',title);button.title=title;
  button.disabled=!scene.some(o=>o.type==='line'&&(o.startBinding?.objectId===id||o.endBinding?.objectId===id));
  panel.hidden=false;const box=panel.getBoundingClientRect();
  panel.style.left=`${Math.max(rect.left+4,Math.min(x-box.width/2,rect.right-box.width-4))}px`;
  panel.style.top=`${Math.max(rect.top+4,Math.min(top-box.height-10>=rect.top+4?top-box.height-10:bottom+10,rect.bottom-box.height-4))}px`;
 }};
}
