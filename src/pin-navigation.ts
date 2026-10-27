import type {DeskObject} from './model';
import type {Series} from './settings';
import {pinThreadMembers} from './pin-series';
import type {Camera} from './camera-control';
import './pin-navigation.css';

export const pinRoot=(pin:DeskObject)=>({x:pin.x+pin.width/2,y:pin.y+pin.height});
export function pinNeighbours(scene:DeskObject[],series:Series,pinId:string){
  const pins=pinThreadMembers(scene,series),index=pins.findIndex(pin=>pin.id===pinId);
  return {previous:index>0?pins[index-1]:undefined,next:index>=0?pins[index+1]:undefined};
}

/** Screen-sized controls belong to the selection UI, never the desk document. */
export function createPinNavigation(canvas:SVGSVGElement,start:(id:string,direction:'previous'|'next')=>void){
  const panel=document.createElement('div');panel.id='pin-navigation';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','ピンの糸をたどる');
  let selectedId='';
  const buttons=(['previous','next'] as const).map(direction=>{
    const button=document.createElement('button');button.type='button';button.textContent=direction==='previous'?'◀':'▶';
    button.dataset.direction=direction;button.setAttribute('aria-label',direction==='previous'?'前のピンへ移動':'次のピンへ移動');
    button.title=button.getAttribute('aria-label')!;button.onclick=()=>start(selectedId,direction);panel.append(button);return button;
  });
  panel.addEventListener('pointerdown',event=>event.stopPropagation());panel.addEventListener('click',event=>event.stopPropagation());
  document.body.append(panel);
  return {update(pin:DeskObject|undefined,neighbours:ReturnType<typeof pinNeighbours>|undefined,camera:Camera,travelling:boolean){
    panel.hidden=true;if(!pin||!neighbours||travelling)return;
    selectedId=pin.id;buttons[0].disabled=!neighbours.previous;buttons[1].disabled=!neighbours.next;
    const rect=canvas.getBoundingClientRect(),root=pinRoot(pin),x=rect.left+camera.x+root.x*camera.zoom,y=rect.top+camera.y+root.y*camera.zoom;
    if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return;
    panel.hidden=false;
    const box=panel.getBoundingClientRect();
    panel.style.left=`${Math.max(rect.left+4,Math.min(x-box.width/2,rect.right-box.width-4))}px`;
    const above=y-pin.height-box.height-10;
    panel.style.top=`${above>=rect.top+4?above:Math.min(y+10,rect.bottom-box.height-4)}px`;
  }};
}
