'use client';

import { useActionState, useId } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionState } from '../actions';
import { createPageFromTemplate } from './actions';

const initialState: ActionState = { error: null };

export function UseTemplateDialog({ templateId, name }: { templateId: string; name: string }) {
  const [state, formAction, pending] = useActionState(createPageFromTemplate, initialState);
  const nameId = useId();

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>Use template</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New page from {name}</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="templateId" value={templateId} />
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input id={nameId} name="name" defaultValue={name} maxLength={120} required autoFocus />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create page
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
