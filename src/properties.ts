import {isUrlLink} from './link-values';
import { objectPropertyNames } from './object-properties';
import { isShapeType } from './shape-definitions';
import type { DeskObject } from './model';
import { isConnector } from './geometry';
import { headSelectedProp } from './prop-selection';
import { supportsFill, transparencyPercent, opacityFromPercent } from './fill-opacity';

const fields = ['fixedWidth','linkDisplay','wayfinderMode','propSelection','rulerMode','rulerMaterial','rulerThickness','x', 'y', 'x2', 'y2', 'width', 'height', 'fill', 'fillOpacity', 'stroke', 'strokeWidth', 'junctionRounding', 'dash', 'startMarker', 'endMarker', 'calloutMode', 'textFit', 'fontSize', 'cornerRadius', 'padding', 'text', 'mermaidSource', 'qrText', 'url','clipOffset','clipOffsetMode','clipOffsetPercent','clipSize','clipAutoSize','clipAnchor','clipStyle'] as const;
const numeric = new Set(['rulerThickness','x', 'y', 'x2', 'y2', 'width', 'height', 'strokeWidth', 'junctionRounding', 'fontSize', 'cornerRadius', 'padding','clipOffset','clipOffsetPercent','clipSize']);
export function syncProperties(form: HTMLFormElement, object: DeskObject) {
  const connector = isConnector(object);
  const meaningful = new Set<string>(objectPropertyNames(object));
  for (const name of fields) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    if (!input) continue;
    if(name==='fixedWidth'){input.disabled=!connector;input.closest('label')!.hidden=!connector;input.value=String(object.fixedWidth??false);continue;}
    if(name==='linkDisplay'){
      input.disabled=!isUrlLink(object);input.closest('label')!.hidden=input.disabled;input.value=propertyValue(object,name);
      for(const button of form.querySelectorAll<HTMLButtonElement>('[data-link-display]')){button.disabled=input.disabled;button.setAttribute('aria-pressed',String(button.dataset.linkDisplay===input.value));}
      continue;
    }
    if(name==='wayfinderMode'){
      input.disabled=object.type!=='wayfinder';input.closest('label')!.hidden=input.disabled;input.value=propertyValue(object,name);
      for(const button of form.querySelectorAll<HTMLButtonElement>('[data-wayfinder-mode]')){button.disabled=input.disabled;button.setAttribute('aria-pressed',String(button.dataset.wayfinderMode===input.value));}
      continue;
    }
    if(name==='propSelection'){
      input.disabled=object.type!=='prop';input.closest('label')!.hidden=object.type!=='prop';input.value=propertyValue(object,name);
      const button=form.querySelector<HTMLButtonElement>('#prop-head-selection');
      if(button){const head=headSelectedProp(object);button.disabled=input.disabled;button.setAttribute('aria-checked',String(head));button.querySelector('.thinking-switch-state')!.textContent=head?'ON':'OFF';}
      continue;
    }
    if(name.startsWith('ruler')){input.disabled=object.type!=='ruler';input.closest('label')!.hidden=object.type!=='ruler';input.value=propertyValue(object,name);continue;}
    if(name.startsWith('clip')) {
      const percent=object.clipOffsetMode==='percent'||object.clipOffsetMode==='base-short-side';
      input.disabled=object.type!=='clip'||(name==='clipSize'&&!!object.clipAutoSize);
      input.closest('label')!.hidden=object.type!=='clip'||name==='clipOffset'&&percent||name==='clipOffsetPercent'&&!percent;
      input.value=propertyValue(object,name);
      if(name==='clipSize')input.title=object.clipAutoSize?'数値指定へ戻したときのサイズを保持しています':'';
      continue;
    }
    if(name==='qrText'){input.disabled=object.type!=='qrcode';input.closest('label')!.hidden=input.disabled;input.value=object.qrText??'';continue;}
    if (name === 'mermaidSource') {
      input.disabled = object.type !== 'mermaid'; input.closest('label')!.hidden = object.type !== 'mermaid';
      input.value = object.mermaidSource ?? ''; continue;
    }
    if (name === 'junctionRounding') {
      input.disabled = !connector; input.closest('label')!.hidden = !connector;
      input.value = String(object.junctionRounding ?? 0); continue;
    }
    if (name === 'textFit') {
      input.disabled = !isShapeType(object.type); input.closest('label')!.hidden = !isShapeType(object.type);
      input.value = object.textFit ?? 'fixed'; continue;
    }
    if (name === 'calloutMode') {
      input.disabled = object.type !== 'text'; input.closest('label')!.hidden = object.type !== 'text';
      input.value = object.callout ? object.callout.style ?? 'speech' : 'none'; continue;
    }
    if (name === 'dash' || name === 'startMarker' || name === 'endMarker') {
      input.disabled = !connector; input.closest('label')!.hidden = !connector;
      input.value = name === 'dash' ? object.dash ?? 'solid' : object[name] ?? 'none';
      continue;
    }
    if (!meaningful.has(name) || object.type==='clip' && (name==='width'||name==='height')) { input.disabled = true; input.closest('label')!.hidden = true; continue; }
    if(isUrlLink(object)&&object.linkDisplay==='qr'&&['fill','fillOpacity','stroke','strokeWidth','cornerRadius','fontSize'].includes(name)){input.disabled=true;input.closest('label')!.hidden=true;continue;}
    if (name === 'padding' || name === 'cornerRadius') {
      const applicable = object.type === 'text' || name === 'cornerRadius' && (object.type === 'roundedRect'||isUrlLink(object));
      input.disabled = !applicable; input.closest('label')!.hidden = !applicable;
      input.value = String(name === 'padding' ? object.padding ?? 6 : object.cornerRadius);
      continue;
    }
    if(name==='fontSize'&&isUrlLink(object)&&object.linkDisplay==='qr'){input.disabled=true;input.closest('label')!.hidden=true;continue;}
    if (name === 'text') input.closest('label')!.firstChild!.textContent = object.type === 'label' ? '説明文' : ['image', 'svg', 'mermaid', 'qrcode', 'prop','file','link'].includes(object.type) ? 'タイトル' : 'テキスト';
    if (name === 'url') input.closest('label')!.firstChild!.textContent = ['image', 'svg'].includes(object.type) ? 'URL（任意）' : 'URL';
    input.value = name === 'fillOpacity' ? String(transparencyPercent(object.fillOpacity))
      : String(object.type === 'label' && name === 'text' ? object.description ?? '' : object[name] ?? '');
    const endpoint = name === 'x2' || name === 'y2';
    const size = name === 'width' || name === 'height';
    input.disabled = (object.type === 'label' && !['x', 'y', 'text'].includes(name)) ||
      (connector && (name === 'fontSize' || name === 'text')) ||
      (endpoint && !connector) || (size && (connector || headSelectedProp(object))) || (name === 'fillOpacity' && !supportsFill(object)) ||
      (name === 'url' && !['web', 'link', 'image', 'svg'].includes(object.type));
    if (endpoint || size) input.closest('label')!.hidden = endpoint ? !connector : connector;
    if (name === 'fillOpacity' || name === 'fontSize' || name === 'text') input.closest('label')!.hidden = connector;
  }
}
export function propertyValue(object: DeskObject, key: string): string {
  if(key==='fixedWidth')return String(object.fixedWidth??false);
  if(key==='linkDisplay')return object.linkDisplay??'url';
  if(key==='wayfinderMode')return object.wayfinderMode??'move';
  if(key==='propSelection')return object.propSelection??'normal';
  if(key==='rulerMode')return object.rulerMode??'free';
  if(key==='rulerMaterial')return object.rulerMaterial??'acrylic';
  if(key==='rulerThickness')return String(object.rulerThickness??36);
  if (key === 'clipOffsetMode') return object.clipOffsetMode ?? 'fixed';
  if (key === 'clipOffsetPercent') return String(object.clipOffsetPercent ?? 30);
  if (key === 'clipAutoSize') return String(object.clipAutoSize ?? false);
  if (key === 'textFit') return object.textFit ?? 'fixed';
  if (key === 'calloutMode') return object.callout ? object.callout.style ?? 'speech' : 'none';
  if (key === 'text' && object.type === 'label') return object.description ?? '';
  if (key === 'fillOpacity') return String(transparencyPercent(object.fillOpacity));
  if (key === 'junctionRounding') return String(object.junctionRounding ?? 0);
  if (key === 'padding') return String(object.padding ?? 6);
  if (key === 'dash') return object.dash ?? 'solid';
  if (key === 'startMarker' || key === 'endMarker') return object[key] ?? 'none';
  return String(object[key as keyof DeskObject] ?? '');
}

