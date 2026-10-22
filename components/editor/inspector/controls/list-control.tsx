'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  GripVertical,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CommandResult } from '@/lib/editor/commands';
import {
  initialValueAt,
  listItemSummary,
  seedValue,
  type ListSpec,
} from '@/lib/editor/inspector/fields';
import { createId } from '@/lib/schema/ids';
import { cn } from '@/lib/utils';
import { useListDrag } from '../../dnd/use-list-drag';
import { FieldList } from '../field-list';
import type { ControlProps } from '../types';

function ItemButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/** A repeater: items with summaries, reorder/duplicate/delete buttons, and "Add item". */
export function ListControl({ spec, value, path, actions, context }: ControlProps<ListSpec>) {
  const items = (Array.isArray(value) ? value : []) as Array<Record<string, unknown>>;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const run = (result: CommandResult) => setFailure(result.ok ? null : result.reason);
  const full = items.length >= spec.max;
  const listRef = useRef<HTMLOListElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    scrollerRef.current = listRef.current?.closest('aside') ?? null;
  }, []);
  const drag = useListDrag({
    count: items.length,
    list: listRef,
    scroller: scrollerRef,
    onMove: (from, to) => run(actions.listMove(path, from, to)),
  });

  const add = () =>
    run(
      actions.listInsert(
        path,
        items.length,
        context.definition
          ? initialValueAt(context.definition, [...path, items.length], spec.item.schema, createId)
          : seedValue(spec.item.schema, createId),
      ),
    );

  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold">{spec.label}</span>
      <div className="relative">
        <ol ref={listRef} aria-label={spec.label} className="grid gap-1">
          {items.map((item, index) => {
            const itemId = typeof item.id === 'string' ? item.id : String(index);
            const open = expanded === itemId;
            return (
              <li
                key={itemId}
                data-list-item
                className={cn('rounded-md border', drag.dragging === index && 'opacity-50')}
              >
                <div className="flex items-center gap-0.5 p-1">
                  <button
                    type="button"
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                    {...drag.handleProps(index)}
                    className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <GripVertical className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : itemId)}
                    className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-muted"
                  >
                    <ChevronRight
                      className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
                      aria-hidden="true"
                    />
                    <span className="truncate">{listItemSummary(item, spec, index)}</span>
                  </button>
                  <ItemButton
                    label="Move item up"
                    icon={ArrowUp}
                    disabled={index === 0}
                    onClick={() => run(actions.listMove(path, index, index - 1))}
                  />
                  <ItemButton
                    label="Move item down"
                    icon={ArrowDown}
                    disabled={index === items.length - 1}
                    onClick={() => run(actions.listMove(path, index, index + 1))}
                  />
                  <ItemButton
                    label="Duplicate item"
                    icon={Copy}
                    disabled={full}
                    onClick={() => run(actions.listDuplicate(path, index))}
                  />
                  <ItemButton
                    label="Delete item"
                    icon={Trash2}
                    onClick={() => run(actions.listRemove(path, index))}
                  />
                </div>
                {open ? (
                  <div className="border-t p-3">
                    <FieldList
                      fields={spec.item.fields}
                      value={item}
                      path={[...path, index]}
                      actions={actions}
                      context={context}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {drag.markerTop !== null ? (
          <div
            data-testid="list-drop-marker"
            className="pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-sky-600"
            style={{ top: drag.markerTop - 2 }}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={add}>
          Add item
        </Button>
        {Number.isFinite(spec.max) ? (
          <span className="text-xs text-muted-foreground">
            {items.length} of {spec.max}
          </span>
        ) : null}
      </div>
      {failure ? <p className="text-xs text-destructive">{failure}</p> : null}
    </div>
  );
}
