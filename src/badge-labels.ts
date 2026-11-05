import { t } from './i18n';
import type { UiKey } from './i18n/dom';
import type { Reaction } from './reaction-values';
import type { ReactionPlacement } from './reaction-layout';
import type { StickerShape } from './sticker-shapes';

// Display labels only: document identifiers, symbols and stamp artwork stay unchanged.
export const reactionName = (value: Reaction) => t(`badges:reactions.${value}` as UiKey);
export const reactionPlacementName = (value: ReactionPlacement) => t(`badges:placements.${value}` as UiKey);
export const stickerShapeName = (value: StickerShape) => t(`badges:shapes.${value}` as UiKey);
export const stampCaption = (id: string) => t(`badges:stamps.${id}` as UiKey);
