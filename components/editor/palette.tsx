'use client';

import { GripVertical } from 'lucide-react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { listBlockDefinitions } from '@/lib/blocks/registry';
import type { AnyBlockDefinition, BlockCategory } from '@/lib/blocks/types';
import { useDragSource } from './dnd/drag-context';
import { useEditor } from './editor-context';

const GROUPS: ReadonlyArray<{ category: BlockCategory; label: string }> = [
  { category: 'content', label: 'Content' },
  { category: 'conversion', label: 'Conversion' },
  { category: 'special', label: 'Special' },
  { category: 'utility', label: 'Utility' },
];

/** Every registered block, by category. A click adds it after the selected section; a drag drops it. */
export function Palette() {
  const definitions = listBlockDefinitions();

  return (
    <nav aria-label="Blocks" className="flex flex-col gap-4 p-3">
      {GROUPS.map((group) => {
        const items = definitions.filter((d) => d.category === group.category);
        if (items.length === 0) return null;
        return (
          <section key={group.category}>
            <h2 className="px-2 text-xs font-medium text-muted-foreground">{group.label}</h2>
            <ul className="mt-1 grid gap-0.5">
              {items.map((definition) => (
                <PaletteItem key={definition.type} definition={definition} />
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function PaletteItem({ definition }: { definition: AnyBlockDefinition }) {
  const dispatch = useEditor((s) => s.dispatch);
  const source = { kind: 'palette', blockType: definition.type, label: definition.label } as const;
  // The button drags with a mouse or pen; on touch it taps to add, and the grip drags.
  const button = useDragSource(source, { touch: false });
  const grip = useDragSource(source);

  return (
    <li className="group relative">
      <button
        type="button"
        title={definition.description}
        onPointerDown={button.onPointerDown}
        onClickCapture={button.onClickCapture}
        onClick={() => dispatch({ type: 'addBlock', blockType: definition.type })}
        className="flex w-full items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <DynamicIcon
          name={definition.icon as IconName}
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        {definition.label}
      </button>
      <span
        data-drag-handle
        aria-hidden="true"
        onPointerDown={grip.onPointerDown}
        onContextMenu={grip.onContextMenu}
        className="absolute inset-y-0 right-1 flex w-6 cursor-grab touch-none items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
      >
        <GripVertical className="size-4" />
      </span>
    </li>
  );
}
