'use client';

import { MoreHorizontal } from 'lucide-react';
import { useActionState, useId, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadVersion } from '@/lib/export/versions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { deletePage, renamePage, type ActionState } from './actions';

const initialState: ActionState = { error: null };

interface PageDialogProps {
  pageId: string;
  name: string;
  open: boolean;
  onClose(): void;
}

/** The row menu; its dialogs live outside the menu so they stay open after it closes. */
export function PageActions({
  pageId,
  name,
  slug,
  latestHtmlPath,
}: {
  pageId: string;
  name: string;
  slug: string;
  latestHtmlPath: string | null;
}) {
  const [open, setOpen] = useState<'rename' | 'delete' | null>(null);
  const close = () => setOpen(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen('rename')}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            disabled={latestHtmlPath === null}
            onClick={() => {
              if (latestHtmlPath)
                void downloadVersion(createSupabaseBrowserClient(), latestHtmlPath, `${slug}.html`);
            }}
          >
            Download HTML
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setOpen('delete')}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog pageId={pageId} name={name} open={open === 'rename'} onClose={close} />
      <DeleteDialog pageId={pageId} name={name} open={open === 'delete'} onClose={close} />
    </>
  );
}

function RenameDialog({ pageId, name, open, onClose }: PageDialogProps) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await renamePage(prev, formData);
      if (result.done) onClose();
      return result;
    },
    initialState,
  );
  const nameId = useId();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename page</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="pageId" value={pageId} />
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input id={nameId} name="name" defaultValue={name} maxLength={120} required autoFocus />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
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

function DeleteDialog({ pageId, name, open, onClose }: PageDialogProps) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await deletePage(prev, formData);
      if (result.done) onClose();
      return result;
    },
    initialState,
  );

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the page and its draft. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="pageId" value={pageId} />
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              Delete page
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
