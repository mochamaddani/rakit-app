// Entry for the canvas iframe runtime; `pnpm assets` bundles it into preview-runtime.generated.ts.
import { startPreviewRuntime } from './runtime';

const self = document.currentScript;
let injected: HTMLScriptElement | null = null;

startPreviewRuntime({
  win: window,
  channel: self instanceof HTMLScriptElement ? (self.dataset.lpChannel ?? '') : '',
  post: (message) => window.parent.postMessage(message, '*'),
  isFromParent: (event) => event.source === window.parent,
  runScript: (code) => {
    const script = document.createElement('script');
    script.textContent = code;
    injected?.remove();
    document.body.insertBefore(script, self && self.parentNode === document.body ? self : null);
    injected = script;
  },
});
