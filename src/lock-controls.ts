import type { DeskObject } from './model';
import { lockSelectionState } from './object-lock';
import { iconButton } from './toolbar';

export const lockBodyPath = 'M5 9h14v12H5z M8 9V6a4 4 0 0 1 8 0v3';
function icon() {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'aria-hidden': 'true' })) node.setAttribute(key, value);
  const path = document.createElementNS(node.namespaceURI, 'path'); path.setAttribute('d', lockBodyPath); node.append(path);
  return node;
}
export function createLockControls(snap: HTMLElement, form: HTMLFormElement, toggle: () => void) {
  const toolbar = document.createElement('button'); toolbar.type = 'button'; toolbar.id = 'mouse-lock';
  iconButton(toolbar, '', 'マウス操作をロック');
  toolbar.querySelector('.tool-icon')!.append(icon());
  toolbar.querySelector('.tool-caption')!.textContent = 'ロック';
  snap.after(toolbar);
  const propertyControl = document.createElement('div'); propertyControl.className = 'property-lock-control';
  const propertyLabel = document.createElement('span'); propertyLabel.id = 'property-lock-label'; propertyLabel.className = 'property-lock-label'; propertyLabel.textContent = 'マウス操作のロック';
  const property = document.createElement('button'); property.type = 'button'; property.id = 'property-lock'; property.className = 'property-lock-switch';
  property.setAttribute('role', 'switch'); property.setAttribute('aria-labelledby', propertyLabel.id);
  const propertyTrack = document.createElement('span'); propertyTrack.className = 'thinking-switch-track'; propertyTrack.setAttribute('aria-hidden', 'true');
  const propertyState = document.createElement('span'); propertyState.className = 'thinking-switch-state'; propertyState.setAttribute('aria-hidden', 'true');
  property.append(propertyTrack, propertyState);
  const propertyMixedAction = document.createElement('button'); propertyMixedAction.type = 'button'; propertyMixedAction.id = 'property-lock-mixed'; propertyMixedAction.textContent = '→ ON'; propertyMixedAction.hidden = true;
  propertyMixedAction.setAttribute('aria-label', '選択中のすべてをロック');
  propertyControl.append(propertyLabel, property, propertyMixedAction);
  form.closest('.sidebar-panel')?.prepend(propertyControl);
  for (const button of [toolbar, property, propertyMixedAction]) {
    button.onclick = toggle;
    // Preserve native keyboard activation instead of canvas Space-to-pan handling.
    button.onkeydown = event => { if (event.key === ' ' || event.key === 'Enter') event.stopPropagation(); };
  }
  return {
    update(objects: DeskObject[]) {
      const state = lockSelectionState(objects);
      const title = `${state.pressed === 'mixed' ? '一部ロック中' : state.pressed === 'true' ? 'ロック中' : 'ロックなし'}：マウスの移動・サイズ変更・端点変更を防ぎます。ダブルクリック編集・プロパティ・AI操作は可能です。`;
      toolbar.disabled = state.disabled; toolbar.setAttribute('aria-pressed', state.pressed); toolbar.title = title;
      property.hidden = state.pressed === 'mixed'; property.disabled = state.disabled;
      property.setAttribute('aria-checked', String(state.pressed === 'true')); property.title = title;
      propertyState.textContent = state.pressed === 'true' ? 'ON' : 'OFF';
      propertyMixedAction.hidden = state.pressed !== 'mixed'; propertyMixedAction.disabled = state.disabled;
      propertyMixedAction.title = title;
    },
  };
}
