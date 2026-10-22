// Shared by the editor and the canvas iframe runtime. No imports: anything imported here is
// bundled into the iframe (lib/editor/canvas/preview-runtime.bundle.ts).

/** Tag on every canvas message, so unrelated postMessage traffic is ignored. */
export const CANVAS_SOURCE = 'launchpad-canvas';

/** Per-load channel id, in createId() format. */
export const CHANNEL_PATTERN = /^[a-z0-9]{10}$/;

export interface KeyInput {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export interface CanvasRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Keys the canvas forwards to the editor: mod+Z/Y/D, Delete, Backspace, Escape, Alt+↑/↓. */
export function isForwardedShortcut({ key, mod, alt }: KeyInput): boolean {
  if (mod && !alt) return ['z', 'y', 'd'].includes(key.toLowerCase());
  if (alt) return !mod && (key === 'ArrowUp' || key === 'ArrowDown');
  return key === 'Delete' || key === 'Backspace' || key === 'Escape';
}
