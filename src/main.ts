import './style.css';
import { Desk, dispatch, objectSchema, type DeskObject, type Operation } from './model';
import { bounds, isConnector, isShape } from './geometry';
import { createColorControls } from './color-controls';
import { drawConnector, drawShapeText, drawEndpointHandles, drawSnapTargets, updateScenePreview } from './diagram-drawing';
import { gestureOperations, gesturePreview, endpointDragPoint, type Gesture } from './diagram-gestures';
import { syncProperties, propertyPatch } from './properties';
import './diagram.css';
import './authoring.css';
import { createInlineEditor } from './inline-editor';
import { createAuthoring } from './authoring';
import { creationAppearance } from './settings';
import { groupToolbar } from './toolbar';
import { drawLabelDescription, labelVisualBounds } from './label-description';
import { gridPoint, gridOrigin } from './grid';
import { pinPath } from './pin-shape';
import { drawOpenLink } from './link-card';
import { readClipboardFiles, svgClipboardFile } from './clipboard';
import { drawMarkdown } from './markdown';
import './markdown.css';
import { createSidebar } from './sidebar';
import './sidebar.css';
import { selectedConnection } from './connection-creation';
import { drawAiPointing } from './ai-pointing';
import { createReactionControls, drawReactions } from './reactions';
import './reactions.css';

const desk = new Desk();
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header><div class="brand">Tabletop <small>人間とAIの共有作業机</small></div>
    <span id="connection" class="badge">未接続</span><span id="revision">revision 0</span>
    <button id="undo">元に戻す</button><button id="redo">やり直す</button>
  </header>
  <nav aria-label="追加ツール">
    <button data-add="rect">▭ 矩形</button><button data-add="roundedRect">▢ 角丸矩形</button><button data-add="ellipse">◯ 楕円</button>
    <button data-add="line">╱ 線</button><button data-add="arrow">↗ 矢印</button>
    <button data-add="text">T テキスト</button><button id="image">画像 / SVG</button>
    <button id="clipboard" title="クリップボードから追加" aria-label="クリップボードから追加">▣ クリップボードから追加</button>
    <button data-add="web">Web資料</button><button data-add="link">リンク</button>
    <button id="numbering">ピン</button><div id="authoring-tools"></div>
    <span class="spacer"></span><button id="zoom-out" aria-label="縮小">−</button>
    <button id="zoom-reset">100%</button><button id="zoom-in" aria-label="拡大">＋</button><button id="fit">全体表示</button>
  </nav>
  <main>
    <section id="workspace" aria-label="共有キャンバス">
      <svg id="canvas" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tabletop キャンバス" tabindex="0">
        <defs><pattern id="dots" x="-12" y="-12" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="#cbd5e1"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#dots)"/>
        <g id="viewport"><g id="objects"></g><g id="overlays"></g></g>
      </svg>
      <div id="empty">ここに資料を広げて、いっしょに考える。<small>上のツールから追加 · 画像をドロップ · AIからMCPで操作</small></div>
      <div class="hint">Shift＋クリック：複数選択 · Space＋ドラッグ / 中ボタン：パン · ホイール：ズーム · Delete：削除</div>
    </section>
    <aside>
      <section id="series-panel" hidden></section>
      <section><h2>選択・プロパティ</h2><div id="selected-label">未選択</div>
        <form id="properties" hidden>
          <label>X / 始点X<input name="x" type="number" step="any"></label><label>Y / 始点Y<input name="y" type="number" step="any"></label>
          <label hidden>終点X<input name="x2" type="number" step="any" disabled></label><label hidden>終点Y<input name="y2" type="number" step="any" disabled></label>
          <label>幅<input name="width" type="number" min="1" step="any"></label><label>高さ<input name="height" type="number" min="1" step="any"></label>
          <label hidden>塗り<input name="fill" type="text"></label><label hidden>線<input name="stroke" type="text"></label>
          <label>塗りの透過（%）<input name="fillOpacity" type="number" min="0" max="100" step="1"></label>
          <label>線幅<input name="strokeWidth" type="number" min="0" step="any"></label><label>文字サイズ<input name="fontSize" type="number" min="1"></label>
          <label class="wide">テキスト<textarea name="text" rows="3"></textarea></label>
          <label class="wide">URL<input name="url" type="url"></label>
          <button type="submit" class="wide">変更を適用</button>
        </form>
        <div id="color-controls" hidden></div>
        <div id="reaction-controls" hidden></div>
        <small>図形のダブルクリックで文字編集。矢印の両端をドラッグして接続できます。</small>
        <div class="actions"><button id="front">最前面</button><button id="back">最背面</button><button id="delete">削除</button></div>
        <a id="open-url" hidden target="_blank" rel="noopener noreferrer">元のページをブラウザで開く ↗</a>
      </section>
      <section><h2>オブジェクト <span id="count">0</span></h2><div id="object-list"></div></section>
      <section><h2>共通履歴</h2><div id="history"></div></section>
      <section><h2>MCP接続</h2><p>サーバーが表示したURLから開くか、接続トークンを入力してください。</p>
        <form id="connect-form"><label>ポート<input id="port" type="number" value="4317" min="1" max="65535"></label>
          <label>トークン<input id="token" type="password" autocomplete="off"></label><button type="submit">接続</button></form>
        <small>作業状態はこのタブ内のみ。閉じると失われます。</small>
      </section>
    </aside>
  </main>
  <footer id="message" role="status">準備完了</footer>
  <input id="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>
