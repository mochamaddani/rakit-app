'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/require-user';
import { insertPage } from '@/lib/pages/insert';
import { getWorkspaceId } from '@/lib/pages/queries';
import { slugify } from '@/lib/pages/slug';
import type { Json } from '@/lib/supabase/database.types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadTemplateDocument, parseTemplateRef } from '@/lib/templates/catalog';
import { TemplateCategorySchema } from '@/lib/templates/categories';
import { templatePreviewHtml } from '@/lib/templates/preview';
import { getTemplateDocument } from '@/lib/templates/queries';
import type { ActionState } from '../actions';

// Templates (docs/DECISIONS.md D-055). Built-ins live in code and are read-only; saved templates
// are rows in the signed-in user's workspace, which RLS enforces as well.

const NameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name (1–120 characters).')
  .max(120, 'Enter a name (1–120 characters).');
const FieldsSchema = z.object({
  name: NameSchema,
  category: TemplateCategorySchema.catch('other'),
  description: z.string().trim().max(300, 'Keep the description to 300 characters.'),
});
const PageIdSchema = z.uuid();

const GONE = 'This template no longer exists.';
const UNUSABLE = "This template can't be used.";
const READ_ONLY = "Built-in templates can't be changed.";
const FAILED = 'Something went wrong. Try again.';

function readFields(formData: FormData) {
  const result = FieldsSchema.safeParse({
    name: formData.get('name'),
    category: formData.get('category'),
    description: formData.get('description') ?? '',
  });
  return result.success
    ? ({ ok: true, fields: result.data } as const)
    : ({ ok: false, error: result.error.issues[0]?.message ?? FAILED } as const);
}

/** A new draft page holding the template's document; opens it in the editor. */
export async function createPageFromTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const ref = parseTemplateRef(formData.get('templateId'));
  if (!ref) return { error: GONE };
  const name = NameSchema.safeParse(formData.get('name'));
  if (!name.success) return { error: name.error.issues[0]!.message };

  const supabase = await createSupabaseServerClient();
  const raw = await getTemplateDocument(supabase, ref);
  if (raw === null) return { error: GONE };
  const loaded = loadTemplateDocument(raw);
  if (!loaded.ok) return { error: UNUSABLE };
  const created = await insertPage(supabase, {
    name: name.data,
    slugBase: slugify(name.data),
    document: loaded.doc,
  });
  if (!created.ok) return { error: FAILED };
  revalidatePath('/dashboard');
  redirect(`/editor/${created.id}`);
}

/** Saves the page's stored draft as a template in the user's workspace. */
export async function saveAsTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const pageId = PageIdSchema.safeParse(formData.get('pageId'));
  if (!pageId.success) return { error: 'This page no longer exists.' };
  const read = readFields(formData);
  if (!read.ok) return { error: read.error };

  const supabase = await createSupabaseServerClient();
  const { data: page, error } = await supabase
    .from('pages')
    .select('current_draft')
    .eq('id', pageId.data)
    .maybeSingle();
  if (error) return { error: FAILED };
  if (!page) return { error: 'This page no longer exists.' };
  const loaded = loadTemplateDocument(page.current_draft);
  if (!loaded.ok)
    return { error: "This page's draft has errors, so it can't be saved as a template." };
  const { error: insertError } = await supabase.from('templates').insert({
    workspace_id: await getWorkspaceId(supabase),
    ...read.fields,
    document: loaded.doc as unknown as NonNullable<Json>,
  });
  if (insertError) return { error: FAILED };
  revalidatePath('/dashboard/templates');
  return { error: null, done: true };
}

export async function updateTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const ref = parseTemplateRef(formData.get('templateId'));
  if (!ref) return { error: GONE };
  if (ref.kind === 'builtin') return { error: READ_ONLY };
  const read = readFields(formData);
  if (!read.ok) return { error: read.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('templates')
    .update(read.fields)
    .eq('id', ref.id)
    .select('id');
  if (error) return { error: FAILED };
  if (data.length === 0) return { error: GONE };
  revalidatePath('/dashboard/templates');
  return { error: null, done: true };
}

export async function deleteTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const ref = parseTemplateRef(formData.get('templateId'));
  if (!ref) return { error: GONE };
  if (ref.kind === 'builtin') return { error: READ_ONLY };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('templates').delete().eq('id', ref.id);
  if (error) return { error: FAILED };
  revalidatePath('/dashboard/templates');
  return { error: null, done: true };
}

/** Preview-mode HTML for the gallery's `sandbox=""` frame. */
export async function previewTemplate(
  templateId: string,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  await requireUser();
  const ref = parseTemplateRef(templateId);
  if (!ref) return { ok: false, error: GONE };
  const raw = await getTemplateDocument(await createSupabaseServerClient(), ref);
  if (raw === null) return { ok: false, error: GONE };
  const html = templatePreviewHtml(raw);
  return html === null ? { ok: false, error: UNUSABLE } : { ok: true, html };
}
