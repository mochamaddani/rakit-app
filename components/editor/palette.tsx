'use client';

import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { listBlockDefinitions } from '@/lib/blocks/registry';
import type { BlockCategory } from '@/lib/blocks/types';
import { useEditor } from './editor-context';

const GROUPS: ReadonlyArray<{ category: BlockCategory; label: string }> = [
  { category: 'content', label: 'Content' },
  { category: 'conversion', label: 'Conversion' },
  { category: 'special', label: 'Special' },
];

/** Every registered block, by category. A click adds it after the selected section. */
export function Palette() {
  const dispatch = useEditor((s) => s.dispatch);
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
                <li key={definition.type}>
                  <button
                    type="button"
                    title={definition.description}
                    onClick={() => dispatch({ type: 'addBlock', blockType: definition.type })}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <DynamicIcon
                      name={definition.icon as IconName}
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {definition.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
