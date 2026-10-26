'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/require-user';
import { copyName, copySlugBase } from '@/lib/pages/copy';
import { insertPage } from '@/lib/pages/insert';
import { getWorkspaceId } from '@/lib/pages/queries';
import { slugify } from '@/lib/pages/slug';
import { createEmptyDocument } from '@/lib/schema/document';
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

  const created = await insertPage(await createSupabaseServerClient(), {
    name: name.data,
    slugBase: slugify(name.data),
    document: createEmptyDocument(),
  });
  if (!created.ok) return { error: FAILED };
  revalidatePath('/dashboard');
  redirect(`/editor/${created.id}`);
}

/** Copies the page's saved draft and tags into a new draft page and opens it (D-056). */
export async function duplicatePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const pageId = PageIdSchema.safeParse(formData.get('pageId'));
  if (!pageId.success) return { error: GONE };

  const supabase = await createSupabaseServerClient();
  const { data: source, error } = await supabase
    .from('pages')
    .select('name, slug, current_draft, tags')
    .eq('id', pageId.data)
    .maybeSingle();
  if (error) return { error: FAILED };
  if (!source) return { error: GONE };
  const created = await insertPage(supabase, {
    name: copyName(source.name),
    slugBase: copySlugBase(source.slug),
    document: source.current_draft,
    tags: source.tags,
  });
  if (!created.ok) return { error: FAILED };
  revalidatePath('/dashboard');
  redirect(`/editor/${created.id}`);
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
  // Stored exports go first: once the row is gone nothing points at them. A storage error does
  // not block the delete; it only leaves orphaned files in the private bucket.
  const folder = `${await getWorkspaceId(supabase)}/${pageId.data}`;
  const versions = supabase.storage.from('page-versions');
  const { data: files } = await versions.list(folder);
  if (files?.length) await versions.remove(files.map((file) => `${folder}/${file.name}`));
  const { error } = await supabase.from('pages').delete().eq('id', pageId.data);
  if (error) return { error: FAILED };
  revalidatePath('/dashboard');
  return { error: null, done: true };
}