`;
groupToolbar(app.querySelector<HTMLElement>('nav')!);
createSidebar(app);
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
const canvas = app.querySelector<SVGSVGElement>('#canvas')!;
const viewport = app.querySelector<SVGGElement>('#viewport')!;
const objectsLayer = app.querySelector<SVGGElement>('#objects')!;
const overlays = app.querySelector<SVGGElement>('#overlays')!;
const form = $<HTMLFormElement>('#properties');
const camera = { x: 60, y: 50, zoom: 1 };
let space = false;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let connectionGeneration = 0;
let busy = false;
let descriptionsVisible = true;
let gridEnabled = false;
let gesture: Gesture | null = null;
const colorControls = createColorControls($('#color-controls'), operations => {
  if (busy || !operations.length) return;
  attempt(() => execute(operations));
});
const editor = createInlineEditor($('#workspace'), viewport, (object, patch, fresh) => {
  execute([fresh ? { kind: 'add', object: { ...object, ...patch } } : { kind: 'update', id: object.id, patch }]);
  if (fresh) desk.select([object.id]);
  render();
});
const authoring = createAuthoring(desk, $('#authoring-tools'), $('#series-panel'), $<HTMLButtonElement>('#numbering'), $<HTMLButtonElement>('#selection-mode'), operations => {
  if (!busy) attempt(() => execute(operations));
});
$('#authoring-tools').append($('#reaction-controls'));
const reactionControls = createReactionControls($('#reaction-controls'), () => desk.selected().map(id => desk.get(id)), operations => {
  if (!busy && !editor.isActive() && operations.length) attempt(() => execute(operations));
});
const labels: Record<DeskObject['type'], string> = { rect: '矩形', roundedRect: '角丸矩形', label: 'ピン', ellipse: '楕円', line: '線', arrow: '矢印', text: 'テキスト', image: '画像', svg: 'SVG', web: 'Web資料', link: 'リンク' };

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function notify(message: string, error = false) { $('#message').textContent = message; $('#message').classList.toggle('error', error); }
function attempt(action: () => void) {
  try { action(); render(); notify(`revision ${desk.revision} · ${desk.summary().count} オブジェクト`); }
  catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
}
function execute(operations: Operation[]) { desk.execute({ actor: 'human', operations }); }
function screen(event: PointerEvent | WheelEvent) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function world(event: PointerEvent | WheelEvent) {
  const p = screen(event);
  return { x: (p.x - camera.x) / camera.zoom, y: (p.y - camera.y) / camera.zoom };
}
function cameraChanged() {
  viewport.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);
  app.querySelector('#dots')!.setAttribute('patternTransform', `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);
  $('#zoom-reset').textContent = `${Math.round(camera.zoom * 100)}%`;
  editor.reposition();
}
function zoom(factor: number, center = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }) {
  const old = camera.zoom;
  camera.zoom = Math.max(0.05, Math.min(8, old * factor));
  camera.x = center.x - (center.x - camera.x) * camera.zoom / old;
  camera.y = center.y - (center.y - camera.y) * camera.zoom / old;
  cameraChanged(); drawSelection();
}
function drawObject(object: DeskObject) {
  const { width: w, height: h } = object;
  const group = svg('g', { transform: `translate(${object.x} ${object.y})`, 'data-id': object.id });
  if (isConnector(object)) {
    drawConnector(group, object, camera.zoom); drawReactions(group, object, descriptionsVisible);
    objectsLayer.append(group); return;
  }
  const style = { fill: object.fill, 'fill-opacity': object.fillOpacity, stroke: object.stroke, 'stroke-width': object.strokeWidth };
  const shape = object.type === 'label' ? object.labelShape : object.type;
  if (shape === 'rect' || shape === 'roundedRect') group.append(svg('rect', { width: w, height: h,
    rx: shape === 'roundedRect' ? Math.min(object.cornerRadius, w / 2, h / 2) : 0, ...style }));
  if (shape === 'ellipse') group.append(svg('ellipse', { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, ...style }));
  if (shape === 'pin') group.append(svg('path', { d: pinPath(w, h), ...style, 'stroke-linejoin': 'round', class: 'pin-frame' }));
  if (object.type === 'label' && shape === 'text') {
    group.append(svg('rect', { width: w, height: h, fill: 'transparent' }));
    const text = svg('text', { x: w / 2, y: h / 2, fill: object.textColor, 'font-size': object.fontSize,
      'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none' });
    text.textContent = object.text; group.append(text);
  }
  drawShapeText(group, object);
  drawLabelDescription(group, object, descriptionsVisible);
  if (object.type === 'text') {
    group.append(svg('rect', { width: w, height: h, ...style }));
    drawMarkdown(group, object);
  }
  if (['link', 'web', 'image', 'svg'].includes(object.type)) {
    group.append(svg('rect', { width: w, height: h, rx: 6, fill: '#ffffff', stroke: '#94a3b8' }));
    const title = svg('text', { x: 12, y: 23, 'font-size': 14, fill: '#1d4ed8' });
    title.textContent = (object.text || object.url || '').slice(0, Math.max(0, Math.floor((w - 52) / 8))); group.append(title);
    if (['image', 'svg'].includes(object.type) && h > 34) {
      // SVG stays in an image context, never inserted as executable markup.
      group.append(svg('image', { y: 34, width: w, height: h - 34, href: object.src!, preserveAspectRatio: 'xMidYMid meet' }));
    }
    if (object.type === 'web' && h > 40) {
      const foreign = svg('foreignObject', { x: 0, y: 34, width: w, height: h - 34 });
      const iframe = document.createElement('iframe');
      iframe.src = object.url!; iframe.title = object.text || 'Web資料';
      iframe.setAttribute('sandbox', 'allow-scripts'); iframe.referrerPolicy = 'no-referrer';
      iframe.loading = 'lazy'; iframe.style.pointerEvents = 'none';
      foreign.append(iframe); group.append(foreign);
    }
    drawOpenLink(group, object);
  }
  drawReactions(group, object, descriptionsVisible);
  objectsLayer.append(group);
}
function drawSelection(preview?: DeskObject[], scene = preview) {
  overlays.replaceChildren();
  const selected = preview ?? desk.selected().map(id => desk.get(id));
  drawAiPointing(overlays, desk.pointed().map(id => scene?.find(object => object.id === id) ?? desk.get(id)), camera.zoom, descriptionsVisible);
  for (const object of selected) {
    if (drawEndpointHandles(overlays, object, camera.zoom, selected.length === 1)) continue;
    const visual = labelVisualBounds(object, descriptionsVisible);
    overlays.append(svg('rect', { x: visual.x - 3 / camera.zoom, y: visual.y - 3 / camera.zoom,
      width: visual.width + 6 / camera.zoom, height: visual.height + 6 / camera.zoom,
      fill: 'none', stroke: '#2563eb', 'stroke-width': 1.5 / camera.zoom, 'stroke-dasharray': `${5 / camera.zoom} ${3 / camera.zoom}`, 'pointer-events': 'none' }));
    if (selected.length === 1 && object.type !== 'label') overlays.append(svg('rect', {
      x: object.x + object.width - 5 / camera.zoom, y: object.y + object.height - 5 / camera.zoom,
      width: 10 / camera.zoom, height: 10 / camera.zoom, fill: '#2563eb', stroke: '#fff',
      'stroke-width': 1 / camera.zoom, 'data-resize': object.id, class: 'resize-handle',
    }));
  }
}
function render(rebuild = true) {
  if (rebuild) {
    objectsLayer.replaceChildren();
    desk.snapshot().forEach(drawObject);
  }
  cameraChanged(); drawSelection();
  $('#empty').hidden = desk.summary().count > 0;
  $('#revision').textContent = `revision ${desk.revision}`;
  $<HTMLButtonElement>('#undo').disabled = !desk.summary().canUndo;
  $<HTMLButtonElement>('#redo').disabled = !desk.summary().canRedo;
  $('#count').textContent = String(desk.summary().count);
  const ids = desk.selected();
  colorControls.update(ids.map(id => desk.get(id)));
  reactionControls.update(ids.map(id => desk.get(id)));
  authoring.update();
  $('#selected-label').textContent = ids.length ? `${ids.length} 個選択 · ${ids.join(', ')}` : '未選択';
  form.hidden = ids.length !== 1;
  const link = $<HTMLAnchorElement>('#open-url'); link.hidden = true;
  if (ids.length === 1) {
    const object = desk.get(ids[0]);
    syncProperties(form, object);
    if (object.url) { link.href = object.url; link.hidden = false; }
  }
  for (const id of ['#front', '#back', '#delete']) $<HTMLButtonElement>(id).disabled = !ids.length;
  $('#object-list').replaceChildren();
  desk.snapshot().reverse().forEach(object => {
    const button = document.createElement('button'); button.className = 'object-row';
    button.classList.toggle('active', ids.includes(object.id));
    button.textContent = `${labels[object.type]} · ${object.text.slice(0, 22) || object.id}`;
    button.onclick = event => attempt(() => {
      const current = desk.selected();
      desk.select(event.shiftKey ? current.includes(object.id) ? current.filter(id => id !== object.id) : [...current, object.id] : [object.id]);
    });
    $('#object-list').append(button);
  });
  $('#history').replaceChildren();
  const changes = desk.getChanges(Math.max(0, desk.revision - 50), 50).changes.reverse();
  for (const change of changes) {
    const row = document.createElement('div'); row.className = 'history-row';
    const kinds = change.details.map(d => !d.before ? '追加' : !d.after ? '削除' : '変更');
    row.textContent = `r${change.revision} · ${change.actor} · ${change.operation === 'batch' ? [...new Set(kinds)].join(' / ') : change.operation} (${change.targets.length})`;
    row.title = change.targets.join(', '); $('#history').append(row);
  }
}
function newObject(type: DeskObject['type'], extra: Partial<DeskObject> = {}) {
  authoring.stopPlacement();
  const offset = desk.summary().count % 8 * 22;
  const center = { x: (120 - camera.x) / camera.zoom + offset, y: (100 - camera.y) / camera.zoom + offset };
  const object = objectSchema.parse({ id: `${type}-${crypto.randomUUID().slice(0, 8)}`, type, ...(gridEnabled ? gridPoint(center) : center),
    ...creationAppearance(type, desk.settingsSnapshot().defaults),
    ...(type === 'text' ? { width: 280, height: 80 } : {}),
    ...(['line', 'arrow'].includes(type) ? selectedConnection(desk.selected().map(id => desk.get(id))) : {}),
    ...(['web', 'link'].includes(type) ? { width: type === 'web' ? 480 : 320, height: type === 'web' ? 340 : 60 } : {}), ...extra });
  if (['text', 'web', 'link'].includes(type)) { editor.open(object, true); return; }
  execute([{ kind: 'add', object }]); desk.select([object.id]);
}
app.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button => button.onclick = () => {
  const type = button.dataset.add as DeskObject['type'];
  if (!busy && !editor.isActive()) attempt(() => newObject(type));
});
$('#undo').onclick = () => attempt(() => { desk.undo(); });
$('#redo').onclick = () => attempt(() => { desk.redo(); });
function deleteSelection() {
  const ids = desk.selected(); if (ids.length) attempt(() => execute(ids.map(id => ({ kind: 'delete', id }))));
}
$('#delete').onclick = deleteSelection;
$('#front').onclick = () => attempt(() => execute(desk.selected().map(id => ({ kind: 'reorder', id, index: desk.summary().count - 1 }))));
$('#back').onclick = () => attempt(() => execute(desk.selected().slice().reverse().map(id => ({ kind: 'reorder', id, index: 0 }))));
form.onsubmit = event => {
  event.preventDefault();
  attempt(() => {
    const object = desk.get(desk.selected()[0]);
    const patch = propertyPatch(form, object);
    execute([{ kind: 'update', id: object.id, patch }]);
  });
};
$('#zoom-in').onclick = () => zoom(1.25);
$('#zoom-out').onclick = () => zoom(0.8);
$('#zoom-reset').onclick = () => zoom(1 / camera.zoom);
$('#grid-snap').onclick = () => {
  gridEnabled = !gridEnabled;
  $('#grid-snap').setAttribute('aria-pressed', String(gridEnabled));
};
$('#label-descriptions').onclick = () => {
  descriptionsVisible = !descriptionsVisible;
  const button = $('#label-descriptions');
  button.setAttribute('aria-pressed', String(descriptionsVisible));
  button.title = descriptionsVisible ? 'ピンの説明文を隠す' : 'ピンの説明文を表示';
  button.setAttribute('aria-label', button.title);
  render();
};
$('#fit').onclick = () => {
  const objects = desk.snapshot(); if (!objects.length) return;
  const boxes = objects.map(object => object.type === 'label' ? labelVisualBounds(object, descriptionsVisible) : bounds(object));
  const minX = Math.min(...boxes.map(o => o.x)), minY = Math.min(...boxes.map(o => o.y));
  const maxX = Math.max(...boxes.map(o => o.x + o.width)), maxY = Math.max(...boxes.map(o => o.y + o.height));
  camera.zoom = Math.max(0.05, Math.min(2, (canvas.clientWidth - 100) / (maxX - minX), (canvas.clientHeight - 100) / (maxY - minY)));
  camera.x = (canvas.clientWidth - (maxX - minX) * camera.zoom) / 2 - minX * camera.zoom;
  camera.y = (canvas.clientHeight - (maxY - minY) * camera.zoom) / 2 - minY * camera.zoom;
  cameraChanged(); drawSelection();
};
canvas.addEventListener('dblclick', event => {
  const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target as Element;
  if (target.closest('[data-open-url], [data-markdown-link]')) return;
  const id = target.closest('[data-id]')?.getAttribute('data-id');
  if (!id || busy || editor.isActive()) return;
  const object = desk.get(id);
  if (['rect', 'roundedRect', 'ellipse', 'text', 'link', 'web', 'label', 'image', 'svg'].includes(object.type)) editor.open(object);
});
canvas.addEventListener('wheel', event => { event.preventDefault(); if (!gesture) zoom(Math.exp(-event.deltaY * 0.001), screen(event)); }, { passive: false });
canvas.addEventListener('pointerdown', event => {
  if (gesture || editor.isActive() || (event.button !== 0 && event.button !== 1)) return;
  if (!space && (event.target as Element).closest('[data-open-url], [data-markdown-link]')) return;
  if (event.button === 0 && !space && authoring.place(gridEnabled ? gridPoint(world(event)) : world(event))) { event.preventDefault(); return; }
  const target = event.target as Element;
  const resize = target.closest('[data-resize]')?.getAttribute('data-resize');
  const endpoint = target.closest('[data-endpoint]')?.getAttribute('data-endpoint');
  const id = target.closest('[data-id]')?.getAttribute('data-id');
  const p = world(event);
  let mode: Gesture['mode'];
  const additive = event.shiftKey ? desk.selected() : [];
  if (space || event.button === 1) mode = 'pan';
  else if (resize) mode = 'resize';
  else if (endpoint === 'start' || endpoint === 'end') mode = endpoint;
  else if (id) {
    const ids = desk.selected();
    if (event.shiftKey) {
      desk.select(ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]);
      render(false); if (!desk.selected().includes(id)) return;
    } else if (!ids.includes(id)) { desk.select([id]); render(false); }
    mode = 'move';
  } else { if (!event.shiftKey) desk.select([]); render(); mode = 'marquee'; }
  const scene = desk.snapshot();
  gesture = { mode, start: p, screen: screen(event), originals: desk.selected().map(id => desk.get(id)), scene, preview: scene, revision: desk.revision, camera: { x: camera.x, y: camera.y }, additive, grid: gridEnabled, anchorId: id ?? resize ?? undefined };
  busy = true; canvas.setPointerCapture(event.pointerId); event.preventDefault(); canvas.focus();
});
function previewGesture(current: Gesture, point: { x: number; y: number }) {
  const scene = gesturePreview(current, point, camera.zoom);
  updateScenePreview(objectsLayer, scene, current.preview, drawObject); current.preview = scene;
  drawSelection(scene.filter(o => desk.selected().includes(o.id)), scene);
  if (current.mode === 'move') for (const object of scene.filter(o => o.type === 'label' && desk.selected().includes(o.id))) {
    const origin = gridOrigin(object), size = 5 / camera.zoom;
    overlays.append(svg('line', { x1: origin.x, y1: origin.y, x2: origin.x, y2: origin.y + size * 2,
      stroke: '#2563eb', 'stroke-width': 1 / camera.zoom, opacity: 0.5, 'pointer-events': 'none' }));
    overlays.append(svg('path', { d: `M ${origin.x - size} ${origin.y - size * 1.5} L ${origin.x + size} ${origin.y - size * 1.5} L ${origin.x} ${origin.y} Z`,
      fill: '#2563eb', opacity: 0.3, 'pointer-events': 'none', 'data-grid-origin': object.id }));
  }
  if (current.mode === 'start' || current.mode === 'end') drawSnapTargets(overlays, scene, endpointDragPoint(current, point), camera.zoom);
}
canvas.addEventListener('pointermove', event => {
  desk.pointer = world(event);
  if (!gesture) return;
  const p = world(event), delta = { x: p.x - gesture.start.x, y: p.y - gesture.start.y };
  if (gesture.mode !== 'pan' && gesture.mode !== 'marquee') { previewGesture(gesture, p); return; }
  if (gesture.mode === 'pan') {
    const s = screen(event); camera.x = gesture.camera.x + s.x - gesture.screen.x; camera.y = gesture.camera.y + s.y - gesture.screen.y; cameraChanged();

  } else {
    drawSelection();
    overlays.append(svg('rect', { x: Math.min(p.x, gesture.start.x), y: Math.min(p.y, gesture.start.y), width: Math.abs(delta.x), height: Math.abs(delta.y), fill: '#2563eb22', stroke: '#2563eb', 'stroke-width': 1 / camera.zoom }));
  }
});
function endGesture(event: PointerEvent, cancel = false) {
  const current = gesture; if (!current) return;
  gesture = null; busy = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (cancel) { render(); return; }
  const p = world(event);
  if (current.mode !== 'pan' && current.mode !== 'marquee' && !gestureOperations(current, p, camera.zoom).length) {
    drawSelection(); return;
  }
  attempt(() => {
    if (current.mode !== 'pan' && current.mode !== 'marquee') {
      const operations = gestureOperations(current, p, camera.zoom);
      if (operations.length) desk.execute({ actor: 'human', expectedRevision: current.revision, operations });
    } else if (current.mode === 'marquee') {
      const x1 = Math.min(p.x, current.start.x), x2 = Math.max(p.x, current.start.x);
      const y1 = Math.min(p.y, current.start.y), y2 = Math.max(p.y, current.start.y);
      const selected = desk.snapshot().filter(object => {
        const o = object.type === 'label' ? labelVisualBounds(object, descriptionsVisible) : bounds(object);
        return o.x >= x1 && o.y >= y1 && o.x + o.width <= x2 && o.y + o.height <= y2;
      }).map(o => o.id);
      desk.select([...new Set([...current.additive, ...selected])]);
    }
  });
}
canvas.addEventListener('pointerup', event => endGesture(event));
canvas.addEventListener('pointercancel', event => endGesture(event, true));
canvas.addEventListener('lostpointercapture', event => { if (gesture) endGesture(event, true); });
window.addEventListener('blur', () => { space = false; if (gesture) { gesture = null; busy = false; render(); } });
window.addEventListener('keydown', event => {
  if (editor.isActive()) return;
  if (event.key === 'Escape' && authoring.isPlacing()) { authoring.stopPlacement(); return; }
  if ((event.target as Element).closest('input,textarea,select') || colorControls.isOpen()) return;
  if (event.code === 'Space') { space = true; event.preventDefault(); }
  if (gesture) return;
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); attempt(() => { if (event.shiftKey) desk.redo(); else desk.undo(); }); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); attempt(() => { desk.redo(); }); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); attempt(() => { desk.select(desk.snapshot().map(o => o.id)); }); }
  if (event.key === 'Escape') attempt(() => { desk.select([]); });
});
window.addEventListener('keyup', event => { if (event.code === 'Space') space = false; });

