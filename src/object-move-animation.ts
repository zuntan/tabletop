import type { DeskObject } from './model';
import { clipGroup } from './clip-bundles';
import type { FrameScheduler } from './camera-animation';

const positions = ['x', 'y', 'x2', 'y2'] as const;
const close = (a: number, b: number) => Math.abs(a - b) < 1e-7;
function appearance(object: DeskObject) {
  const { x, y, x2, y2, callout, ...rest } = object;
  if (object.type === 'line') { delete (rest as Partial<DeskObject>).width; delete (rest as Partial<DeskObject>).height; }
  if (!callout) return { ...rest, callout };
  const { x: tipX, y: tipY, ...tail } = callout;
  return { ...rest, callout: tail };
}
export type MoveFlight = { ids: string[]; durationMs: number; at: (progress: number) => DeskObject[] };
/** Animate only a pure, common translation of the AI pointing set. Use resolved
 * final geometry, so snapping, bundles and attached endpoints share one timeline. */
export function pointedMove(before: DeskObject[], after: DeskObject[], pointed: string[], operations: unknown[]): MoveFlight | null {
  if (!pointed.length || !operations.length || before.length !== after.length) return null;
  const allowed = new Set(pointed.flatMap(id => clipGroup(before, id).map(object => object.id)));
  const updated = new Set<string>();
  for (const value of operations) {
    const op = value as {kind?: string; id?: string; patch?: Record<string, unknown>};
    if (op.kind !== 'update' || !op.id || !allowed.has(op.id) || updated.has(op.id) || !op.patch) return null;
    const keys = Object.keys(op.patch);
    if (!keys.length || keys.some(key => !(positions as readonly string[]).includes(key))) return null;
    updated.add(op.id);
  }
  const oldById = new Map(before.map(object => [object.id, object]));
  const newById = new Map(after.map(object => [object.id, object]));
  if (before.some((object, index) => object.id !== after[index].id || JSON.stringify(appearance(object)) !== JSON.stringify(appearance(after[index])))) return null;
  const first = oldById.get([...updated][0])!, last = newById.get(first.id)!;
  const dx = last.x - first.x, dy = last.y - first.y;
  if (close(dx, 0) && close(dy, 0)) return null;
  for (const id of new Set([...pointed, ...updated])) {
    const old = oldById.get(id), next = newById.get(id);
    if (!old || !next || !close(next.x - old.x, dx) || !close(next.y - old.y, dy)) return null;
    if (old.x2 !== undefined && (!close(next.x2! - old.x2, dx) || !close(next.y2! - old.y2!, dy))) return null;
  }
  return {
    ids: [...pointed], durationMs: 350,
    at(progress) {
      if (progress <= 0) return before;
      if (progress >= 1) return after;
      const t = 1 - (1 - progress) ** 3;
      return after.map(next => {
        const old = oldById.get(next.id)!, frame = { ...next };
        for (const key of positions) if (old[key] !== undefined && next[key] !== undefined) frame[key] = old[key]! + (next[key]! - old[key]!) * t;
        if (old.callout && next.callout) frame.callout = { ...next.callout,
          x: old.callout.x + (next.callout.x - old.callout.x) * t,
          y: old.callout.y + (next.callout.y - old.callout.y) * t };
        return frame;
      });
    },
  };
}
const frames: FrameScheduler = {
  request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
  timeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: id => clearTimeout(id),
};
/** Logical state is already committed once. Interrupting the presentation shows
 * that final state immediately, never creates an intermediate Undo or replays. */
export class ObjectMoveAnimator {
  private stop?: () => void;
  constructor(private scheduler: FrameScheduler = frames) {}
  finish() { this.stop?.(); }
  get active() { return !!this.stop; }
  run(flight: MoveFlight, apply: (scene: DeskObject[]) => void, finish: () => void): Promise<'completed' | 'interrupted'> {
    this.finish();
    return new Promise((resolve, reject) => {
      let frame: number | undefined, start: number | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (frame !== undefined) this.scheduler.cancel(frame);
        if (deadline !== undefined) this.scheduler.clearTimeout(deadline); this.stop = undefined;
      };
      const settle = (status: 'completed' | 'interrupted') => {
        cleanup();
        try { finish(); resolve(status); } catch (error) { reject(error); }
      };
      this.stop = () => settle('interrupted');
      deadline = this.scheduler.timeout(() => this.finish(), flight.durationMs + 1000);
      const tick = (timestamp: number) => {
        start ??= timestamp;
        const progress = Math.min(1, Math.max(0, (timestamp - start) / flight.durationMs));
        try { apply(flight.at(progress)); }
        catch (error) { cleanup(); try { finish(); } catch { /* Preserve the original rendering error. */ } reject(error); return; }
        if (progress === 1) settle('completed'); else frame = this.scheduler.request(tick);
      };
      try { apply(flight.at(0)); frame = this.scheduler.request(tick); }
      catch (error) { cleanup(); try { finish(); } catch { /* Preserve the original rendering error. */ } reject(error); }
    });
  }
}
