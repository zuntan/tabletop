import { t } from './i18n';
import { uiAttribute } from './i18n/dom';
import { stationeryButton } from './stationery-button';
import { createIcon } from './icons';

/** Apply the previous choice with the main face; open the palette separately. */
export function stationerySplitButton(kind:'stamp'|'sticker'){
 const button=document.createElement('button');button.type='button';button.id=`${kind}-open`;
 stationeryButton(button,kind,t(kind==='stamp'?'badges:stampApply':'badges:stickerApply'));
 const menu=document.createElement('button');menu.type='button';menu.id=`${kind}-menu`;menu.className='stationery-menu';
 menu.append(createIcon('chevron-down',12));uiAttribute(button,'aria-label',kind==='stamp'?'badges:stampApply':'badges:stickerApply');
 for(const attr of ['title','aria-label'] as const)uiAttribute(menu,attr,kind==='stamp'?'badges:stampList':'badges:stickerList');
 return{button,menu};
}
