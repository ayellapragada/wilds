import { assetUrl } from './assets';

export const FRAME_WIDTH = 54;
export const FRAME_HEIGHT = 63;
export const AVATAR_COUNT = 38;
export const SHEET_URL = assetUrl('sprites/trainers-clean.png');

export function getFramePosition(avatarId: number): { x: number; y: number } {
  return { x: avatarId * FRAME_WIDTH, y: 0 };
}
