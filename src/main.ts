import { createDeskMenu } from './desk-menu';
import './style.css';
import { Desk, dispatch, objectSchema, type DeskObject, type Operation } from './model';
import { anchorPoint, bounds, endpoints, isConnector, isShape } from './geometry';
import { createColorControls } from './color-controls';
import { drawConnector, drawShapeText, drawEndpointHandles, drawSnapTargets, updateScenePreview } from './diagram-drawing';
import { gestureOperations, gesturePreview, endpointDragPoint, type Gesture } from './diagram-gestures';
import { createPropertyEditor } from './property-editor';
import { frameColors } from './frame-colors';
import { createUiThemeButton, getUiTheme, setUiTheme } from './ui-theme';
import './ui-theme.css';
import './diagram.css';
import './authoring.css';
import { createInlineEditor } from './inline-editor';
import { createAuthoring } from './authoring';
import { creationAppearance, type Series } from './settings';
import { groupToolbar, iconButton } from './toolbar';
import { drawLabelDescription, labelVisualBounds } from './label-description';
import { gridPoint, gridOrigin } from './grid';
import { pinPath } from './pin-shape';
import { drawOpenLink } from './link-card';
import { readClipboardContent, svgClipboardFile, type ClipboardContent } from './clipboard';
import { PartClipboard, partClipboardType, singleClipboardUrl } from './part-clipboard';
import { effectivePinVisibility, pinTransform, pinScreenObject, pinThreadMembers, pinVisibilityNames, type PinVisibility } from './pin-series';
import { drawMarkdown } from './markdown';
import { createActivityLed } from './activity-led';
import { createDeskBackground } from './desk-background';
import './activity-led.css';
import { measureDeskText } from './text-measure';
import './markdown.css';
import { createSidebar } from './sidebar';
import './sidebar.css';
import { selectedConnection } from './connection-creation';
import { drawAiPointing } from './ai-pointing';
import { createReactionControls, drawReactions } from './reactions';
import './reactions.css';
import { createDeskFileControls } from './desk-file-controls';
import { IMAGE_TITLE_HEIGHT } from './image-geometry';
import { BrowserConnection } from './pairing-client';
import { createDeskIdentityControls } from './desk-identity-controls';
import './desk-identity.css';
import { createThinkingMode } from './thinking-mode';
import { headerIcon } from './header-icon';
import { addFormNumberPresets } from './number-presets';
import { createLineStylePicker } from './line-style-picker';
import { createEndpointPicker } from './endpoint-picker';
import { parseConnectionUrl } from './connection-url';
import { randomUuid } from './portable-crypto';
import { connectionControls } from './connection-controls';
import { fittedCamera } from './focus-camera';
import { cameraView, movedCamera, type CameraMove } from './camera-control';
import { HumanScrollGuard } from './camera-activity';
import { CameraAnimator, type AnimationOptions } from './camera-animation';
import { lockOperations, lockSelectionState } from './object-lock';
import { createLockControls } from './lock-controls';
import { drawLockedSelection } from './lock-drawing';

const desk = new Desk();
const partClipboard = new PartClipboard();
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
        <rect id="desk-background" width="100%" height="100%" fill="#f8fafc"/>
        <rect id="desk-wallpaper" width="100%" height="100%" fill="none"/>
        <rect id="desk-grid" width="100%" height="100%" fill="url(#dots)"/>
        <g id="viewport"><g id="objects"></g><g id="overlays"></g></g>
      </svg>
      <div id="empty">ここに資料を広げて、いっしょに考える。<small>上のツールから追加 · 画像をドロップ · AIからMCPで操作</small></div>
      <div class="hint">Shift / Ctrl＋クリック・範囲選択：追加選択 · Space＋ドラッグ / 中ボタン：パン · ホイール：ズーム · Delete：削除</div>
    </section>
    <aside>
      <section id="series-panel" hidden></section>
      <section><h2>選択・プロパティ</h2><div id="selected-label">未選択</div>
        <form id="properties" hidden>
          <label>X / 始点X<input name="x" type="number" step="any"></label><label>Y / 始点Y<input name="y" type="number" step="any"></label>
          <label hidden>終点X<input name="x2" type="number" step="any" disabled></label><label hidden>終点Y<input name="y2" type="number" step="any" disabled></label>
          <label>幅<input name="width" type="number" min="1" step="any"></label><label>高さ<input name="height" type="number" min="1" step="any"></label>
          <label hidden>塗り<input name="fill" type="text"></label><label hidden>線<input name="stroke" type="text"></label>
          <label>塗り透過（%）<input name="fillOpacity" type="number" min="0" max="100" step="1"></label>
          <label>線幅<input name="strokeWidth" type="number" min="0" step="any"></label><label>文字サイズ<input name="fontSize" type="number" min="1"></label>
          <label hidden>線種<select name="dash" disabled><option value="solid">実線</option><option value="dashed">破線</option><option value="dotted">点線</option></select></label>
          <label hidden>始点形状<select name="startMarker" disabled><option value="none">なし</option><option value="arrow">矢印</option><option value="circle">丸</option><option value="diamond">ひし形</option></select></label>
          <label hidden>終点形状<select name="endMarker" disabled><option value="none">なし</option><option value="arrow">矢印</option><option value="circle">丸</option><option value="diamond">ひし形</option></select></label>
          <label hidden>角丸<input name="cornerRadius" type="number" min="0" step="any"></label>
          <label hidden>内側の余白<input name="padding" type="number" min="0" step="any"></label>
          <label class="wide">テキスト<textarea name="text" rows="3"></textarea></label>
          <label class="wide">URL<input name="url" type="url"></label>
        </form>
        <button id="text-measure" type="button" hidden>文章の収まりを確認</button>
        <small id="text-measure-result" role="status" hidden></small>
        <div id="color-controls" hidden></div>
        <div id="reaction-controls" hidden></div>
        <small>図形のダブルクリックで文字編集。矢印の両端をドラッグして接続できます。</small>
        <div class="actions"><button id="front">最前面</button><button id="back">最背面</button><button id="delete">削除</button></div>
        <a id="open-url" hidden target="_blank" rel="noopener noreferrer">元のページをブラウザで開く ↗</a>
      </section>
      <section><h2>オブジェクトリスト <span id="count">0</span></h2><div id="object-list"></div></section>
      <section><h2>共通履歴</h2><div id="history"></div></section>
      <section><h2>MCP接続</h2><p>初回・手動接続はAIに受付を開いてもらい、接続URLを貼り付けて「接続」を押してください。通常の切断は自動復帰を待ちます。</p>
        <p id="connection-detail" role="status"></p>
        <form id="connect-form" novalidate><label for="connection-url">接続URL（貼り付け）</label><div class="connection-url-row"><input id="connection-url" type="password" autocomplete="off" spellcheck="false" placeholder="http://127.0.0.1:4317/#token=…&amp;port=4317"><button id="connection-show" type="button"></button><button id="connection-clear" type="button"></button></div>
          <small>#token=… を含むURLを貼り付けてください。LAN接続はAIの許可が必要です。HTTP通信は暗号化されません。接続を切り替えても机の内容は移動しません。</small>
          <button type="submit">接続</button></form>
        <button id="handoff-start" type="button">別端末へ渡す</button>
        <div id="handoff-panel" hidden><canvas id="handoff-qr" role="img" aria-label="別端末用の接続QR"></canvas><p>同じLANの端末で読み取ってください。有効期限5分・1回限り。机の内容は移動しません。HTTP通信は暗号化されません。QRは他人に見せないでください。</p><button id="handoff-hide" type="button">QRを隠す</button></div>
        <small>閉じる前に上部の「保存」で机を保存してください。「読込」で再開できます。</small>
      </section>
    </aside>
  </main>
  <footer><span id="message" role="status">準備完了</span></footer>
  <input id="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>
