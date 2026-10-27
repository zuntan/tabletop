import type {WayfinderStartInput} from './wayfinder-input';
import { z } from 'zod';

const worldPoint = z.object({
  x: z.number().finite().min(-2_000_000).max(2_000_000),
  y: z.number().finite().min(-2_000_000).max(2_000_000),
}).strict();
export const cameraAnimationFields = { durationMs: z.number().finite().min(0).max(2000).optional() };
export const cameraMoveFields = {
  ...cameraAnimationFields,
  center: worldPoint.optional(),
  pan: worldPoint.optional(),
  zoom: z.number().finite().min(0.05).max(8).optional(),
  zoomBy: z.number().finite().min(0.01).max(100).optional(),
};
export const cameraMoveSchema = z.object(cameraMoveFields).strict().superRefine((move, context) => {
  if (move.center && move.pan) context.addIssue({ code: 'custom', message: 'Use center or pan, not both' });
  if (move.zoom !== undefined && move.zoomBy !== undefined) context.addIssue({ code: 'custom', message: 'Use zoom or zoomBy, not both' });
  if ([move.center, move.pan, move.zoom, move.zoomBy].every(value => value === undefined)) context.addIssue({ code: 'custom', message: 'Specify center, pan, zoom or zoomBy' });
});
export type CameraMove = z.infer<typeof cameraMoveSchema>;
export type Camera = { x: number; y: number; zoom: number };
export type CameraSize = { width: number; height: number };
export type CameraBridge = { get: () => unknown; move: (input: CameraMove) => unknown; wayfinderStart?: (input:WayfinderStartInput)=>unknown };

/** World coordinates are independent of CSS pixels, device pixel ratio and page position. */
export function cameraView(camera: Camera, size: CameraSize) {
  if (![size.width, size.height, camera.x, camera.y, camera.zoom].every(Number.isFinite) || size.width <= 0 || size.height <= 0 || camera.zoom <= 0) {
    throw new Error('Camera viewport is unavailable; no camera change was made.');
  }
  const width = size.width / camera.zoom, height = size.height / camera.zoom;
  const x = -camera.x / camera.zoom, y = -camera.y / camera.zoom;
  return {
    center: { x: x + width / 2, y: y + height / 2 },
    zoom: camera.zoom,
    viewport: { ...size },
    visibleBounds: { x, y, width, height },
  };
}

/** Positive pan moves the VIEW right/down; zoom alone preserves the current world center. */
export function movedCamera(camera: Camera, size: CameraSize, input: unknown) {
  const move = cameraMoveSchema.parse(input);
  const before = cameraView(camera, size);
  const center = move.center ?? { x: before.center.x + (move.pan?.x ?? 0), y: before.center.y + (move.pan?.y ?? 0) };
  const requestedZoom = move.zoom ?? camera.zoom * (move.zoomBy ?? 1);
  const zoom = Math.max(0.05, Math.min(8, requestedZoom));
  const next = { x: size.width / 2 - center.x * zoom, y: size.height / 2 - center.y * zoom, zoom };
  if (!Object.values(next).every(Number.isFinite)) throw new Error('Camera result is not finite; no camera change was made.');
  return { camera: next, zoomClamped: zoom !== requestedZoom };
}
