'use client';

import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBlockDefinition } from '@/lib/blocks/registry';
import type { CommandResult } from '@/lib/editor/commands';
import { describeFields } from '@/lib/editor/inspector/fields';
import { findBlock } from '@/lib/editor/structure';
import { BlockStyleSchema } from '@/lib/schema/primitives';
import { useEditor } from '../editor-context';
import { BlockNote } from './block-note';
import { FieldList } from './field-list';
import { SectionFields } from './section-panel';
import type { FieldActions } from './types';

const notAList = (): CommandResult => ({ ok: false, code: 'invalid', reason: 'Not a list' });

export function BlockPanel({ blockId }: { blockId: string }) {
  const doc = useEditor((s) => s.doc);
  const dispatch = useEditor((s) => s.dispatch);
  const endCoalescing = useEditor((s) => s.endCoalescing);

  const content = useMemo<FieldActions>(
    () => ({
      set: (path, value) =>
        dispatch(
          { type: 'setBlockProp', blockId, path, value },
          { coalesceKey: `${blockId}:${path.join('.')}` },
        ),
      endEdit: endCoalescing,
      listInsert: (path, index, item) =>
        dispatch({ type: 'listInsert', blockId, path, index, item }),
      listInsertMany: (path, index, items) =>
        dispatch({ type: 'listInsertMany', blockId, path, index, items }),
      listMove: (path, from, to) => dispatch({ type: 'listMove', blockId, path, from, to }),
      listRemove: (path, index) => dispatch({ type: 'listRemove', blockId, path, index }),
      listDuplicate: (path, index) => dispatch({ type: 'listDuplicate', blockId, path, index }),
    }),
    [blockId, dispatch, endCoalescing],
  );
  const style = useMemo<FieldActions>(
    () => ({
      set: (path, value) =>
        dispatch(
          { type: 'setBlockStyle', blockId, path, value },
          { coalesceKey: `${blockId}:style:${path.join('.')}` },
        ),
      endEdit: endCoalescing,
      listInsert: notAList,
      listInsertMany: notAList,
      listMove: notAList,
      listRemove: notAList,
      listDuplicate: notAList,
    }),
    [blockId, dispatch, endCoalescing],
  );

  const at = findBlock(doc, blockId);
  if (!at) return null;
  const section = doc.sections[at.sectionIndex]!;
  const block = section.blocks[at.blockIndex]!;
  const definition = getBlockDefinition(block.type);
  if (!definition) return null;
  const context = { doc, definition, idPrefix: `block-${blockId}` };

  return (
    <div className="grid gap-3 p-4">
      <h2 className="text-sm font-semibold">{definition.label}</h2>
      <Tabs defaultValue="content">
        <TabsList className="w-full">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="section">Section</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="pt-2">
          <FieldList
            fields={describeFields(definition.schema)}
            value={block.props as Record<string, unknown>}
            path={[]}
            actions={content}
            context={context}
          />
          <BlockNote type={block.type} props={block.props} />
        </TabsContent>
        <TabsContent value="style" className="pt-2">
          <FieldList
            fields={describeFields(BlockStyleSchema)}
            value={block.style}
            path={[]}
            actions={style}
            context={{ ...context, idPrefix: `block-${blockId}-style` }}
          />
        </TabsContent>
        <TabsContent value="section" className="pt-2">
          <SectionFields sectionId={section.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