async function addFiles(files: File[]) {
  authoring.stopPlacement();
  const operations: Operation[] = [];
  busy = true;
  try {
    for (const file of files) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type)) throw new Error('対応していない画像形式です');
      if (file.size > 5_000_000) throw new Error('画像は1枚5MB以下にしてください');
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('画像の読み込みに失敗しました')); reader.readAsDataURL(file);
      });
      const image = new Image(); image.src = src;
      await image.decode();
      const ratio = Math.min(1, 480 / image.naturalWidth, 360 / image.naturalHeight);
      operations.push({ kind: 'add', object: objectSchema.parse({
        id: `image-${crypto.randomUUID().slice(0, 8)}`, type: file.type === 'image/svg+xml' ? 'svg' : 'image', src,
        ...(gridEnabled ? gridPoint({ x: (120 - camera.x) / camera.zoom + operations.length * 24,
          y: (100 - camera.y) / camera.zoom + operations.length * 24 }) : {
          x: (120 - camera.x) / camera.zoom + operations.length * 24, y: (100 - camera.y) / camera.zoom + operations.length * 24 }),
        width: Math.max(180, image.naturalWidth * ratio), height: Math.max(1, image.naturalHeight * ratio) + 34, text: file.name,
      }) });
    }
    if (operations.length) attempt(() => { execute(operations); desk.select(operations.map(op => op.kind === 'add' ? op.object.id : '')); });
  } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  finally { busy = false; }
}
$('#clipboard').onclick = async () => {
  if (busy || editor.isActive()) return;
  authoring.stopPlacement(); busy = true;
  try {
    const files = await readClipboardFiles();
    if (files.length) await addFiles(files);
    else notify('クリップボードに画像またはSVGコードがありません', true);
  } catch (error) {
    notify(error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'クリップボードの読み取りを許可するか、Ctrl+Vで貼り付けてください'
      : error instanceof Error ? error.message : String(error), true);
  } finally { busy = false; }
};
$('#image').onclick = () => { authoring.stopPlacement(); $<HTMLInputElement>('#file').click(); };
$<HTMLInputElement>('#file').onchange = event => { const input = event.target as HTMLInputElement; void addFiles([...input.files ?? []]); input.value = ''; };
$('#workspace').addEventListener('dragover', event => { event.preventDefault(); });
$('#workspace').addEventListener('drop', event => { event.preventDefault(); if (!busy) void addFiles([...event.dataTransfer?.files ?? []]); });
window.addEventListener('paste', event => {
  if ((event.target as Element).closest('input,textarea') || busy) return;
  const files = [...event.clipboardData?.files ?? []];
  try {
    if (!files.length) {
      const file = svgClipboardFile(event.clipboardData?.getData('text/plain') ?? '');
      if (file) files.push(file);
    }
    if (files.length) { event.preventDefault(); void addFiles(files); }
  } catch (error) { event.preventDefault(); notify(error instanceof Error ? error.message : String(error), true); }
});

