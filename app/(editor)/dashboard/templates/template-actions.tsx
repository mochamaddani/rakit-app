'use client';

import { MoreHorizontal } from 'lucide-react';
import { useActionState, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TemplateSummary } from '@/lib/templates/catalog';
import type { ActionState } from '../actions';
import { TemplateFields } from '../template-fields';
import { deleteTemplate, updateTemplate } from './actions';

const initialState: ActionState = { error: null };

/** The saved-template menu; its dialogs live outside the menu so they stay open after it closes. */
export function TemplateActions({ template }: { template: TemplateSummary }) {
  const [open, setOpen] = useState<'edit' | 'delete' | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${template.name}`} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen('edit')}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setOpen('delete')}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditDialog template={template} open={open === 'edit'} onClose={close} />
      <DeleteDialog template={template} open={open === 'delete'} onClose={close} />
    </>
  );
}

interface DialogProps {
  template: TemplateSummary;
  open: boolean;
  onClose(): void;
}

function EditDialog({ template, open, onClose }: DialogProps) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await updateTemplate(prev, formData);
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
            <DialogTitle>Edit template</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="templateId" value={template.ref} />
          <TemplateFields
            name={template.name}
            category={template.category}
            description={template.description}
          />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ template, open, onClose }: DialogProps) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await deleteTemplate(prev, formData);
      if (result.done) onClose();
      return result;
    },
    initialState,
  );
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete template “{template.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Pages made from it stay as they are. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="templateId" value={template.ref} />
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              Delete template
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
