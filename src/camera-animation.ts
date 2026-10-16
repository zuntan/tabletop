import { interpolateZoom } from 'd3-interpolate';
import { cameraView, type Camera, type CameraSize } from './camera-control';

export type AnimationOptions = { durationMs?: number };
export type FrameScheduler = {
  request: (callback: (timestamp: number) => void) => number;
  cancel: (id: number) => void;
  timeout: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
};
const browserScheduler: FrameScheduler = {
  request: callback => requestAnimationFrame(callback),
  cancel: id => cancelAnimationFrame(id),
  timeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: id => clearTimeout(id),
};

/** D3's view width is measured in world units; duration depends on screen distance. */
export function cameraFlight(from: Camera, to: Camera, size: CameraSize, options: AnimationOptions = {}) {
  const a = cameraView(from, size), b = cameraView(to, size);
  const distance = Math.hypot((b.center.x - a.center.x) * from.zoom / size.width, (b.center.y - a.center.y) * from.zoom / size.height);
  const zoomDistance = Math.abs(Math.log2(to.zoom / from.zoom));
  const unchanged = distance < 1e-10 && zoomDistance < 1e-10;
  const durationMs = unchanged ? 0 : options.durationMs ?? Math.min(900, 250 + 160 * Math.log2(1 + distance) + 100 * zoomDistance);
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 2000) throw new Error('durationMs must be between 0 and 2000');
  const interpolate = interpolateZoom([a.center.x, a.center.y, a.visibleBounds.width], [b.center.x, b.center.y, b.visibleBounds.width]);
  return {
    durationMs,
    at(progress: number): Camera {
      if (progress <= 0) return { ...from };
      if (progress >= 1) return { ...to };
      const t = progress * progress * (3 - 2 * progress);
      const [x, y, width] = interpolate(t);
      const zoom = Math.max(0.05, Math.min(8, size.width / width));
      return { x: size.width / 2 - x * zoom, y: size.height / 2 - y * zoom, zoom };
    },
  };
}

/** One browser-local flight. Cancellation never writes a target or restores an old view. */
export class CameraAnimator {
  private stop?: (reason: string) => void;
  constructor(private scheduler: FrameScheduler = browserScheduler) {}
  cancel(reason = 'Human interaction') { this.stop?.(reason); }
  run(from: Camera, to: Camera, size: CameraSize, apply: (camera: Camera) => void, options: AnimationOptions = {}): Promise<void> {
    const flight = cameraFlight(from, to, size, options);
    this.cancel('Superseded by another camera command');
    if (!flight.durationMs) { apply({ ...to }); return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      let frame: number | undefined, start: number | undefined;
      const cleanup = () => {
        if (frame !== undefined) this.scheduler.cancel(frame);
        this.scheduler.clearTimeout(deadline);
        this.stop = undefined;
      };
      this.stop = reason => {
        cleanup();
        reject(new Error(`Camera animation cancelled: ${reason}. View remains at its current position; do not retry automatically.`));
      };
      // Hidden/throttled frames must not leave the server's request pending indefinitely.
      const deadline = this.scheduler.timeout(() => this.cancel('Animation deadline exceeded'), flight.durationMs + 1000);
      const tick = (timestamp: number) => {
        start ??= timestamp;
        const progress = Math.min(1, Math.max(0, (timestamp - start) / flight.durationMs));
        try { apply(flight.at(progress)); }
        catch (error) { cleanup(); reject(error); return; }
        if (progress === 1) { cleanup(); resolve(); }
        else frame = this.scheduler.request(tick);
      };
      frame = this.scheduler.request(tick);
    });
  }
}
