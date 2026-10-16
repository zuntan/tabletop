import { objectSchema, type Desk, type DeskObject, type Operation } from './model';
import { colorOperations, createColorControls } from './color-controls';
import { isConnector, isShape } from './geometry';
import { formatSchema, type Series } from './settings';
import { tightFrame } from './pin-shape';
import { opacityOperations, transparencyPercent, opacityFromPercent } from './fill-opacity';
import { iconButton } from './toolbar';
import { randomUuid } from './portable-crypto';

export function createAuthoring(desk: Desk, toolbar: HTMLElement, panel: HTMLElement, button: HTMLButtonElement,
  selectButton: HTMLButtonElement, apply: (operations: Operation[]) => void) {
  let chosen = 'series-1', placing = false, selection = '';
  toolbar.innerHTML = '<div id="default-colors"></div><label title="線幅">線幅<input id="default-width" type="number" min="0" max="100" step="any"></label><button id="numbering-settings" title="ピン体系" aria-label="ピン体系">⚑⚙</button>';
  const settingsButton = toolbar.querySelector<HTMLButtonElement>('#numbering-settings')!;
  iconButton(settingsButton, '⚑⚙', 'ピン体系');
  const width = toolbar.querySelector<HTMLInputElement>('#default-width')!;
  const opacityLabel = document.createElement('label'); opacityLabel.textContent = '塗り透過%';
  const opacity = document.createElement('input'); opacity.id = 'default-opacity'; opacity.type = 'number';
  opacity.min = '0'; opacity.max = '100'; opacity.step = '1'; opacity.setAttribute('aria-label', '新規と選択対象の塗り透過（%）');
  opacityLabel.append(opacity); toolbar.insertBefore(opacityLabel, settingsButton);
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
      } else if (object.type !== 'label' && (isShape(object) || isConnector(object))) operations.push({ kind: 'update', id: object.id, patch: { strokeWidth: value } });
    }
    apply(operations);
  };
  panel.innerHTML = `<h2>ピン体系</h2><select id="series-choice" aria-label="ピン体系"></select>
    <button id="series-add">体系を追加</button><button id="series-place">ピンを配置</button>
    <form id="series-settings"><label>名前<input name="name" maxlength="100"></label>
    <label>書式<select name="format"></select></label><label>形<select name="shape"><option value="pin">ピン</option><option value="text">文字のみ</option><option value="rect">四角</option><option value="ellipse">丸 / 楕円</option><option value="roundedRect">角丸矩形</option></select></label>
    <label>幅<input name="width" type="number" min="1"></label><label>高さ<input name="height" type="number" min="1"></label>
    <label>文字サイズ<input name="fontSize" type="number" min="1" max="1000"></label><label>線幅<input name="strokeWidth" type="number" min="0" max="100" step="any"></label>
    <label>塗りの透過（%）<input name="fillOpacity" type="number" min="0" max="100" step="1"></label>
    <button id="series-fit" type="button" title="現在の番号と次の番号に合わせて、体系全体の枠をタイトにします">文字に枠を合わせる</button>
    </form><div id="series-colors"></div><small id="series-info"></small>`;
  const choice = panel.querySelector<HTMLSelectElement>('#series-choice')!;
  const form = panel.querySelector<HTMLFormElement>('#series-settings')!;
  const formatNames = ['1, 2…', 'a〜z', 'A〜Z', 'i〜xx', 'I〜XX', '①〜⑳', 'ア〜ン'];
  formatSchema.options.forEach((value, index) => (form.elements.namedItem('format') as HTMLSelectElement).add(new Option(formatNames[index], value)));
  const colors = createColorControls(panel.querySelector<HTMLElement>('#series-colors')!, operations => {
    const patch = operations[0]?.kind === 'update' ? operations[0].patch : {};
    apply([{ kind: 'series_update', id: chosen, patch }]);
  }, 'series-');
  function series() { return desk.settingsSnapshot().series.find(item => item.id === chosen)!; }
  function stopPlacement() { placing = false; update(); }
  selectButton.onclick = stopPlacement;
  button.onclick = () => { placing = !placing; update(); };
  settingsButton.onclick = () => { panel.hidden = !panel.hidden; update(); };
  choice.onchange = () => { chosen = choice.value; update(); };
  panel.querySelector<HTMLButtonElement>('#series-place')!.onclick = () => { placing = !placing; update(); };
  panel.querySelector<HTMLButtonElement>('#series-add')!.onclick = () => {
    const id = `series-${randomUuid().slice(0, 8)}`;
    chosen = id;
    apply([{ kind: 'series_add', series: { id, name: `体系 ${desk.settingsSnapshot().series.length + 1}` } }]);
  };
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
    const key = input.name as keyof Series;
    apply([{ kind: 'series_update', id: chosen, patch: { [key]: key === 'fillOpacity' ? opacityFromPercent(input.value)
      : ['name', 'format', 'shape'].includes(key) ? input.value : Number(input.value) } }]);
  };
  function update() {
    const settings = desk.settingsSnapshot();
    const selected = desk.selected().map(id => desk.get(id));
    const key = selected.map(object => object.id).join('|');
    if (key !== selection && selected.length === 1 && selected[0].type === 'label') {
      chosen = selected[0].seriesId!; panel.hidden = false;
    }
    selection = key;
    if (!settings.series.some(item => item.id === chosen)) chosen = settings.series[0].id;
    defaults.update([objectSchema.parse({ id: 'defaults', type: 'rect', ...settings.defaults })]);
    width.value = String(settings.defaults.strokeWidth);
    opacity.value = String(transparencyPercent(settings.defaults.fillOpacity));
    choice.replaceChildren(...settings.series.map(item => new Option(`${item.name} (${item.id})`, item.id)));
    choice.value = chosen;
    const current = series();
    for (const input of Array.from(form.elements) as HTMLInputElement[]) if (input.name) input.value = input.name === 'fillOpacity'
      ? String(transparencyPercent(current.fillOpacity)) : String(current[input.name as keyof Series]);
    const { name: _name, format: _format, shape: _shape, ...appearance } = current;
    colors.update([objectSchema.parse({ ...appearance, type: 'rect' })]);
    const info = desk.listSettings().series.find(item => item.id === chosen)!;
    panel.querySelector('#series-info')!.textContent = `次：${info.nextText} · ${info.count} 個 · Escで配置終了（色・形は体系全体に適用）`;
    panel.querySelector('#series-place')!.textContent = placing ? '配置中 · クリックで連続配置' : 'ピンを配置';
    settingsButton.setAttribute('aria-expanded', String(!panel.hidden));
    button.title = `ピンを配置：${current.name}`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(placing));
    selectButton.setAttribute('aria-pressed', String(!placing));
    panel.querySelector('#series-place')!.setAttribute('aria-pressed', String(placing));
  }
  return { update, stopPlacement, isPlacing: () => placing,
    place(point: { x: number; y: number }) {
      if (!placing) return false;
      const current = series(), id = `label-${randomUuid().slice(0, 8)}`;
      apply([{ kind: 'label_add', id, seriesId: chosen, x: point.x - current.width / 2, y: point.y - current.height }]);
      return true;
    },
  };
}
