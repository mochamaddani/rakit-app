import { cn } from 'cn';
import { Spinner } from '@/components/ui/spinner';

/**
 * The fallback a route's `loading.tsx` shows while its server render runs: a bar along the top of
 * the window and a centered label. It fades in, so a fast navigation barely shows it.
 */
export function RouteLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-500',
        className,
      )}
    >
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
        <div className="h-full w-1/4 bg-primary animate-progress motion-reduce:animate-none" />
      </div>
      <Spinner />
      {label}
    </div>
  );
}
