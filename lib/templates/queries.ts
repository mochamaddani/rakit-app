import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { BUILTIN_TEMPLATES } from './builtin';
import {
  builtinSummaries,
  summarizeDocument,
  type TemplateRef,
  type TemplateSummary,
} from './catalog';

// Reads run as the signed-in user, so RLS limits saved templates to their workspace.
type Supabase = SupabaseClient<Database>;

/** Saved templates (newest edit first), then the built-ins in gallery order. */
export async function listTemplates(supabase: Supabase): Promise<TemplateSummary[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, category, description, document')
    .not('workspace_id', 'is', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const saved = data.map((row): TemplateSummary => ({
    ref: row.id,
    kind: 'saved',
    name: row.name,
    category: row.category,
    description: row.description,
    ...summarizeDocument(row.document),
  }));
  return [...saved, ...builtinSummaries()];
}

/** The template's raw document; null when a saved one is missing or belongs to someone else. */
export async function getTemplateDocument(
  supabase: Supabase,
  ref: TemplateRef,
): Promise<unknown | null> {
  if (ref.kind === 'builtin')
    return BUILTIN_TEMPLATES.find((template) => template.id === ref.id)?.document() ?? null;
  const { data, error } = await supabase
    .from('templates')
    .select('document')
    .eq('id', ref.id)
    .not('workspace_id', 'is', null)
    .maybeSingle();
  if (error) throw error;
  return data?.document ?? null;
}
