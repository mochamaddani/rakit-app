'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ActionState } from './actions';
import { TemplateFields } from './template-fields';
import { saveAsTemplate } from './templates/actions';

const initialState: ActionState = { error: null };

/** Saves the page's stored draft as a template (D-055). */
export function SaveTemplateDialog({
  pageId,
  name,
  open,
  onClose,
}: {
  pageId: string;
  name: string;
  open: boolean;
  onClose(): void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveAsTemplate(prev, formData);
      if (result.done) onClose();
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Saves the page as it was last saved. New pages can start from it in Templates.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="pageId" value={pageId} />
          <TemplateFields name={name} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
