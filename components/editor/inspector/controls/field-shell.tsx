import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** Label, control, then an error or help line. */
export function FieldShell({
  id,
  label,
  error,
  help,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  help?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
