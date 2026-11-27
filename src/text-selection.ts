import { t } from './i18n';
import { copySelectedMarkdown } from './text-selection-copy';

const holdMilliseconds = 600;
const moveTolerance = 6; // CSS pixels, independent of desk zoom.
const interactive = 'a,input,button,[data-markdown-task],[data-open-url],[data-open-media],[data-open-desk]';

/** Transient browser text selection; never edits the desk or its history. */
export function createTextSelection(canvas: SVGSVGElement, options: {
  canStart: () => boolean;
  enter: (id: string, pointerId?: number) => boolean;
  announce: (message: string) => void;
  changed?: () => void;
}) {
  let pending: { host: HTMLElement; id: string; pointerId: number; x: number; y: number; input: string; timer: ReturnType<typeof setTimeout> } | undefined;
  let active: { host: HTMLElement; input: string; tabIndex: string | null } | undefined;
  let heldPointer: number | undefined;
  const nativePointers = new Set<number>();
  const cancelHold = () => { if (pending) clearTimeout(pending.timer); pending = undefined; };
  const exit = () => {
    cancelHold(); heldPointer = undefined;
    nativePointers.clear();
    if (!active) return;
    const { host, tabIndex } = active;
    const selection = getSelection();
    if (selection && (host.contains(selection.anchorNode) || host.contains(selection.focusNode))) selection.removeAllRanges();
    delete host.dataset.textSelection;
    if (tabIndex === null) host.removeAttribute('tabindex'); else host.setAttribute('tabindex', tabIndex);
    delete canvas.dataset.textSelection; active = undefined;
    options.changed?.();
  };
  const inside = (target: EventTarget | null) => !!active && target instanceof Node && active.host.contains(target);
  const enterMode = (id: string, host: HTMLElement, input: string, range?: Range) => {
    exit();
    active = { host, input, tabIndex: host.getAttribute('tabindex') };
    host.dataset.textSelection = 'active'; host.tabIndex = -1; canvas.dataset.textSelection = id;
    const selection = getSelection(); selection?.removeAllRanges();
    host.focus({ preventScroll: true });
    if (range) selection?.addRange(range);
    options.announce(t('editing:textSelectionMode'));
    options.changed?.();
  };
  canvas.addEventListener('pointerdown', event => {
    if (active && inside(event.target)) {
      if (event.button === 0) nativePointers.add(event.pointerId);
      return;
    }
    if (active && event.button === 1 && event.pointerType === 'mouse') return;
    if (active) exit();
    cancelHold();
    if (event.button !== 0 || !event.isPrimary || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || !options.canStart()) return;
    const target = event.target as Element;
    const host = target.closest<HTMLElement>('.markdown-text');
    const id = host?.closest('[data-id]')?.getAttribute('data-id');
    if (!host || !id || target.closest(interactive)) return;
    const timer = setTimeout(() => {
      const candidate = pending; pending = undefined;
      if (!candidate?.host.isConnected || !options.enter(candidate.id, candidate.pointerId)) return;
      enterMode(candidate.id, candidate.host, candidate.input);
      heldPointer = candidate.pointerId;
    }, holdMilliseconds);
    pending = { host, id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, input: event.pointerType, timer };
  }, true);
  window.addEventListener('pointerdown', event => {
    if (active && !canvas.contains(event.target as Node) && event.button !== 1) exit();
    if (pending && event.pointerId !== pending.pointerId) cancelHold();
  }, true);
  window.addEventListener('pointermove', event => {
    if (pending?.pointerId === event.pointerId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > moveTolerance) cancelHold();
  }, true);
  for (const kind of ['pointerup', 'pointercancel'] as const) window.addEventListener(kind, event => {
    nativePointers.delete(event.pointerId);
    if (pending?.pointerId === event.pointerId) cancelHold();
    if (heldPointer === event.pointerId) { heldPointer = undefined; event.preventDefault(); event.stopPropagation(); }
  }, true);
  canvas.addEventListener('contextmenu', event => { if (pending) event.preventDefault(); });
  canvas.addEventListener('click', event => { if (inside(event.target)) event.preventDefault(); }, true);
  canvas.addEventListener('dragstart', event => { if (active) event.preventDefault(); });
  window.addEventListener('keydown', event => {
    if (!active) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,button')) { exit(); return; }
    event.stopImmediatePropagation();
    const key = event.key.toLowerCase(), modified = event.ctrlKey || event.metaKey;
    if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace' || modified && ['x', 'v', 'z', 'y', 'g'].includes(key)) event.preventDefault();
    if (modified && key === 'a') {
      event.preventDefault();
      const range = document.createRange(); range.selectNodeContents(active.host);
      const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    }
  }, true);
  for (const kind of ['copy', 'cut', 'paste'] as const) window.addEventListener(kind, event => {
    if (!active) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (kind !== 'copy' || !event.clipboardData) return;
    const selection = getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0).cloneRange();
    const bounds = document.createRange(); bounds.selectNodeContents(active.host);
    // Copy only this card, even if a drag has extended the native range outside it.
    if (range.compareBoundaryPoints(Range.END_TO_START, bounds) >= 0 || range.compareBoundaryPoints(Range.START_TO_END, bounds) <= 0) return;
    if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) range.setStart(bounds.startContainer, bounds.startOffset);
    if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) range.setEnd(bounds.endContainer, bounds.endOffset);
    const contained = active.host.contains(selection.anchorNode) && active.host.contains(selection.focusNode);
    event.clipboardData.setData('text/plain', copySelectedMarkdown(active.host, range, contained ? selection.toString() : range.toString()));
  }, true);
  window.addEventListener('blur', () => { cancelHold(); heldPointer = undefined; nativePointers.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) exit(); });
  return {
    isInteracting: () => !!pending || heldPointer !== undefined || nativePointers.size > 0,
    activate(id: string, host: HTMLElement, range?: Range) {
      if (!host.isConnected || !options.enter(id)) throw new Error('Cannot enter text selection during human editing');
      enterMode(id, host, 'mouse', range);
    },
    exit,
    isPending: (pointerId: number) => pending?.pointerId === pointerId,
    blocksPointer: (event: PointerEvent) => !!active && (inside(event.target) && event.button !== 1 || active.input !== 'mouse'),
    blocksDoubleClick: () => !!active,
    blocksWheel: () => !!active && active.input !== 'mouse',
  };
}