function connect(token: string, port: string) {
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || token.length < 24) { notify('有効なポートと接続トークンを入力してください', true); return; }
  const generation = ++connectionGeneration;
  clearTimeout(reconnectTimer); socket?.close();
  desk.point([]); drawSelection();
  const status = $('#connection'); status.textContent = '接続中'; status.classList.remove('connected');
  socket = new WebSocket(`ws://127.0.0.1:${port}/bridge?token=${encodeURIComponent(token)}`);
  const ws = socket;
  ws.onopen = () => { if (generation !== connectionGeneration) return; status.textContent = 'MCP接続済み'; status.classList.add('connected'); notify('AIと共有できる状態です'); };
  ws.onmessage = event => {
    let id: string | undefined;
    try {
      const message = JSON.parse(String(event.data)); id = message.id;
      if (typeof id !== 'string') throw new Error('Invalid request ID');
      if (busy || (editor.isActive() && ['execute', 'undo', 'redo', 'select'].includes(message.request.method))) throw new Error('Human editing in progress. Retry after it completes.');
      const result = dispatch(desk, message.request);
      ws.send(JSON.stringify({ id, result }));
      // Read-only requests must not rebuild iframes or steal form edits.
      if (message.request.method === 'point') drawSelection();
      if (['execute', 'undo', 'redo', 'select'].includes(message.request.method)) render();
    } catch (error) { ws.send(JSON.stringify({ id, error: error instanceof Error ? error.message : String(error) })); }
  };
  ws.onclose = () => {
    if (generation !== connectionGeneration) return;
    desk.point([]); drawSelection();
    status.textContent = '未接続 · 再接続待ち'; status.classList.remove('connected');
    reconnectTimer = setTimeout(() => connect(token, port), 3000);
  };
  ws.onerror = () => { if (generation === connectionGeneration) notify('接続できません。サーバー・トークン・他タブの接続を確認してください', true); };
}
$<HTMLFormElement>('#connect-form').onsubmit = event => { event.preventDefault(); connect($<HTMLInputElement>('#token').value, $<HTMLInputElement>('#port').value); };
const params = new URLSearchParams(location.hash.slice(1));
const initialToken = params.get('token'), initialPort = params.get('port') ?? '4317';
if (initialToken) {
  $<HTMLInputElement>('#token').value = initialToken; $<HTMLInputElement>('#port').value = initialPort;
  history.replaceState(null, '', location.pathname + location.search);
  connect(initialToken, initialPort);
}
render();
