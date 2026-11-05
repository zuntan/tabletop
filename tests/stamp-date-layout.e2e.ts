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

test('date labels use two explicit weights and preserve shared heights and divider gaps',{timeout:45000},async()=>{
 const {page,call,close,errors}=await openTestDesk('stamp-date-groups');
 try{
  const {patterns}=await call('desk_stamp_patterns');
  await call('desk_execute',{operations:patterns.map((p:any)=>({kind:'add',object:{id:p.id,type:'text',x:0,y:0,width:480,height:360,text:'',stamp:{designId:p.id,text:'2026.11.05',angle:0}}}))});
  const labels=await page.locator('[data-id] [data-stamp-date]').evaluateAll(nodes=>nodes.map(node=>{
   const n=node as SVGGraphicsElement,root=n.closest('[data-stamp]') as SVGGraphicsElement,b=n.getBBox();
   const lines=[...root.querySelectorAll('path')].filter(p=>/^M\s*-?[\d.]+[ ,]+-?[\d.]+\s*H\s*-?[\d.]+$/.test(p.getAttribute('d')??''));
   const bottom=lines.map(p=>{const box=p.getBBox(),m=root.getCTM()!.inverse().multiply(p.getCTM()!);return new DOMPoint(box.x,box.y).matrixTransform(m).y;});
   return{id:root.getAttribute('data-stamp'),family:n.getAttribute('font-family'),weight:Number(n.getAttribute('font-weight')),height:b.height,top:b.y,divider:bottom.length?Math.max(...bottom):null};
  }));
  assert.equal(labels.length,patterns.length);
  assert.deepEqual([...new Set(labels.map(n=>n.weight))].sort(),[400,600]);
  for(const label of labels){assert.equal(label.family,'monospace');if(label.divider!==null)assert.ok(label.top>label.divider+1,JSON.stringify(label));}
  for(const ids of [['done_ja','confidential_ja','pass_ja','fail_ja','read_ja','unread_ja'],['unread_en','read_en','good_en','bad_en'],['copy_paste_only_ja','wanted_ja'],['hanamaru_ja','smile_ja','well_done_ja','keep_going_ja']]){
   const heights=ids.map(id=>labels.find(n=>n.id===id)!.height);assert.ok(Math.max(...heights)-Math.min(...heights)<.01,JSON.stringify({ids,heights}));
  }
  assert.deepEqual(errors,[]);
 }finally{await close();}
});