`;
groupToolbar(app.querySelector<HTMLElement>('nav')!);
createSidebar(app);
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
headerIcon($<HTMLButtonElement>('#undo'), 'undo', '元に戻す');
headerIcon($<HTMLButtonElement>('#redo'), 'redo', 'やり直す');
const canvas = app.querySelector<SVGSVGElement>('#canvas')!;
const deskBackground = createDeskBackground(canvas);
const viewport = app.querySelector<SVGGElement>('#viewport')!;
const objectsLayer = app.querySelector<SVGGElement>('#objects')!;
const overlays = app.querySelector<SVGGElement>('#overlays')!;
const drawnNodes = new Map<string, SVGGElement>();
let renderedScene: DeskObject[] = [];
const pinSeriesMap = new Map<string, Series>();
const renderedById = new Map<string, DeskObject>();
const form = $<HTMLFormElement>('#properties');
const propertyEditor = createPropertyEditor(form, desk, (id, patch) => {
  execute([{ kind: 'update', id, patch }]); render(); notify(`revision ${desk.revision} · ${desk.summary().count} オブジェクト`);
}, message => notify(message, true));
addFormNumberPresets(form);
const updateConnectorLineStyle = createLineStylePicker(form.elements.namedItem('dash') as HTMLSelectElement);
const updateStartMarker = createEndpointPicker(form.elements.namedItem('startMarker') as HTMLSelectElement, '始点形状', 'start');
const updateEndMarker = createEndpointPicker(form.elements.namedItem('endMarker') as HTMLSelectElement, '終点形状', 'end');
const camera = { x: 60, y: 50, zoom: 1 };
const humanScroll = new HumanScrollGuard();
const cameraAnimator = new CameraAnimator();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stopCamera = () => cameraAnimator.cancel('Human interaction or viewport change');
for (const event of ['pointerdown', 'touchstart', 'keydown', 'click', 'input']) {
  document.addEventListener(event, stopCamera, { capture: true, passive: true });
}
window.addEventListener('resize', stopCamera);
new ResizeObserver(stopCamera).observe(canvas);
document.addEventListener('visibilitychange', stopCamera);
window.addEventListener('pagehide', stopCamera);
reducedMotion.addEventListener('change', stopCamera);
// Capture before canvas zoom handlers; never cancel or delay the human input itself.
app.addEventListener('wheel', () => { stopCamera(); humanScroll.record(); }, { capture: true, passive: true });
document.addEventListener('scroll', () => { stopCamera(); humanScroll.record(); }, { capture: true, passive: true });
const cameraSize = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
function animateCamera(target: typeof camera, options: AnimationOptions) {
  if (document.hidden) throw new Error('Camera action cancelled: desk is hidden; do not retry automatically.');
  return cameraAnimator.run({ ...camera }, target, cameraSize(), next => {
    Object.assign(camera, next);
    cameraChanged(); drawSelection();
  }, reducedMotion.matches ? { durationMs: 0 } : options);
}
const cameraControls = {
  get: () => cameraView(camera, cameraSize()),
  async move(input: CameraMove) {
    const next = movedCamera(camera, cameraSize(), input);
    await animateCamera(next.camera, input);
    return { ...cameraView(camera, cameraSize()), zoomClamped: next.zoomClamped };
  },
};
let space = false;

let busy = false;
let pinVisibility: PinVisibility = 'all';
let gridEnabled = true;
function gridPosition(point: { x: number; y: number }) {
  const grid = desk.settingsSnapshot().grid;
  return grid.enabled ? gridPoint(point, grid) : point;
}
let gesture: Gesture | null = null;
const colorControls = createColorControls($('#color-controls'), operations => {
  if (busy || !operations.length) return;
  attempt(() => execute(operations));
});
const editor = createInlineEditor($('#workspace'), viewport, (object, patch, fresh) => {
  execute([fresh ? { kind: 'add', object: { ...object, ...patch } } : { kind: 'update', id: object.id, patch }], fresh ? 'desk' : 'exact');
  if (fresh) desk.select([object.id]);
  render();
});
const authoring = createAuthoring(desk, $('#authoring-tools'), $('#series-panel'), $<HTMLButtonElement>('#numbering'), $<HTMLButtonElement>('#selection-mode'), operations => {
  if (!busy) attempt(() => execute(operations));
});
const editActions = document.createElement('div'); editActions.className = 'toolbar-edit-actions';
editActions.setAttribute('role', 'group'); editActions.setAttribute('aria-label', '重なり順・リアクション');
for (const [id, icon, label] of [['front', '▣↑', '最前面'], ['back', '▣↓', '最背面']]) {
  const button = $<HTMLButtonElement>(`#${id}`); iconButton(button, icon, label); editActions.append(button);
}
editActions.append($('#reaction-controls'), $('#grid-snap')); $('.toolbar-parts').append(editActions);
const lockControls = createLockControls($('#grid-snap'), form, () => {
  if (busy || editor.isActive() || !desk.selected().length) return;
  attempt(() => {
    const objects = desk.selected().map(id => desk.get(id));
    const operations = lockOperations(objects, lockSelectionState(objects).nextLocked);
    if (operations.length) execute(operations);
  });
});
$('#numbering-settings').after($('#label-descriptions'));
$('main').append($('.toolbar-view'));
const activityLed = createActivityLed($('footer'));
const reactionControls = createReactionControls($('#reaction-controls'), () => desk.selected().map(id => desk.get(id)), operations => {
  if (!busy && !editor.isActive() && operations.length) attempt(() => execute(operations));
});
const thinkingMode = createThinkingMode($('header'), () => { cameraAnimator.cancel('Human-only thinking mode'); desk.point([]); drawSelection(); }, notify);
const identityControls = createDeskIdentityControls($('header'), desk,
  () => !busy && !gesture && !editor.isActive(), () => render(false), notify);
