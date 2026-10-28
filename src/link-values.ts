import type {DeskObject} from './model';
export const isUrlLink=(object:DeskObject)=>object.type==='link'&&!object.deskPath;
export const isStyledLink=(object:DeskObject)=>isUrlLink(object)&&object.linkDisplay!=='qr';
