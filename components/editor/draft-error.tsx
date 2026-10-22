import Link from 'next/link';

/** Shown instead of the editor when the stored draft does not validate. */
export function DraftError({ name, message }: { name: string; message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">This draft can&apos;t be opened</h1>
      <p className="text-sm text-muted-foreground">
        {name}: {message}
      </p>
      <Link href="/dashboard" className="text-sm font-medium underline underline-offset-4">
        Back to pages
      </Link>
    </main>
  );
}
