import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/require-user';
import { getPageForEditor } from '@/lib/pages/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Placeholder until the editor shell lands (M2a Task 13).
export default async function EditorPage({ params }: PageProps<'/editor/[pageId]'>) {
  await requireUser();
  const { pageId } = await params;
  if (!z.uuid().safeParse(pageId).success) notFound();
  const page = await getPageForEditor(await createSupabaseServerClient(), pageId);
  if (!page) notFound();

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold">{page.name}</h1>
    </main>
  );
}
