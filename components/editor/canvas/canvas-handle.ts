import type { CanvasGeometry } from './overlay';

/** What the drag layer needs from the canvas: where it is, how it is scaled, and its rects. */
export interface CanvasHandle {
  frame(): HTMLIFrameElement | null;
  scale(): number;
  geometry(): CanvasGeometry | null;
  /** Canvas px; the iframe answers with rects even at the scroll edge (D-034). */
  scrollBy(dy: number): void;
  onGeometry(listener: () => void): () => void;
}
