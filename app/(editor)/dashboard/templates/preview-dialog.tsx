'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { previewTemplate } from './actions';

type Preview = { ok: true; html: string } | { ok: false; error: string };
const WIDTHS = { Mobile: 'w-[390px]', Desktop: 'w-full' } as const;

/**
 * The template rendered in preview mode inside `sandbox=""`: an opaque origin with no scripts, so
 * nothing in a saved template can run on the editor origin (D-022, D-049).
 */
export function PreviewDialog({ templateId, name }: { templateId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [width, setWidth] = useState<keyof typeof WIDTHS>('Mobile');
  const [loading, startLoading] = useTransition();

  const show = () => {
    setOpen(true);
    startLoading(async () => setPreview(await previewTemplate(templateId)));
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={show}>
        Preview
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader className="flex-row items-center gap-3 pr-8">
            <DialogTitle className="flex-1">{name}</DialogTitle>
            <div className="flex gap-1" role="group" aria-label="Preview width">
              {(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={width === option ? 'secondary' : 'ghost'}
                  aria-pressed={width === option}
                  onClick={() => setWidth(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </DialogHeader>
          <div className="flex h-[70vh] justify-center overflow-hidden rounded-md border bg-muted">
            {loading || preview === null ? (
              <p
                role="status"
                className="flex items-center gap-2 self-center text-muted-foreground"
              >
                <Spinner />
                Loading preview…
              </p>
            ) : preview.ok ? (
              <iframe
                title="Template preview"
                sandbox=""
                srcDoc={preview.html}
                className={cn('h-full max-w-full bg-white', WIDTHS[width])}
              />
            ) : (
              <p className="self-center text-destructive">{preview.error}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
