import type { DeskObject } from './model';
import type { Point } from './geometry';
import {snapInterval,type GridSettings} from './grid-settings';

export const gridInterval = 24;
const defaultGrid: GridSettings = { enabled: true, interval: gridInterval, origin: { x: 0, y: 0 } };
export function gridPoint(point: Point, grid: GridSettings = defaultGrid): Point {
  const step=snapInterval(grid);
  return { x: grid.origin.x + Math.round((point.x - grid.origin.x) / step) * step,
    y: grid.origin.y + Math.round((point.y - grid.origin.y) / step) * step };
}
export function gridOrigin(object: DeskObject): Point {
  return object.type === 'label' ? { x: object.x + object.width / 2, y: object.y + object.height }
    : { x: object.x, y: object.y };
}
export function gridMoveDelta(object: DeskObject, delta: Point, grid: GridSettings = defaultGrid): Point {
  const origin = gridOrigin(object);
  const point = gridPoint({ x: origin.x + delta.x, y: origin.y + delta.y }, grid);
  return { x: point.x - origin.x, y: point.y - origin.y };
}

/** Initial creation only. Copies use exact placement and preserve their geometry. */
export function newPartGridSize(object:Pick<DeskObject,'type'|'width'|'height'|'deskPath'|'linkDisplay'>,grid:GridSettings){
  const supported=['text','rect','roundedRect','ellipse','diamond','parallelogram','cylinder','document','cloud','web','mermaid','image','svg','qrcode','link'].includes(object.type);
  if(!grid.enabled||!supported)return {width:object.width,height:object.height};
  const step=snapInterval(grid);
  return {width:Math.ceil(object.width/step)*step,height:Math.ceil(object.height/step)*step};
}
