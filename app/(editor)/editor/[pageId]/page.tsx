import { notFound } from 'next/navigation';
import { z } from 'zod';
import { DraftError } from '@/components/editor/draft-error';
import { Editor } from '@/components/editor/editor';
import { requireUser } from '@/lib/auth/require-user';
import { getPageForEditor } from '@/lib/pages/queries';
import { safeParseDocument } from '@/lib/schema/document';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function EditorPage({ params }: PageProps<'/editor/[pageId]'>) {
  await requireUser();
  const { pageId } = await params;
  if (!z.uuid().safeParse(pageId).success) notFound();
  const page = await getPageForEditor(await createSupabaseServerClient(), pageId);
  if (!page) notFound();

  const parsed = safeParseDocument(page.currentDraft);
  if (!parsed.ok) return <DraftError name={page.name} message={parsed.error.message} />;
  return (
    <Editor
      page={{ id: page.id, name: page.name }}
      initialDoc={parsed.doc}
      initialRevision={page.draftRevision}
    />
  );
}
