import Link from 'next/link';
import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { filterTemplates } from '@/lib/templates/catalog';
import { normalizeCategory, parseCategory, TEMPLATE_CATEGORIES } from '@/lib/templates/categories';
import { listTemplates } from '@/lib/templates/queries';
import { cn } from '@/lib/utils';
import { TemplateCard } from './template-card';

const chip = (active: boolean) =>
  cn(
    'rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted',
    active && 'border-foreground bg-foreground text-background hover:bg-foreground/90',
  );

export default async function TemplatesPage({ searchParams }: PageProps<'/dashboard/templates'>) {
  await requireUser();
  const { category: rawCategory } = await searchParams;
  // An unknown or repeated ?category= shows everything.
  const category = parseCategory(rawCategory);
  const templates = await listTemplates(await createSupabaseServerClient());
  const shown = filterTemplates(templates, category);
  const present = TEMPLATE_CATEGORIES.filter((entry) =>
    templates.some((template) => normalizeCategory(template.category) === entry.id),
  );
  return (
    <main className="mx-auto w-full max-w-5xl">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
        ← Back to pages
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Templates</h1>
      <p className="text-muted-foreground">
        Start a page from a template, then swap in your product. Save any page as a template from
        its menu on the pages list.
      </p>
      <nav aria-label="Categories" className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard/templates"
          aria-current={category === null ? 'page' : undefined}
          className={chip(category === null)}
        >
          All
        </Link>
        {present.map((entry) => (
          <Link
            key={entry.id}
            href={`/dashboard/templates?category=${entry.id}`}
            aria-current={category === entry.id ? 'page' : undefined}
            className={chip(category === entry.id)}
          >
            {entry.label}
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No templates in this category yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((template) => (
            <TemplateCard key={template.ref} template={template} />
          ))}
        </div>
      )}
    </main>
  );
}
