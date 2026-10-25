'use client';

import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseRows, rowsToCarouselItems } from '@/lib/editor/bulk-paste';
import type { CommandResult } from '@/lib/editor/commands';
import { createId } from '@/lib/schema/ids';
import type { PriceFormat } from '@/lib/schema/settings';

const plural = (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`;

/** "Paste rows" for the Product Carousel (D-054): spreadsheet rows become products in one step. */
export function BulkPasteDialog({
  room,
  max,
  format,
  onAdd,
}: {
  /** How many more items the list takes. */
  room: number;
  max: number;
  format: PriceFormat;
  onAdd(items: unknown[]): CommandResult;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const rowsId = useId();
  const parsed = useMemo(() => parseRows(text, format), [text, format]);
  const fitting = parsed.rows.slice(0, room);
  const over = parsed.rows.length - fitting.length;

  const add = () => {
    const result = onAdd(rowsToCarouselItems(fitting, createId));
    if (!result.ok) return setFailure(result.reason);
    setOpen(false);
    setText('');
    setFailure(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" disabled={room === 0} />}
      >
        Paste rows
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paste products</DialogTitle>
          <DialogDescription>
            One product per row: title, price, compare-at price, image URL, link. Copy cells
            straight from a spreadsheet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={rowsId}>Rows</Label>
          <Textarea
            id={rowsId}
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="font-mono text-xs"
          />
          <div role="status" className="grid gap-1 text-sm">
            {text.trim() ? <p>{plural(fitting.length)} ready</p> : null}
            {over > 0 ? (
              <p className="text-destructive">
                Only {fitting.length} {fitting.length === 1 ? 'row fits' : 'rows fit'}; the carousel
                holds {max} products.
              </p>
            ) : null}
            {parsed.errors.map((error) => (
              <p key={error.line} className="text-destructive">
                {error.message}
              </p>
            ))}
            {failure ? <p className="text-destructive">{failure}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={fitting.length === 0} onClick={add}>
            Add {plural(fitting.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
