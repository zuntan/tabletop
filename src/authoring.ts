import { objectSchema, type Desk, type DeskObject, type Operation } from './model';
import { colorOperations, createColorControls } from './color-controls';
import { isConnector, isShape } from './geometry';
import { formatSchema, type Series } from './settings';
import { tightFrame } from './pin-shape';
import { opacityOperations, transparencyPercent, opacityFromPercent } from './fill-opacity';
import { iconButton } from './toolbar';
import { randomUuid } from './portable-crypto';
import { pinVisibilityNames } from './pin-series';
import { addNumberPresets, addFormNumberPresets, numberPresets } from './number-presets';
import { createLineStylePicker } from './line-style-picker';

export function createAuthoring(desk: Desk, toolbar: HTMLElement, panel: HTMLElement, button: HTMLButtonElement,
  selectButton: HTMLButtonElement, apply: (operations: Operation[], selectId?: string) => void, placementPoint: () => {x:number;y:number}) {
  let chosen = 'series-1', selection = '';
  toolbar.innerHTML = '<div id="default-colors"></div><label title="線幅">線幅<input id="default-width" type="number" min="0" max="100" step="any"></label><button id="numbering-settings" title="ピンシリーズ" aria-label="ピンシリーズ">⚑⚙</button>';
  const settingsButton = toolbar.querySelector<HTMLButtonElement>('#numbering-settings')!;
  iconButton(settingsButton, '⚑⚙', 'ピンシリーズ');
  const width = toolbar.querySelector<HTMLInputElement>('#default-width')!;
  const opacityLabel = document.createElement('label'); opacityLabel.textContent = '塗り透過（%）';
  const opacity = document.createElement('input'); opacity.id = 'default-opacity'; opacity.type = 'number';
  opacity.min = '0'; opacity.max = '100'; opacity.step = '1'; opacity.setAttribute('aria-label', '新規と選択対象の塗り透過（%）');
  opacityLabel.append(opacity); toolbar.insertBefore(opacityLabel, settingsButton);
  addNumberPresets(width, numberPresets.strokeWidth, '線幅');
  addNumberPresets(opacity, numberPresets.fillOpacity, '塗り透過（%）');
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
      } else if (object.type !== 'label' && (isShape(object) || isConnector(object) || ['text','file'].includes(object.type))) operations.push({ kind: 'update', id: object.id, patch: { strokeWidth: value } });
    }
    apply(operations);
  };
  panel.innerHTML = `<h2>ピンシリーズ</h2><select id="series-choice" aria-label="ピンシリーズ"></select>
    <form id="series-settings"><label>名前<input name="name" maxlength="100"></label>
    <label>表示<select name="visibility" id="series-visibility"></select></label>
    <label>書式<select name="format"></select></label><label>形<select name="shape"><option value="pin">ピン</option><option value="text">文字のみ</option><option value="rect">四角</option><option value="ellipse">丸 / 楕円</option><option value="roundedRect">角丸矩形</option></select></label>
    <label>幅<input name="width" type="number" min="1"></label><label>高さ<input name="height" type="number" min="1"></label>
    <label>文字サイズ<input name="fontSize" type="number" min="1" max="1000"></label>
    <button id="series-fit" type="button" title="現在の番号と次の番号に合わせて、シリーズ全体の枠をタイトにします">枠を文字にあわせる</button>
    <label>線幅<input name="strokeWidth" type="number" min="0" max="100" step="any"></label>
    <label>塗り透過（%）<input name="fillOpacity" type="number" min="0" max="100" step="1"></label>
    <div id="series-colors"></div><small id="series-info"></small>
    <fieldset><legend>糸</legend>
      <button id="thread-visible" type="button" role="switch" aria-label="糸を表示"><span>糸を表示</span><span class="thinking-switch-track" aria-hidden="true"></span><span class="thinking-switch-state" aria-hidden="true"></span></button>
      <div id="thread-colors"></div>
      <label>線幅<input name="thread.width" type="number" min="0" max="100" step="any"></label>
      <label>塗り透過（%）<input name="thread.opacity" type="number" min="0" max="100"></label>
      <label>線種<select name="thread.dash"><option value="solid">実線</option><option value="dashed">破線</option><option value="dotted">点線</option></select></label>
    </fieldset></form>`;
  const choice = panel.querySelector<HTMLSelectElement>('#series-choice')!;
  const form = panel.querySelector<HTMLFormElement>('#series-settings')!;
  const updateLineStyle = createLineStylePicker(form.elements.namedItem('thread.dash') as HTMLSelectElement);
  addFormNumberPresets(form);
  addNumberPresets(form.elements.namedItem('thread.width') as HTMLInputElement, numberPresets.strokeWidth, '線幅');
  addNumberPresets(form.elements.namedItem('thread.opacity') as HTMLInputElement, numberPresets.fillOpacity, '塗り透過（%）');
  for (const [value, name] of Object.entries(pinVisibilityNames))
    panel.querySelector<HTMLSelectElement>('#series-visibility')!.add(new Option(name, value));
  const formatNames = ['1, 2…', 'a〜z', 'A〜Z', 'i〜xx', 'I〜XX', '①〜⑳', 'ア〜ン'];
  formatSchema.options.forEach((value, index) => (form.elements.namedItem('format') as HTMLSelectElement).add(new Option(formatNames[index], value)));
  const colors = createColorControls(panel.querySelector<HTMLElement>('#series-colors')!, operations => {
    const patch = operations[0]?.kind === 'update' ? operations[0].patch : {};
    apply([{ kind: 'series_update', id: chosen, patch }]);
  }, 'series-');
  const threadColors = createColorControls(panel.querySelector<HTMLElement>('#thread-colors')!, operations => {
    const patch = operations[0]?.kind === 'update' ? operations[0].patch : {};
    if (patch.stroke !== undefined) apply([{ kind: 'series_update', id: chosen, patch: { thread: { color: patch.stroke } } }]);
  }, 'thread-', { roles: ['stroke'], names: { stroke: '色' } });
  const threadVisible = panel.querySelector<HTMLButtonElement>('#thread-visible')!;
  threadVisible.onkeydown = event => event.stopPropagation();
  threadVisible.onclick = () => {
    const thread = series().thread;
    apply([{ kind: 'series_update', id: chosen, patch: { thread: { enabled: true, visible: !(thread.enabled && thread.visible) } } }]);
  };
  function series() { return desk.settingsSnapshot().series.find(item => item.id === chosen)!; }
  const trigger = document.createElement('button'); trigger.id = 'pin-series-menu'; trigger.type = 'button'; trigger.textContent = '▾';
  trigger.setAttribute('aria-label', 'ピンの追加先'); trigger.title = 'シリーズを選んで追加';
  const popup = document.createElement('div'); popup.id = 'pin-series-palette'; popup.popover = 'auto'; popup.className = 'number-preset-palette';
  popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', 'ピンの追加先');
  document.body.append(popup); button.after(trigger); trigger.popoverTargetElement = popup;
  const hide = () => { if (popup.matches(':popover-open')) popup.hidePopover(); };
  function selectedSeries() {
    const ids = new Set(desk.selected().map(id => desk.get(id)).filter(object => object.type === 'label').map(object => object.seriesId!));
    return ids.size === 1 ? [...ids][0] : chosen;
  }
  function addPin(seriesId: string, extra: Operation[] = []) {
    hide();
    const previous = chosen, id = `label-${randomUuid().slice(0, 8)}`;
    chosen = seriesId;
    const current = desk.settingsSnapshot().series.find(item => item.id === seriesId);
    const {width,height} = current ?? tightFrame(desk.settingsSnapshot().defaults.fontSize, 'pin');
    const point = placementPoint();
    apply([...extra, {kind:'label_add', id, seriesId, x:point.x-width/2, y:point.y-height}], id);
    if (!desk.snapshot().some(object => object.id === id)) chosen = previous;
    update();
  }
  function newSeries() {
    const id = `series-${randomUuid().slice(0, 8)}`;
    addPin(id, [{kind:'series_add', series:{id, name:`シリーズ ${desk.settingsSnapshot().series.length+1}`}}]);
  }
  function populate() {
    const heading = document.createElement('div'); heading.className = 'number-preset-heading'; heading.textContent = 'シリーズを選んで1本追加';
    const choices = document.createElement('div'); choices.className = 'pin-series-choices';
    for (const item of desk.listSettings().series) {
      const choice = document.createElement('button'); choice.type = 'button'; choice.dataset.pinSeries = item.id;
      choice.textContent = `${item.name} · 次：${item.nextText}`; choice.setAttribute('aria-pressed', String(item.id === selectedSeries()));
      choice.onclick = () => addPin(item.id); choices.append(choice);
    }
    const create = document.createElement('button'); create.type = 'button'; create.id = 'pin-series-new'; create.textContent = '新しいシリーズ＋1本'; create.onclick = newSeries;
    popup.replaceChildren(heading, choices, create);
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
    const current = series();
    const texts = desk.snapshot().filter(object => object.type === 'label' && object.seriesId === chosen).map(object => object.text);
    texts.push(desk.listSettings().series.find(item => item.id === chosen)!.nextText);
    const context = document.createElement('canvas').getContext('2d');
    if (context) context.font = `${current.fontSize}px sans-serif`;
    const frame = tightFrame(current.fontSize, current.shape, texts, context ? text => context.measureText(text).width : undefined);
    apply([{ kind: 'series_update', id: chosen, patch: frame }]);
  };
  form.onsubmit = event => event.preventDefault();
  form.onchange = event => {
    const input = event.target as HTMLInputElement;
    if (input.name.startsWith('thread.')) {
      const key = input.name.slice(7) as keyof Series['thread'];
      const value = input.type === 'checkbox' ? input.checked : key === 'width' ? Number(input.value)
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
    updateLineStyle();
    colors.update([objectSchema.parse({ ...appearance, type: 'rect' })]);
    const info = desk.listSettings().series.find(item => item.id === chosen)!;
    panel.querySelector('#series-info')!.textContent = `次：${info.nextText} · ${info.count} 個（色・形はシリーズ全体に適用）`;
    settingsButton.setAttribute('aria-expanded', String(!panel.hidden));
    button.title = `ピンを追加：${current.name}`;
    button.setAttribute('aria-label', button.title);
    button.removeAttribute('aria-pressed');
    selectButton.setAttribute('aria-pressed', 'true');
  }
  return { update };
}
