import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestDesk} from './desk-browser';

test('decorative stamps keep dates below artwork and framed stamps keep dates inside borders',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('stamp-date-layout');
 const ids=['hanamaru_ja','smile_ja','well_done_ja','keep_going_ja','unread_ja','pass_ja','confidential_en','copy_paste_only_en'];
 try{
  await call('desk_execute',{operations:ids.map((designId,i)=>({kind:'add',object:{id:designId,type:'text',x:30+(i%4)*300,y:30+Math.floor(i/4)*330,width:280,height:280,text:'',stamp:{designId,text:'2026.10.31',angle:0}}}))});
  const boxes=await page.locator('[data-stamp-date]').evaluateAll(nodes=>nodes.map(node=>{
   const date=node as SVGGraphicsElement,b=date.getBBox(),parent=date.parentElement as unknown as SVGGraphicsElement;
   const clone=parent.cloneNode(true) as SVGGraphicsElement;clone.removeAttribute('transform');clone.querySelectorAll('[data-stamp-date]').forEach(n=>n.remove());parent.append(clone);const artwork=clone.getBBox();clone.remove();
   return{mode:date.getAttribute('data-stamp-date'),date:{x:b.x,y:b.y,width:b.width,height:b.height},art:{x:artwork.x,y:artwork.y,width:artwork.width,height:artwork.height},size:Number(date.getAttribute('font-size'))};
  }));
  assert.equal(boxes.length,8);
  for(const b of boxes.filter(b=>b.mode==='footer'))assert.ok(b.date.y>b.art.y+b.art.height,JSON.stringify(b));
  for(const b of boxes.filter(b=>b.mode==='inside'))assert.ok(b.date.y+b.date.height<b.art.y+b.art.height,JSON.stringify(b));
  await call('desk_camera_move',{center:{x:620,y:350},zoom:1,durationMs:0});
  await page.screenshot({path:'/tmp/tabletop-stamp-date-layout.png'});assert.deepEqual(errors,[]);
 }finally{await close();}
});