export function propertyFieldPatch(key: string, value: string, object: DeskObject): Partial<DeskObject> {
  if (!(fields as readonly string[]).includes(key)) throw new Error('Unknown property');
  if (value === propertyValue(object, key)) return {};
  if(key==='fixedWidth'){if(object.type!=='line'||!['true','false'].includes(value))throw new Error('Invalid fixed width');return{fixedWidth:value==='true'};}
  if(key==='linkDisplay'){if(!isUrlLink(object)||!['url','qr'].includes(value))throw new Error('Invalid link display');return {linkDisplay:value as 'url'|'qr'};}
  if(key==='wayfinderMode'){
    if(object.type!=='wayfinder'||!['move','tour'].includes(value))throw new Error('Invalid wayfinder mode');
    return {wayfinderMode:value as 'move'|'tour'};
  }
  if(key==='propSelection'){
    if(object.type!=='prop'||!['normal','head'].includes(value))throw new Error('Invalid prop selection mode');
    return {propSelection:value as 'normal'|'head'};
  }
  if(headSelectedProp(object)&&['width','height'].includes(key))throw new Error('通常選択に戻すとリサイズできます');
  if(key==='clipOffsetMode'){
    if(object.type!=='clip'||!['fixed','percent','base-short-side'].includes(value))throw new Error('Invalid clip offset mode');
    return {clipOffsetMode:value as 'fixed'|'percent'|'base-short-side',...(value!=='fixed'&&object.clipOffsetPercent===undefined?{clipOffsetPercent:30}:{})};
  }
  if (key === 'clipAutoSize') {
    if (object.type !== 'clip' || !['true','false'].includes(value)) throw new Error('Invalid clip size mode');
    return { clipAutoSize: value === 'true' };
  }
  if ((numeric.has(key) || key === 'fillOpacity') && (!value.trim() || !Number.isFinite(Number(value)))) throw new Error('有効な数値を入力してください');
  if (key === 'textFit') {
    if (!isShapeType(object.type) || !['auto', 'shrink'].includes(value)) throw new Error('Invalid text fit mode');
    return { textFit: value as 'auto' | 'shrink' };
  }
  if (key === 'calloutMode') {
    if (object.type !== 'text' || !['none', 'speech', 'thought', 'leader'].includes(value)) throw new Error('Invalid callout mode');
    return { callout: value === 'none' ? null : { ...(object.callout ?? {
      x: object.x + object.width * .75, y: object.y + object.height + 80, binding: null }), style: value as 'speech' | 'thought' | 'leader' } };
  }
  const field = object.type === 'label' && key === 'text' ? 'description' : key;
  const parsed = key === 'fillOpacity' ? opacityFromPercent(value) : numeric.has(key) ? Number(value) : value;
  const patch: Record<string, unknown> = { [field]: parsed };
  if (isConnector(object)) {
    if ('x' in patch || 'y' in patch) patch.startBinding = null;
    if ('x2' in patch || 'y2' in patch) patch.endBinding = null;
  }
  return patch;
}
