import { stationeryButton } from './stationery-button';
import { createIcon } from './icons';

/** Apply the previous choice with the main face; open the palette separately. */
export function stationerySplitButton(kind:'stamp'|'sticker',name:string){
 const button=document.createElement('button');button.type='button';button.id=`${kind}-open`;
 stationeryButton(button,kind,`${name}を適用`);
 const menu=document.createElement('button');menu.type='button';menu.id=`${kind}-menu`;menu.className='stationery-menu';
 menu.append(createIcon('chevron-down',12));menu.title=`${name}一覧`;menu.setAttribute('aria-label',`${name}一覧`);
 return{button,menu};
}
