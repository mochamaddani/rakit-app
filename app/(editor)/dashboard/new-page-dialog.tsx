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
import { createPage, type ActionState } from './actions';

const initialState: ActionState = { error: null };

export function NewPageDialog() {
  const [state, formAction, pending] = useActionState(createPage, initialState);
  const nameId = useId();

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>New page</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              name="name"
              defaultValue="Untitled page"
              maxLength={120}
              required
              autoFocus
            />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Create page
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
