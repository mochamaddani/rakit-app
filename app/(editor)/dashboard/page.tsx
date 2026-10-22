import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth/require-user';
import { formatEdited } from '@/lib/pages/format';
import { listPages, type PageStatus } from '@/lib/pages/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NewPageDialog } from './new-page-dialog';
import { PageActions } from './page-actions';

const STATUS_LABELS: Record<PageStatus, string> = {
  draft: 'Draft',
  exported: 'Exported',
  live: 'Live',
  archived: 'Archived',
};

export default async function DashboardPage() {
  await requireUser();
  const pages = await listPages(await createSupabaseServerClient());
  // Rendered on the server only, so the relative times never hydrate differently.
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Your pages</h1>
        <NewPageDialog />
      </div>
      {pages.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No pages yet.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {pages.map((page) => (
            <li key={page.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/editor/${page.id}`} className="font-medium hover:underline">
                  {page.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Edited {formatEdited(page.updatedAt, now)}
                </p>
              </div>
              <Badge variant="secondary">{STATUS_LABELS[page.status]}</Badge>
              <PageActions pageId={page.id} name={page.name} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
