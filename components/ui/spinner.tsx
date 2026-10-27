import { Loader2 } from 'lucide-react';
import { cn } from 'cn';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2
      data-slot="spinner"
      aria-hidden="true"
      className={cn(
        'size-4 animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]',
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
