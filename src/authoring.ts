import { t, languageChangeEvent } from './i18n';
import { translateUi, uiText, uiAttribute } from './i18n/dom';
import {createStrokeWidthMode} from './stroke-width-mode';
import {tightFrame} from './pin-shape';
import {isStyledLink} from './link-values';
import { objectSchema, type Desk, type DeskObject, type Operation } from './model';
import { colorOperations, createColorControls } from './color-controls';
import { isConnector, isShape } from './geometry';
import { formatSchema, type Series } from './settings';
import { browserPinFitOperations,browserPinFrame } from './pin-fit';
import { opacityOperations, transparencyPercent, opacityFromPercent } from './fill-opacity';
import { iconButton } from './toolbar';
import { randomUuid } from './portable-crypto';
import { addNumberPresets, addFormNumberPresets, numberPresets } from './number-presets';
import { createLineStylePicker } from './line-style-picker';

export function createAuthoring(desk: Desk, toolbar: HTMLElement, panel: HTMLElement, button: HTMLButtonElement,
  selectButton: HTMLButtonElement, apply: (operations: Operation[], selectId?: string) => void, placementPoint: () => {x:number;y:number},report:(message:string,error?:boolean)=>void) {
  let chosen = 'series-1', selection = '';
  toolbar.innerHTML = '<div id="default-colors"></div><label data-i18n-title="authoring:width"><span data-i18n="authoring:width"></span><input id="default-width" type="number" min="0" max="100" step="any"></label><button id="numbering-settings" data-i18n-title="authoring:series" data-i18n-aria-label="authoring:series">⚑⚙</button>';
  translateUi(toolbar);
  const settingsButton = toolbar.querySelector<HTMLButtonElement>('#numbering-settings')!;
  iconButton(settingsButton, '⚑⚙', t('authoring:series'));
  const width = toolbar.querySelector<HTMLInputElement>('#default-width')!;
  const opacityLabel = document.createElement('label'); opacityLabel.append(uiText(document.createElement('span'), 'authoring:opacity'));
  const opacity = document.createElement('input'); opacity.id = 'default-opacity'; opacity.type = 'number';
  opacity.min = '0'; opacity.max = '100'; opacity.step = '1'; uiAttribute(opacity, 'aria-label', 'authoring:opacityLabel');
  opacityLabel.append(opacity); toolbar.insertBefore(opacityLabel, settingsButton);
  addNumberPresets(width, numberPresets.strokeWidth, t('authoring:width'));
  addNumberPresets(opacity, numberPresets.fillOpacity, t('authoring:opacity'));
  opacity.onchange = () => {
    const fillOpacity = opacityFromPercent(opacity.value);
    apply([{ kind: 'defaults_update', patch: { fillOpacity } }, ...opacityOperations(desk.selected().map(id => desk.get(id)), fillOpacity)]);
  };
  const defaults = createColorControls(toolbar.querySelector<HTMLElement>('#default-colors')!, operations => {
    const patch = operations[0]?.kind === 'update' ? operations[0].patch : {};
    const key = Object.keys(patch)[0] as 'fill' | 'stroke' | 'textColor';
    if (!key) return;
    apply([{ kind: 'defaults_update', patch }, ...colorOperations(desk.selected().map(id => desk.get(id)),
      key === 'textColor' ? 'text' : key, String(patch[key]))]);
  }, 'default-');
  width.onchange = () => {
    const value = Number(width.value), seen = new Set<string>();
    const operations: Operation[] = [{ kind: 'defaults_update', patch: { strokeWidth: value } }];
    for (const object of desk.selected().map(id => desk.get(id))) {
      if (object.type === 'label' && object.seriesId && !seen.has(object.seriesId)) {
        seen.add(object.seriesId); operations.push({ kind: 'series_update', id: object.seriesId, patch: { strokeWidth: value } });
      } else if (object.type !== 'label' && (isShape(object) || isConnector(object) || (['text','file'].includes(object.type)||isStyledLink(object)))) operations.push({ kind: 'update', id: object.id, patch: { strokeWidth: value } });
    }
    apply(operations);
  };
  panel.innerHTML = `<h2 data-i18n="authoring:series"></h2><select id="series-choice" data-i18n-aria-label="authoring:series"></select>
    <form id="series-settings"><label><span data-i18n="authoring:name"></span><input name="name" maxlength="100"></label>
    <label><span data-i18n="authoring:visibility"></span><select name="visibility" id="series-visibility"></select></label>
    <label><span data-i18n="authoring:format"></span><select name="format"></select></label><label><span data-i18n="authoring:shape"></span><select name="shape"><option value="pin" data-i18n="authoring:pin"></option><option value="text" data-i18n="authoring:textOnly"></option><option value="rect" data-i18n="authoring:rect"></option><option value="ellipse" data-i18n="authoring:ellipse"></option><option value="roundedRect" data-i18n="authoring:roundedRect"></option></select></label>
    <label><span data-i18n="authoring:boxWidth"></span><input name="width" type="number" min="1"></label><label><span data-i18n="authoring:height"></span><input name="height" type="number" min="1"></label>
    <label><span data-i18n="authoring:fontSize"></span><input name="fontSize" type="number" min="1" max="1000"></label>
    <button id="series-fit" type="button" data-i18n-title="authoring:fitHint" data-i18n="authoring:fit"></button>
    <label><span data-i18n="authoring:width"></span><input name="strokeWidth" type="number" min="0" max="100" step="any"></label>
    <label><span data-i18n="authoring:opacity"></span><input name="fillOpacity" type="number" min="0" max="100" step="1"></label>
    <div id="series-colors"></div><small id="series-info"></small>
    <fieldset><legend data-i18n="authoring:thread"></legend>
      <button id="thread-visible" type="button" role="switch" data-i18n-aria-label="authoring:showThread"><span data-i18n="authoring:showThread"></span><span class="thinking-switch-track" aria-hidden="true"></span><span class="thinking-switch-state" aria-hidden="true"></span></button>
      <div id="thread-colors"></div>
      <label><span data-i18n="authoring:widthMode"></span><input name="thread.fixedWidth" type="hidden" value="false"></label>
      <label><span data-i18n="authoring:width"></span><input name="thread.width" type="number" min="0" max="100" step="any"></label>
      <label><span data-i18n="authoring:opacity"></span><input name="thread.opacity" type="number" min="0" max="100"></label>
      <label><span data-i18n="authoring:style"></span><select name="thread.dash"><option value="solid" data-i18n="authoring:solid"></option><option value="dashed" data-i18n="authoring:dashed"></option><option value="dotted" data-i18n="authoring:dotted"></option></select></label>
    </fieldset></form>`;
  translateUi(panel);
  const choice = panel.querySelector<HTMLSelectElement>('#series-choice')!;
  const form = panel.querySelector<HTMLFormElement>('#series-settings')!;
  const updateThreadWidthMode=createStrokeWidthMode(form.elements.namedItem('thread.fixedWidth') as HTMLInputElement,'authoring:fixedThread');
  const updateLineStyle = createLineStylePicker(form.elements.namedItem('thread.dash') as HTMLSelectElement);
  addFormNumberPresets(form);
  addNumberPresets(form.elements.namedItem('thread.width') as HTMLInputElement, numberPresets.strokeWidth, t('authoring:width'));
  addNumberPresets(form.elements.namedItem('thread.opacity') as HTMLInputElement, numberPresets.fillOpacity, t('authoring:opacity'));
  const visibilityKeys = { all: 'authoring:visibilityAll', pins: 'authoring:visibilityPins', hidden: 'authoring:visibilityHidden' } as const;
  for (const [value, key] of Object.entries(visibilityKeys)) { const option = new Option(t(key), value); uiText(option, key); panel.querySelector<HTMLSelectElement>('#series-visibility')!.add(option); }
  const formatNames = ['1, 2…', 'a〜z', 'A〜Z', 'i〜xx', 'I〜XX', '①〜⑳', 'ア〜ン'];
  formatSchema.options.forEach((value, index) => (form.elements.namedItem('format') as HTMLSelectElement).add(new Option(formatNames[index], value)));
  const colors = createColorControls(panel.querySelector<HTMLElement>('#series-colors')!, operations => {
    const patch = operations[0]?.kind === 'update' ? operations[0].patch : {};
    apply([{ kind: 'series_update', id: chosen, patch }]);
  }, 'series-');
  const threadColors = createColorControls(panel.querySelector<HTMLElement>('#thread-colors')!, operations => {
    const patch = operations[0]?.kind === 'update' ? operations[0].patch : {};
    if (patch.stroke !== undefined) apply([{ kind: 'series_update', id: chosen, patch: { thread: { color: patch.stroke } } }]);
  }, 'thread-', { roles: ['stroke'], names: { stroke: 'paint:color' } });
  const threadVisible = panel.querySelector<HTMLButtonElement>('#thread-visible')!;
  threadVisible.onkeydown = event => event.stopPropagation();
  threadVisible.onclick = () => {
    const thread = series().thread;
    apply([{ kind: 'series_update', id: chosen, patch: { thread: { enabled: true, visible: !(thread.enabled && thread.visible) } } }]);
  };
  function series() { return desk.settingsSnapshot().series.find(item => item.id === chosen)!; }
  const trigger = document.createElement('button'); trigger.id = 'pin-series-menu'; trigger.type = 'button'; trigger.textContent = '▾';
  uiAttribute(trigger, 'aria-label', 'authoring:target'); uiAttribute(trigger, 'title', 'authoring:targetTitle');
  const popup = document.createElement('div'); popup.id = 'pin-series-palette'; popup.popover = 'auto'; popup.className = 'number-preset-palette';
  popup.setAttribute('role', 'dialog'); uiAttribute(popup, 'aria-label', 'authoring:target');
  document.body.append(popup); button.after(trigger); trigger.popoverTargetElement = popup;
  const hide = () => { if (popup.matches(':popover-open')) popup.hidePopover(); };
  function selectedSeries() {
    const ids = new Set(desk.selected().map(id => desk.get(id)).filter(object => object.type === 'label').map(object => object.seriesId!));
    return ids.size === 1 ? [...ids][0] : chosen;
  }
  function addPin(seriesId: string, extra: Operation[] = [], frame?:{width:number;height:number}) {
    hide();
    const previous = chosen, id = `label-${randomUuid().slice(0, 8)}`;
    chosen = seriesId;
    const current = desk.settingsSnapshot().series.find(item => item.id === seriesId);
    const {width,height} = current ?? frame ?? tightFrame(desk.settingsSnapshot().defaults.fontSize, 'pin');
    const point = placementPoint();
    apply([...extra, {kind:'label_add', id, seriesId, x:point.x-width/2, y:point.y-height}], id);
    if (!desk.snapshot().some(object => object.id === id)) chosen = previous;
    update();
  }
  function newSeries() {
    const id = `series-${randomUuid().slice(0, 8)}`;
    try{
      const frame=browserPinFrame(desk.settingsSnapshot().defaults.fontSize,'pin',['1','2']);
      addPin(id, [{kind:'series_add', series:{id, name:t('authoring:newSeries', { number: desk.settingsSnapshot().series.length + 1 }),...frame}}],frame);
    }catch(error){report(error instanceof Error?error.message:String(error),true);}
  }
  function populate() {
    const heading = document.createElement('div'); heading.className = 'number-preset-heading'; heading.textContent = t('authoring:chooseAdd');
    const choices = document.createElement('div'); choices.className = 'pin-series-choices';
    for (const item of desk.listSettings().series) {
      const choice = document.createElement('button'); choice.type = 'button'; choice.dataset.pinSeries = item.id;
      choice.textContent = t('authoring:next', { name: item.name, next: item.nextText }); choice.setAttribute('aria-pressed', String(item.id === selectedSeries()));
      choice.onclick = () => addPin(item.id); choices.append(choice);
    }
    const create = document.createElement('button'); create.type = 'button'; create.id = 'pin-series-new'; create.textContent = t('authoring:createAdd'); create.onclick = newSeries;
    const hint=document.createElement('p');hint.className='pin-order-help';hint.textContent=t('authoring:reorderHint');
    popup.replaceChildren(heading, choices, create, hint);
  }
  popup.addEventListener('beforetoggle', event => { if ((event as ToggleEvent).newState === 'open') populate(); });
  popup.addEventListener('toggle', () => {
    const open = popup.matches(':popover-open'); trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      const rect = trigger.getBoundingClientRect();
      popup.style.left = `${Math.max(8, Math.min(button.getBoundingClientRect().left, innerWidth-popup.offsetWidth-8))}px`;
      popup.style.top = `${Math.max(8, Math.min(rect.bottom+6, innerHeight-popup.offsetHeight-8))}px`;
    }
  });
  for (const control of [button,trigger]) control.onkeydown = event => { if (event.key === ' ' || event.key === 'Enter') event.stopPropagation(); };
  selectButton.onclick = hide;
  button.onclick = () => addPin(selectedSeries());
  settingsButton.onclick = () => { panel.hidden = !panel.hidden; update(); };
  choice.onchange = () => { chosen = choice.value; update(); };
  form.querySelector<HTMLButtonElement>('#series-fit')!.onclick = () => {
    try { apply(browserPinFitOperations(desk,[chosen])); } catch(error) { report(error instanceof Error?error.message:String(error),true); }
  };
  form.onsubmit = event => event.preventDefault();
  form.onchange = event => {
    const input = event.target as HTMLInputElement;
    if (input.name.startsWith('thread.')) {
      const key = input.name.slice(7) as keyof Series['thread'];
      const value = key==='fixedWidth'?input.value==='true':input.type === 'checkbox' ? input.checked : key === 'width' ? Number(input.value)
        : key === 'opacity' ? opacityFromPercent(input.value) : input.value;
      apply([{ kind: 'series_update', id: chosen, patch: { thread: { [key]: value } } }]);
      return;
    }
    const key = input.name as keyof Series;
    apply([{ kind: 'series_update', id: chosen, patch: { [key]: key === 'fillOpacity' ? opacityFromPercent(input.value)
      : ['name', 'format', 'shape', 'visibility'].includes(key) ? input.value : Number(input.value) } }]);
  };
  function update() {
    const settings = desk.settingsSnapshot();
    const selected = desk.selected().map(id => desk.get(id));
    const key = selected.map(object => object.id).join('|');
    const onlyPins = selected.length > 0 && selected.every(object => object.type === 'label');
    if (key !== selection && onlyPins) {
      panel.hidden = false;
    } else if (!onlyPins) panel.hidden = true;
    if (key !== selection) {
      const ids = new Set(selected.filter(object => object.type === 'label').map(object => object.seriesId!));
      if (ids.size === 1) chosen = [...ids][0];
    }
    selection = key;
    if (!settings.series.some(item => item.id === chosen)) chosen = settings.series[0].id;
    defaults.update([objectSchema.parse({ id: 'defaults', type: 'rect', ...settings.defaults })]);
    width.value = String(settings.defaults.strokeWidth);
    opacity.value = String(transparencyPercent(settings.defaults.fillOpacity));
    choice.replaceChildren(...settings.series.map(item => new Option(`${item.name} (${item.id})`, item.id)));
    choice.value = chosen;
    const current = series();
    const showThread = current.thread.enabled && current.thread.visible;
    threadVisible.setAttribute('aria-checked', String(showThread));
    threadVisible.querySelector('.thinking-switch-state')!.textContent = showThread ? 'ON' : 'OFF';
    threadColors.update([objectSchema.parse({ id: current.id, type: 'line', stroke: current.thread.color })]);
    for (const input of Array.from(form.elements) as HTMLInputElement[]) if (input.name) {
      if (input.name.startsWith('thread.')) {
        const key = input.name.slice(7) as keyof Series['thread'];
        if (input.type === 'checkbox') input.checked = Boolean(current.thread[key]);
        else input.value = String(key === 'opacity' ? transparencyPercent(current.thread.opacity) : current.thread[key]);
      } else input.value = input.name === 'fillOpacity'
        ? String(transparencyPercent(current.fillOpacity)) : String(current[input.name as keyof Series]);
    }
    const { name: _name, format: _format, shape: _shape, visibility: _visibility, thread: _thread, ...appearance } = current;
    updateLineStyle();updateThreadWidthMode();
    colors.update([objectSchema.parse({ ...appearance, type: 'rect' })]);
    const info = desk.listSettings().series.find(item => item.id === chosen)!;
    panel.querySelector('#series-info')!.textContent = t('authoring:info', { next: info.nextText, count: info.count });
    settingsButton.setAttribute('aria-expanded', String(!panel.hidden));
    button.title = t('authoring:addPin', { name: current.name });
    button.setAttribute('aria-label', button.title);
    button.removeAttribute('aria-pressed');
    selectButton.setAttribute('aria-pressed', 'true');
  }
  document.addEventListener(languageChangeEvent, update);
  return { update };
}
