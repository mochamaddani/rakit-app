'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRef, type KeyboardEvent } from 'react';
import type { Viewport } from '@/lib/editor/store';
import { cn } from '@/lib/utils';
import { useEditor } from './editor-context';

const VIEWPORTS: ReadonlyArray<{ value: Viewport; label: string }> = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];

export function TopBar({ name }: { name: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
      <Link
        href="/dashboard"
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Pages
      </Link>
      <h1 className="min-w-0 truncate text-sm font-semibold">{name}</h1>
      <div className="ml-auto flex items-center gap-2">
        <ViewportToggle />
      </div>
    </header>
  );
}

/** A radio group (roving focus, arrow keys) for the canvas width. */
function ViewportToggle() {
  const viewport = useEditor((s) => s.viewport);
  const setViewport = useEditor((s) => s.setViewport);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + VIEWPORTS.length) % VIEWPORTS.length;
    setViewport(VIEWPORTS[next]!.value);
    buttons.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Preview width" className="flex rounded-lg border p-0.5">
      {VIEWPORTS.map((option, index) => {
        const checked = option.value === viewport;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setViewport(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground',
              checked && 'bg-muted text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
