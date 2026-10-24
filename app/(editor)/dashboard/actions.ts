'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/require-user';
import { getWorkspaceId } from '@/lib/pages/queries';
import { slugify, uniqueSlug } from '@/lib/pages/slug';
import { CURRENT_SCHEMA_VERSION, createEmptyDocument } from '@/lib/schema/document';
import type { Json } from '@/lib/supabase/database.types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ActionState = { error: string | null; done?: boolean };

const NameSchema = z.string().trim().min(1).max(120);
const PageIdSchema = z.uuid();
const NAME_ERROR = 'Enter a name (1–120 characters).';
const GONE = 'This page no longer exists.';
const FAILED = 'Something went wrong. Try again.';
const UNIQUE_VIOLATION = '23505';

export async function createPage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const name = NameSchema.safeParse(formData.get('name'));
  if (!name.success) return { error: NAME_ERROR };

  const supabase = await createSupabaseServerClient();
  const workspaceId = await getWorkspaceId(supabase);
  const base = slugify(name.data);
  let pageId: string | null = null;
  // Two creates can race for the same slug; the unique index decides, and the loser retries.
  for (let attempt = 0; attempt < 3 && pageId === null; attempt += 1) {
    const { data: taken, error: readError } = await supabase
      .from('pages')
      .select('slug')
      .like('slug', `${base}%`);
    if (readError) return { error: FAILED };
    const { data, error } = await supabase
      .from('pages')
      .insert({
        workspace_id: workspaceId,
        name: name.data,
        // Slugs name the exported file; renaming a page keeps it (the export dialog edits it).
        slug: uniqueSlug(base, new Set(taken.map((row) => row.slug))),
        current_draft: createEmptyDocument() as unknown as NonNullable<Json>,
        schema_version: CURRENT_SCHEMA_VERSION,
      })
      .select('id')
      .single();
    if (!error) pageId = data.id;
    else if (error.code !== UNIQUE_VIOLATION) return { error: FAILED };
  }
  if (pageId === null) return { error: FAILED };

  revalidatePath('/dashboard');
  redirect(`/editor/${pageId}`);
}

export async function renamePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const pageId = PageIdSchema.safeParse(formData.get('pageId'));
  if (!pageId.success) return { error: GONE };
  const name = NameSchema.safeParse(formData.get('name'));
  if (!name.success) return { error: NAME_ERROR };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('pages')
    .update({ name: name.data })
    .eq('id', pageId.data)
    .select('id');
  if (error) return { error: FAILED };
  if (data.length === 0) return { error: GONE };
  revalidatePath('/dashboard');
  return { error: null, done: true };
}

const SlugSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/** Renames the exported file (`<slug>.html`); slugs are unique per workspace. */
export async function updatePageSlug(
  pageId: string,
  slug: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await requireUser();
  if (!PageIdSchema.safeParse(pageId).success) return { ok: false, error: GONE };
  const parsed = SlugSchema.safeParse(slug);
  if (!parsed.success) return { ok: false, error: 'Use lowercase letters, numbers and dashes' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('pages')
    .update({ slug: parsed.data })
    .eq('id', pageId)
    .select('slug');
  if (error) {
    return {
      ok: false,
      error: error.code === UNIQUE_VIOLATION ? 'Another page already uses this file name' : FAILED,
    };
  }
  if (data.length === 0) return { ok: false, error: GONE };
  revalidatePath('/dashboard');
  return { ok: true, slug: parsed.data };
}

export async function deletePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const pageId = PageIdSchema.safeParse(formData.get('pageId'));
  if (!pageId.success) return { error: GONE };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('pages').delete().eq('id', pageId.data);
  if (error) return { error: FAILED };
  revalidatePath('/dashboard');
  return { error: null, done: true };
}