createDeskFileControls($('header'), desk, () => { partClipboard.clear(); render(); fitView(desk.selected()); },
  () => !busy && !gesture && !editor.isActive() && !identityControls.isEditing());
createUiThemeButton($('header'));
const deskMenu = createDeskMenu($('header'), desk, patch => {
  if (busy || gesture || editor.isActive()) { notify('操作が終わってから設定を変更してください', true); deskMenu.refresh(); return; }
  attempt(() => execute([{ kind: 'background_update', patch }]));
}, preview => {
  const background = desk.settingsSnapshot().background;
  deskBackground.update({ ...background, ...preview }, camera);
});
const labels: Record<DeskObject['type'], string> = { rect: '矩形', roundedRect: '角丸矩形', label: 'ピン', ellipse: '楕円', line: '線', text: 'テキスト', image: '画像', svg: 'SVG', web: 'Web資料', link: 'リンク' };
function objectListIncludes(object: DeskObject) {
  if ($('#object-filter-apply').getAttribute('aria-checked') !== 'true') return true;
  const category = object.type === 'label' ? 'pins' : object.type === 'text' ? 'text'
    : ['rect', 'roundedRect', 'ellipse'].includes(object.type) ? 'shapes'
      : object.type === 'line' ? 'lines'
        : ['image', 'svg'].includes(object.type) ? 'images' : 'other';
  return $(`#object-filter-${category}`).getAttribute('aria-pressed') === 'true';
}

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
function execute(operations: Operation[], snap: 'desk' | 'exact' = 'exact') { desk.execute({ actor: 'human', operations, snap }); }
function screen(event: PointerEvent | WheelEvent) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function world(event: PointerEvent | WheelEvent) {
  const p = screen(event);
  return { x: (p.x - camera.x) / camera.zoom, y: (p.y - camera.y) / camera.zoom };
}
function cameraChanged() {
  const settings = desk.settingsSnapshot();
  deskBackground.update(settings.background, camera);
  viewport.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);
  const grid = settings.grid, dots = app.querySelector('#dots')!;
  dots.setAttribute('width', String(grid.interval)); dots.setAttribute('height', String(grid.interval));
  dots.setAttribute('x', String(grid.origin.x - grid.interval / 2)); dots.setAttribute('y', String(grid.origin.y - grid.interval / 2));
  dots.querySelector('circle')!.setAttribute('cx', String(grid.interval / 2));
  dots.querySelector('circle')!.setAttribute('cy', String(grid.interval / 2));
  dots.setAttribute('patternTransform', `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`);
  $('#zoom-reset .tool-icon').textContent = `${Math.round(camera.zoom * 100)}%`;
  refreshPinPresentation();
  editor.reposition();
}
function zoom(factor: number, center = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }) {
  const old = camera.zoom;
  camera.zoom = Math.max(0.05, Math.min(8, old * factor));
  camera.x = center.x - (center.x - camera.x) * camera.zoom / old;
  camera.y = center.y - (center.y - camera.y) * camera.zoom / old;
  cameraChanged(); drawSelection();
}
function pinMode(object: DeskObject): PinVisibility {
  if (object.type !== 'label') return 'all';
  const series = pinSeriesMap.get(object.seriesId!);
  return effectivePinVisibility(pinVisibility, series?.visibility ?? 'all');
}
function pinIsVisible(object: DeskObject) { return pinMode(object) !== 'hidden'; }
function pinDescriptionVisible(object: DeskObject) { return pinMode(object) === 'all'; }
function connectorForView(object: DeskObject): DeskObject {
  if (!isConnector(object)) return object;
  const points = endpoints(object);
  for (const side of ['start', 'end'] as const) {
    const binding = object[side === 'start' ? 'startBinding' : 'endBinding'];
    const target = binding && renderedById.get(binding.objectId);
    if (target?.type === 'label') points[side] = anchorPoint(pinScreenObject(target, camera.zoom), binding!.anchor);
  }
  return { ...object, x: points.start.x, y: points.start.y, x2: points.end.x, y2: points.end.y };
}
function refreshPinPresentation() {
  for (const object of renderedScene) {
    const node = drawnNodes.get(object.id);
    if (!node) continue;
    if (object.type === 'label') node.setAttribute('transform', pinTransform(object, camera.zoom));
    else if (isConnector(object) && (object.startBinding || object.endBinding)) {
      const visual = connectorForView(object);
      node.setAttribute('transform', `translate(${visual.x} ${visual.y})`);
      node.replaceChildren(); drawConnector(node, visual, camera.zoom); drawReactions(node, visual, true);
    }
  }
}
function drawPinThreads(scene: DeskObject[]) {
  objectsLayer.querySelectorAll('[data-pin-thread]').forEach(node => node.remove());
  for (const series of pinSeriesMap.values()) {
    const thread = series.thread;
    if (!thread.enabled || !thread.visible || effectivePinVisibility(pinVisibility, series.visibility) === 'hidden') continue;
    const pins = pinThreadMembers(scene, series);
    if (pins.length < 2) continue;
    const first = scene.find(object => object.type === 'label' && object.seriesId === series.id);
    const before = first && drawnNodes.get(first.id);
    if (!before) continue;
    const points = pins.map(object => `${object.x + object.width / 2},${object.y + object.height}`).join(' ');
    const path = svg('polyline', { points, fill: 'none', stroke: thread.color, 'stroke-width': thread.width,
      'stroke-opacity': thread.opacity, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'data-pin-thread': series.id });
    if (thread.dash !== 'solid') path.setAttribute('stroke-dasharray', thread.dash === 'dashed'
      ? `${thread.width * 4} ${thread.width * 3}` : `${thread.width} ${thread.width * 2}`);
    objectsLayer.insertBefore(path, before);
  }
}
function drawObject(object: DeskObject) {
  if (!pinIsVisible(object)) return;
  object = connectorForView(object);
  const { width: w, height: h } = object;
  const group = svg('g', { transform: object.type === 'label' ? pinTransform(object, camera.zoom) : `translate(${object.x} ${object.y})`,
    'data-id': object.id, 'data-locked': String(!!object.locked) });
  drawnNodes.set(object.id, group);
  if (isConnector(object)) {
    drawConnector(group, object, camera.zoom); drawReactions(group, object, pinDescriptionVisible(object));
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
  drawLabelDescription(group, object, pinDescriptionVisible(object));
  if (object.type === 'text') {
    group.append(svg('rect', { width: w, height: h, rx: Math.min(object.cornerRadius, w / 2, h / 2), ...style }));
    drawMarkdown(group, object);
  }
  if (['link', 'web', 'image', 'svg'].includes(object.type)) {
    group.append(svg('rect', { width: w, height: h, rx: 6, fill: '#ffffff', stroke: '#94a3b8' }));
    const title = svg('text', { x: 12, y: 23, 'font-size': 14, fill: '#1d4ed8' });
    title.textContent = (object.text || object.url || '').slice(0, Math.max(0, Math.floor((w - 52) / 8))); group.append(title);
    if (['image', 'svg'].includes(object.type) && h > IMAGE_TITLE_HEIGHT) {
      // SVG stays in an image context, never inserted as executable markup.
      group.append(svg('image', { y: IMAGE_TITLE_HEIGHT, width: w, height: h - IMAGE_TITLE_HEIGHT, href: object.src!, preserveAspectRatio: 'xMidYMid meet' }));
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
  drawReactions(group, object, pinDescriptionVisible(object));
  objectsLayer.append(group);
}
function drawSelection(preview?: DeskObject[], scene = preview) {
  const colors = frameColors(desk.settingsSnapshot().background);
  $<HTMLButtonElement>('#clear-ai-pointing').disabled = desk.pointed().length === 0;
  const fit = $('#fit'), hasSelection = desk.selected().length > 0;
  fit.title = hasSelection ? '選択範囲を表示' : '全体表示';
  fit.setAttribute('aria-label', fit.title);
  fit.querySelector('.tool-caption')!.textContent = hasSelection ? '選択範囲' : '全体';
  overlays.replaceChildren();
  const selected = preview ?? desk.selected().map(id => desk.get(id));
  for (const object of desk.pointed().map(id => scene?.find(object => object.id === id) ?? desk.get(id)).filter(pinIsVisible))
    drawAiPointing(overlays, [connectorForView(object)], camera.zoom, pinDescriptionVisible(object), colors.pointing);
  for (const source of selected.filter(pinIsVisible)) {
    const object = connectorForView(source);
    if (object.locked) { drawLockedSelection(overlays, object, camera.zoom, pinDescriptionVisible(object), colors.selection); continue; }
    if (drawEndpointHandles(overlays, object, camera.zoom, selected.length === 1, colors.selection)) continue;
    const visual = labelVisualBounds(object, pinDescriptionVisible(object), camera.zoom);
    overlays.append(svg('rect', { x: visual.x - 3 / camera.zoom, y: visual.y - 3 / camera.zoom,
      width: visual.width + 6 / camera.zoom, height: visual.height + 6 / camera.zoom,
      fill: 'none', stroke: colors.selection, 'stroke-width': 1.5 / camera.zoom, 'stroke-dasharray': `${5 / camera.zoom} ${3 / camera.zoom}`, 'pointer-events': 'none', 'data-human-selection': object.id }));
    if (selected.length === 1 && object.type !== 'label') overlays.append(svg('rect', {
      x: object.x + object.width - 5 / camera.zoom, y: object.y + object.height - 5 / camera.zoom,
      width: 10 / camera.zoom, height: 10 / camera.zoom, fill: colors.selection, stroke: '#fff',
      'stroke-width': 1 / camera.zoom, 'data-resize': object.id, class: 'resize-handle',
    }));
  }
}
let previousObjectListSelection = '';
let pendingObjectListSelection = false;
function render(rebuild = true) {
  pinSeriesMap.clear();
  for (const series of desk.settingsSnapshot().series) pinSeriesMap.set(series.id, series);
  identityControls.refresh();
  deskMenu.refresh();
  if (rebuild) {
    objectsLayer.replaceChildren(); drawnNodes.clear();
    const objects = desk.snapshot(); renderedScene = objects;
    renderedById.clear(); for (const object of objects) renderedById.set(object.id, object);
    desk.imageGeometry.observe(objects);
    objects.forEach(drawObject);
    drawPinThreads(objects);
  }
  gridEnabled = desk.settingsSnapshot().grid.enabled;
  $('#grid-snap').setAttribute('aria-pressed', String(gridEnabled));
  cameraChanged(); drawSelection();
  $('#empty').hidden = desk.summary().count > 0;
  $('#revision').textContent = `revision ${desk.revision}`;
  $<HTMLButtonElement>('#undo').disabled = !desk.summary().canUndo;
  $<HTMLButtonElement>('#redo').disabled = !desk.summary().canRedo;
  const ids = desk.selected();
  colorControls.update(ids.map(id => desk.get(id)));
  reactionControls.update(ids.map(id => desk.get(id)));
  authoring.update();
  $('#selected-label').textContent = ids.length ? `${ids.length} 個選択 · ${ids.join(', ')}` : '未選択';
  form.hidden = ids.length !== 1;
  if (ids.length !== 1) propertyEditor.clear();
  // Human measurement UI is paused; the read-only MCP tool remains available.
  $<HTMLButtonElement>('#text-measure').hidden = true;
  $('#text-measure-result').textContent = '';
  const link = $<HTMLAnchorElement>('#open-url'); link.hidden = true;
  if (ids.length === 1) {
    const object = desk.get(ids[0]);
    propertyEditor.sync(object);
    updateConnectorLineStyle();
    updateStartMarker(); updateEndMarker();
    if (object.url) { link.href = object.url; link.hidden = false; }
  }
  lockControls.update(ids.map(id => desk.get(id)));
  for (const id of ['#front', '#back', '#delete']) $<HTMLButtonElement>(id).disabled = !ids.length;
  $('#object-list').replaceChildren();
  const listObjects = desk.snapshot().reverse().filter(objectListIncludes);
  const seriesNames = new Map(desk.settingsSnapshot().series.map(series => [series.id, series.name]));
  $('#count').textContent = String(listObjects.length);
  listObjects.forEach(object => {
    const button = document.createElement('button'); button.className = 'object-row';
    button.classList.toggle('active', ids.includes(object.id));
    const typeLabel = object.type === 'label' ? `ピン［${seriesNames.get(object.seriesId!) ?? object.seriesId}］` : labels[object.type];
    button.textContent = `${typeLabel} · ${object.text.slice(0, 22) || object.id}`;
    button.onclick = event => attempt(() => {
      const current = desk.selected();
      desk.select(event.shiftKey || event.ctrlKey ? current.includes(object.id) ? current.filter(id => id !== object.id) : [...current, object.id] : [object.id]);
      // Let the list's selection scroll settle before starting the camera flight.
      requestAnimationFrame(focusHumanSelection);
    });
    $('#object-list').append(button);
  });
  const selectionKey = JSON.stringify(ids.slice().sort());
  const panel = $('#panel-objects');
  if (selectionKey !== previousObjectListSelection) {
    previousObjectListSelection = selectionKey;
    pendingObjectListSelection = ids.length > 0;
  }
  if (!ids.length) pendingObjectListSelection = false;
  if (pendingObjectListSelection && !$('#sidebar').hidden && !panel.hidden) {
    pendingObjectListSelection = false;
    if (ids.length && !$('#sidebar').hidden && !panel.hidden) {
      const row = $('#object-list').querySelector<HTMLButtonElement>('.object-row.active');
      if (row) {
        const bounds = row.getBoundingClientRect();
        const visibleTop = panel.getBoundingClientRect().top + panel.clientTop;
        const visibleBottom = visibleTop + panel.clientHeight;
        if (bounds.top < visibleTop) panel.scrollTop -= visibleTop - bounds.top;
        else if (bounds.bottom > visibleBottom) panel.scrollTop += bounds.bottom - visibleBottom;
      }
    }
  }
  $('#history').replaceChildren();
  const changes = desk.getChanges(Math.max(0, desk.revision - 50), 50).changes.reverse();
  for (const change of changes) {
    const row = document.createElement('div'); row.className = 'history-row';
    const kinds = change.details.map(d => !d.before ? '追加' : !d.after ? '削除' : '変更');
    row.textContent = `r${change.revision} · ${change.actor} · ${change.operation === 'batch' ? [...new Set(kinds)].join(' / ') : change.operation} (${change.targets.length})`;
    row.title = change.targets.join(', '); $('#history').append(row);
  }
}
const objectListVisibility = new MutationObserver(() => {
  if (!$('#sidebar').hidden && !$('#panel-objects').hidden) render(false);
});
for (const element of [$('#sidebar'), $('#panel-objects')]) {
  objectListVisibility.observe(element, { attributes: true, attributeFilter: ['hidden'] });
}
app.addEventListener('object-filter-change', event => {
  const kind = (event as CustomEvent<{ kind: 'apply' | 'category' }>).detail.kind;
  if (kind === 'category' && $('#object-filter-apply').getAttribute('aria-checked') !== 'true') return;
  pendingObjectListSelection = desk.selected().some(id => objectListIncludes(desk.get(id)));
  render(false);
});
function newObject(type: DeskObject['type'], extra: Partial<DeskObject> = {}) {
  authoring.stopPlacement();
  const offset = desk.summary().count % 8 * 22;
  const center = { x: (120 - camera.x) / camera.zoom + offset, y: (100 - camera.y) / camera.zoom + offset };
  const object = objectSchema.parse({ id: `${type}-${randomUuid().slice(0, 8)}`, type, ...gridPosition(center),
    ...creationAppearance(type, desk.settingsSnapshot().defaults),
    ...(type === 'text' ? { width: 280, height: 80 } : {}),
    ...(['line', 'arrow'].includes(type) ? selectedConnection(desk.selected().map(id => desk.get(id))) : {}),
    ...(['web', 'link'].includes(type) ? { width: type === 'web' ? 480 : 320, height: type === 'web' ? 340 : 60 } : {}), ...extra });
  if (['text', 'web', 'link'].includes(type)) { editor.open(object, true); return; }
  execute([{ kind: 'add', object }], 'desk'); desk.select([object.id]);
}
app.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button => button.onclick = () => {
  const kind = button.dataset.add!;
  const type = (kind === 'arrow' ? 'line' : kind) as DeskObject['type'];
  if (!busy && !editor.isActive()) attempt(() => newObject(type, kind === 'arrow' ? { endMarker: 'arrow' } : {}));
});
$('#undo').onclick = () => attempt(() => { desk.undo(); });
$('#clear-ai-pointing').onclick = () => { desk.point([]); drawSelection(); };
$('#redo').onclick = () => attempt(() => { desk.redo(); });
function deleteSelection() {
  const ids = desk.selected(); if (ids.length) attempt(() => execute(ids.map(id => ({ kind: 'delete', id }))));
}
$('#delete').onclick = deleteSelection;
$('#front').onclick = () => attempt(() => execute(desk.selected().map(id => ({ kind: 'reorder', id, index: desk.summary().count - 1 }))));
$('#back').onclick = () => attempt(() => execute(desk.selected().slice().reverse().map(id => ({ kind: 'reorder', id, index: 0 }))));
$('#text-measure').onclick = () => {
  try {
  const report = measureDeskText(desk, desk.selected(), id => drawnNodes.get(id));
  $('#text-measure-result').textContent = report.measurements.map(item => {
    const name = desk.get(item.id).text.split('\n')[0].slice(0, 24) || item.id;
    if (item.status !== 'measured') return `${name}：${item.status === 'pending-fonts' ? 'フォント読込中' : item.status === 'unsupported' ? '対象外' : '測定できません'}`;
    const state = item.overflow!.x || item.overflow!.y
      ? `${item.overflow!.x ? '横にはみ出し' : ''}${item.overflow!.x && item.overflow!.y ? '・' : ''}${item.overflow!.y ? '縦にはみ出し' : ''}` : '枠内に収まっています';
    return `${name}：${state}。必要な高さ ${item.requiredHeight}（現在 ${item.frame.height}）${item.canFitByHeight ? '' : '。高さだけでは解消できません'}`;
  }).join('\n');
  } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
};
$('#zoom-in').onclick = () => zoom(1.25);
$('#zoom-out').onclick = () => zoom(0.8);
$('#zoom-reset').onclick = () => zoom(1 / camera.zoom);
$('#grid-snap').onclick = () => {
  if (!busy && !editor.isActive()) attempt(() => execute([{ kind: 'grid_update', patch: { enabled: !gridEnabled } }]));
};
function updatePinVisibilityButton() {
  const button = $('#label-descriptions');
  button.removeAttribute('aria-pressed');
  button.title = `すべてのピン：${pinVisibilityNames[pinVisibility]}（クリックで切替）`;
  button.setAttribute('aria-label', button.title);
  button.querySelector('.tool-caption')!.textContent = pinVisibilityNames[pinVisibility];
  button.dataset.pinVisibility = pinVisibility;
}
$('#label-descriptions').onclick = () => {
  pinVisibility = pinVisibility === 'all' ? 'pins' : pinVisibility === 'pins' ? 'hidden' : 'all';
  updatePinVisibilityButton(); render();
};
updatePinVisibilityButton();
function fitView(ids: string[], animation?: AnimationOptions) {
  const objects = (ids.length ? ids.map(id => desk.get(id)) : desk.snapshot()).filter(pinIsVisible)
    .map(object => pinDescriptionVisible(object) ? object : { ...object, description: '' });
  const next = fittedCamera(objects, canvas.clientWidth, canvas.clientHeight, true);
  if (!next) return;
  if (animation) return animateCamera(next, animation);
  cameraAnimator.cancel('Instant camera change');
  Object.assign(camera, next);
  cameraChanged(); drawSelection();
}
function focusHumanSelection() {
  void fitView(desk.selected(), {})?.catch(error => {
    if (!(error instanceof Error && error.message.startsWith('Camera animation cancelled:')))
      notify(error instanceof Error ? error.message : String(error), true);
  });
}
$('#fit').onclick = focusHumanSelection;
canvas.addEventListener('dblclick', event => {
  const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target as Element;
  if (target.closest('[data-open-url], [data-markdown-link]')) return;
  const id = target.closest('[data-id]')?.getAttribute('data-id');
  if (!id || busy || editor.isActive()) return;
  const object = desk.get(id);
  if (['rect', 'roundedRect', 'ellipse', 'text', 'link', 'web', 'label', 'image', 'svg'].includes(object.type)) editor.open(object);
});
canvas.addEventListener('wheel', event => { event.preventDefault(); if (!gesture) zoom(Math.exp(-event.deltaY * 0.001), screen(event)); }, { passive: false });
// Middle-button release can paste the Linux primary selection after the pan ends.
canvas.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
canvas.addEventListener('pointerdown', event => {
  if (gesture || editor.isActive() || (event.button !== 0 && event.button !== 1)) return;
  if (!space && (event.target as Element).closest('[data-open-url], [data-markdown-link]')) return;
  if (event.button === 0 && !space && authoring.place(gridPosition(world(event)))) { event.preventDefault(); return; }
  const target = event.target as Element;
  const resize = target.closest('[data-resize]')?.getAttribute('data-resize');
  const endpoint = target.closest('[data-endpoint]')?.getAttribute('data-endpoint');
  const id = target.closest('[data-id]')?.getAttribute('data-id');
  const p = world(event);
  let mode: Gesture['mode'];
  const extendSelection = event.shiftKey || event.ctrlKey;
  const additive = extendSelection ? desk.selected() : [];
  if (space || event.button === 1) mode = 'pan';
  else if (resize) mode = 'resize';
  else if (endpoint === 'start' || endpoint === 'end') mode = endpoint;
  else if (id) {
    const ids = desk.selected();
    if (extendSelection) {
      desk.select(ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]);
      render(false); if (!desk.selected().includes(id)) return;
    } else if (!ids.includes(id)) { desk.select([id]); render(false); }
    if (desk.get(id).locked) { event.preventDefault(); canvas.focus(); return; }
    mode = 'move';
  } else { if (!extendSelection) desk.select([]); render(); mode = 'marquee'; }
  const scene = desk.snapshot();
  gesture = { mode, start: p, screen: screen(event), originals: desk.selected().map(id => desk.get(id)), scene, snapScene: scene.filter(pinIsVisible), preview: scene, revision: desk.revision, camera: { x: camera.x, y: camera.y }, additive, grid: gridEnabled, gridSettings: desk.settingsSnapshot().grid, anchorId: id ?? resize ?? undefined, detach: event.altKey };
  busy = true; canvas.setPointerCapture(event.pointerId); event.preventDefault(); canvas.focus();
});
function previewGesture(current: Gesture, point: { x: number; y: number }) {
  const scene = gesturePreview(current, point, camera.zoom); renderedScene = scene;
  renderedById.clear(); for (const object of scene) renderedById.set(object.id, object);
  updateScenePreview(objectsLayer, scene, current.preview, drawObject); current.preview = scene;
  refreshPinPresentation(); drawPinThreads(scene);
  drawSelection(scene.filter(o => desk.selected().includes(o.id)), scene);
  if (current.mode === 'move') for (const object of scene.filter(o => o.type === 'label' && desk.selected().includes(o.id))) {
    const origin = gridOrigin(object), size = 5 / camera.zoom;
    overlays.append(svg('line', { x1: origin.x, y1: origin.y, x2: origin.x, y2: origin.y + size * 2,
      stroke: '#2563eb', 'stroke-width': 1 / camera.zoom, opacity: 0.5, 'pointer-events': 'none' }));
    overlays.append(svg('path', { d: `M ${origin.x - size} ${origin.y - size * 1.5} L ${origin.x + size} ${origin.y - size * 1.5} L ${origin.x} ${origin.y} Z`,
      fill: '#2563eb', opacity: 0.3, 'pointer-events': 'none', 'data-grid-origin': object.id }));
  }
  if (!current.detach && (current.mode === 'start' || current.mode === 'end')) drawSnapTargets(overlays, scene.filter(pinIsVisible).filter(object => !current.originals.some(o => o.id === object.id)).map(object => pinScreenObject(object, camera.zoom)), endpointDragPoint(current, point), camera.zoom);
}
canvas.addEventListener('pointermove', event => {
  desk.pointer = world(event);
  if (!gesture) return;
  gesture.detach = event.altKey;
  const p = world(event), delta = { x: p.x - gesture.start.x, y: p.y - gesture.start.y };
  if (gesture.mode !== 'pan' && gesture.mode !== 'marquee') { previewGesture(gesture, p); return; }
  if (gesture.mode === 'pan') {
    const s = screen(event); camera.x = gesture.camera.x + s.x - gesture.screen.x; camera.y = gesture.camera.y + s.y - gesture.screen.y; cameraChanged();

  } else {
    drawSelection();
    const color = frameColors(desk.settingsSnapshot().background).selection;
    overlays.append(svg('rect', { x: Math.min(p.x, gesture.start.x), y: Math.min(p.y, gesture.start.y), width: Math.abs(delta.x), height: Math.abs(delta.y), fill: color, 'fill-opacity': .13, stroke: color, 'stroke-width': 1 / camera.zoom }));
  }
});
function endGesture(event: PointerEvent, cancel = false) {
  const current = gesture; if (!current) return;
  gesture = null; busy = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (cancel) { render(); return; }
  current.detach = event.altKey;
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
      const selected = desk.snapshot().filter(pinIsVisible).filter(object => {
        const o = object.type === 'label' ? labelVisualBounds(object, pinDescriptionVisible(object), camera.zoom) : bounds(object);
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
        id: `image-${randomUuid().slice(0, 8)}`, type: file.type === 'image/svg+xml' ? 'svg' : 'image', src,
        ...gridPosition({ x: (120 - camera.x) / camera.zoom + operations.length * 24,
          y: (100 - camera.y) / camera.zoom + operations.length * 24 }),
        width: Math.max(180, image.naturalWidth * ratio), height: Math.max(1, image.naturalHeight * ratio) + 34, text: file.name,
      }) });
    }
    if (operations.length) attempt(() => { execute(operations); desk.select(operations.map(op => op.kind === 'add' ? op.object.id : '')); });
  } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  finally { busy = false; }
}
function clipboardTextTarget(target: EventTarget | null) {
  return editor.isActive() || identityControls.isEditing() || colorControls.isOpen()
    || target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
}
for (const kind of ['copy', 'cut'] as const) window.addEventListener(kind, event => {
  if (clipboardTextTarget(event.target) || !getSelection()?.isCollapsed || busy || gesture || !event.clipboardData) return;
  const selected = new Set(desk.selected());
  const objects = desk.snapshot().filter(object => selected.has(object.id));
  if (!objects.length) return;
  event.preventDefault();
  try {
    const copied = partClipboard.write(event.clipboardData, objects);
    if (kind === 'cut') {
      desk.execute({ actor: 'human', expectedRevision: desk.revision, operations: objects.map(object => ({ kind: 'delete', id: object.id })) });
      render();
    }
    notify(`${copied.count}パーツを${kind === 'cut' ? 'カット' : 'コピー'}しました${copied.text ? '' : '（机内の貼り付けのみ）'}`);
  } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
});
async function pasteClipboard(content: ClipboardContent) {
  authoring.stopPlacement();
  if (partClipboard.matches(content.token, content.html)) {
    desk.select(partClipboard.paste(desk));
    render(); notify(`${desk.selected().length}パーツを貼り付けました`);
    return;
  }
  if (content.files.length) { await addFiles(content.files); return; }
  const file = svgClipboardFile(content.text);
  if (file) { await addFiles([file]); return; }
  if (!content.text.trim()) { notify('貼り付けられる文字列・画像・SVGがありません', true); return; }
  if (content.text.length > 100_000) throw new Error('貼り付ける文字列は10万文字以下にしてください');
  const url = singleClipboardUrl(content.text);
  const id = `${url ? 'link' : 'text'}-${randomUuid()}`;
  const width = url ? 320 : 360;
  const lines = content.text.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 24)), 0);
  const height = url ? 60 : Math.min(1200, Math.max(120, (lines + 1) * desk.settingsSnapshot().defaults.fontSize * 1.5));
  execute([{ kind: 'add', object: { ...creationAppearance(url ? 'link' : 'text', desk.settingsSnapshot().defaults),
    id, type: url ? 'link' : 'text', ...gridPosition({ x: (120 - camera.x) / camera.zoom, y: (100 - camera.y) / camera.zoom }),
    width, height, text: url ?? content.text, ...(url ? { url } : {}) } }]);
  desk.select([id]); render(); notify(url ? 'リンクを貼り付けました' : 'テキストを貼り付けました');
}
$('#clipboard').onclick = async () => {
  if (busy || gesture || editor.isActive() || identityControls.isEditing()) return;
  const revision = desk.revision;
  busy = true;
  try {
    const content = await readClipboardContent();
    if (desk.revision !== revision) throw new Error('読み取り中に机が変更されました。もう一度貼り付けてください');
    await pasteClipboard(content);
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
// Some Linux browsers emit paste before auxclick, after pointerup has ended the pan.
// Keep its origin until the next independent mouse or keyboard action.
let middleCanvasPaste = false;
window.addEventListener('pointerdown', event => {
  middleCanvasPaste = event.button === 1 && event.target instanceof Node && canvas.contains(event.target)
    && !clipboardTextTarget(event.target);
}, true);
window.addEventListener('keydown', () => { middleCanvasPaste = false; }, true);
window.addEventListener('paste', event => {
  if (middleCanvasPaste) { event.preventDefault(); return; }
  if (clipboardTextTarget(event.target) || busy || gesture || !event.clipboardData) return;
  const data = event.clipboardData;
  const content: ClipboardContent = { text: data.getData('text/plain'), html: data.getData('text/html'),
    token: data.getData(partClipboardType), files: [...data.files] };
  if (!content.text && !content.files.length && !partClipboard.matches(content.token, content.html)) return;
  event.preventDefault();
  busy = true;
  void pasteClipboard(content).catch(error => notify(error instanceof Error ? error.message : String(error), true))
    .finally(() => { busy = false; });
});

const recovery = new BrowserConnection({
  beforeRelease: () => thinkingMode.assertAllowed('release'),
  handoff: url => { void connectionPanel.display(url); },
  handoffError: message => notify(message, true),
  disconnected: () => { activityLed.clear(); cameraAnimator.cancel('Desk disconnected'); desk.point([]); drawSelection(); },
  status: (state, detail) => {
    if (state === 'connected') connectionPanel.hide();
    const status = $('#connection');
    status.textContent = state === 'connected' ? 'MCP接続済み' : state === 'released' ? 'AI接続解放済み' : state === 'blocked' ? '接続確認が必要' : 'AI再接続待ち';
    status.classList.toggle('connected', state === 'connected');
    status.classList.toggle('error', state === 'blocked');
    $('#connection-detail').textContent = detail;
    if (state === 'blocked') notify(detail, true);
    else if ($('#message').dataset.connection === 'true') notify('');
    $('#message').dataset.connection = state === 'blocked' ? 'true' : 'false';
  },
});
const connectionPanel = connectionControls(app, () => recovery.requestHandoff(), message => notify(message, true));
function connect(token: string, port: string, manual = false, host = '127.0.0.1') {
  if (manual && (recovery.hasPairing() || desk.summary().count > 0) && !confirm('机の内容を保持したまま、接続先のペアリングを置き換えますか？')) return;
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || token.length < 22) { notify('有効なポートと接続トークンを入力してください', true); return; }

  // Do not serialize flights in the protocol chain: reads/release must remain responsive.
  recovery.connect(token, port, async (ws, event) => {
    let id: string | undefined;
    try {
      const message = JSON.parse(String(event.data)); id = message.id;
      if (typeof id !== 'string') throw new Error('Invalid request ID');
      if (typeof message.request?.method === 'string') activityLed.pulse(message.request.method);
      thinkingMode.assertAllowed(message.request?.method);
      if (['fit', 'camera_move'].includes(message.request.method)) humanScroll.assertIdle();
      if ((busy && message.request.method !== 'camera_get') || ((editor.isActive() || identityControls.isEditing()) && ['execute', 'lock', 'undo', 'redo', 'select', 'load_document'].includes(message.request.method))) throw new Error('Human editing in progress. Retry after it completes.');
      if (['fit', 'camera_move'].includes(message.request.method) && (gesture || editor.isActive() || identityControls.isEditing())) throw new Error('Human editing in progress. No camera change was made.');
      if (message.request.method === 'load_document') cameraAnimator.cancel('Desk contents replaced');
      let result = dispatch(desk, message.request, cameraControls, ids => measureDeskText(desk, ids, id => drawnNodes.get(id)), { get: () => ({ theme: getUiTheme() }), set: setUiTheme });
      if (message.request.method === 'camera_move') result = await result;
      if (message.request.method === 'fit') {
        const ids = desk.pointed();
        await fitView(ids, { durationMs: message.request.durationMs });
        result = { ids, scope: ids.length ? 'selection' : 'all', camera: { ...camera } };
      }
      ws.send(JSON.stringify({ id, result }));
      // Read-only requests must not rebuild iframes or steal form edits.
      if (message.request.method === 'point') drawSelection();
      if (['execute', 'lock', 'undo', 'redo', 'select', 'load_document'].includes(message.request.method)) render();
      if (message.request.method === 'load_document') { partClipboard.clear(); fitView(desk.selected()); }
    } catch (error) { ws.send(JSON.stringify({ id, error: error instanceof Error ? error.message : String(error) })); }
  }, manual, host);
}
let connectionAttempt = 0;
async function connectUrl(value: string, manual: boolean) {
  const attempt = ++connectionAttempt;
  let allowedHosts = ['127.0.0.1', 'localhost'];
  try {
    const response = await fetch('/connection-policy', { cache: 'no-store' });
    if (response.ok) {
      const policy = await response.json();
      if (Array.isArray(policy.allowedHosts) && policy.allowedHosts.every((host: unknown) => typeof host === 'string')) allowedHosts = policy.allowedHosts;
    }
  } catch { /* Fail closed for LAN; local URLs remain usable during downtime. */ }
  if (attempt !== connectionAttempt) return;
  const parsed = parseConnectionUrl(value, allowedHosts);
  if (!parsed.token) throw new Error('接続URLに #token=… を含めてください。環境変数のトークンはAIから表示されません。');
  connect(parsed.token, parsed.port, manual, parsed.host);
}
$<HTMLFormElement>('#connect-form').onsubmit = event => {
  event.preventDefault();
  try {
    const url = $<HTMLInputElement>('#connection-url');
    void connectUrl(url.value, true).catch(error => notify(error instanceof Error ? error.message : String(error), true));
  } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
};
if (location.hash) {
  const initialUrl = location.href;
  history.replaceState(null, '', location.pathname + location.search);
  $<HTMLInputElement>('#connection-url').value = initialUrl;
  void connectUrl(initialUrl, false).catch(error => notify(error instanceof Error ? error.message : String(error), true));
}
render();
