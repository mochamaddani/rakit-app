'use client';

import { Button } from '@/components/ui/button';
import { useEditor } from '../editor-context';
import { BlockPanel } from './block-panel';
import { PagePanel } from './page-panel';
import { SectionPanel } from './section-panel';

/** The right pane: fields for the selected block, its section, or the page. */
export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);

  if (selection?.kind === 'block')
    return <BlockPanel key={selection.blockId} blockId={selection.blockId} />;
  if (selection?.kind === 'section') {
    return <SectionPanel key={selection.sectionId} sectionId={selection.sectionId} />;
  }
  if (selection?.kind === 'page') return <PagePanel />;
  return (
    <div className="grid gap-3 p-4 text-sm text-muted-foreground">
      <p>Select a block on the canvas to edit it.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => select({ kind: 'page' })}>
        Page settings
      </Button>
    </div>
  );
}
