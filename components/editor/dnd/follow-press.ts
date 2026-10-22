import type { DragController } from '@/lib/editor/dnd/controller';

/**
 * Follows a press on the window until it ends (docs/DECISIONS.md D-043): pointer moves, the
 * release, pointercancel and window blur. While a drag is active every key is swallowed, so
 * editor shortcuts never fire mid-drag, and Escape cancels. Returns a function that detaches.
 */
export function followPress(controller: DragController): () => void {
  const onMove = (event: PointerEvent) => controller.move(event);
  const onUp = (event: PointerEvent) => {
    controller.up(event);
    if (controller.state === 'idle') detach();
  };
  const onCancel = () => {
    controller.cancel();
    detach();
  };
  const onKey = (event: KeyboardEvent) => {
    if (controller.state !== 'dragging') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === 'Escape') onCancel();
  };
  function detach() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('blur', onCancel);
    window.removeEventListener('keydown', onKey, true);
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('blur', onCancel);
  window.addEventListener('keydown', onKey, true);
  return detach;
}
