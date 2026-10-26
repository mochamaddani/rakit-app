import { Badge } from '@/components/ui/badge';
import type { TemplateSummary } from '@/lib/templates/catalog';
import { categoryLabel } from '@/lib/templates/categories';
import { PreviewDialog } from './preview-dialog';
import { TemplateActions } from './template-actions';
import { UseTemplateDialog } from './use-template-dialog';

export function TemplateCard({ template }: { template: TemplateSummary }) {
  const { colors } = template;
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border">
      <div className="flex h-16" aria-hidden="true">
        <span className="flex-[3]" style={{ background: colors.primary }} />
        <span className="flex-1" style={{ background: colors.accent }} />
        <span className="flex-[2]" style={{ background: colors.surface }} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {categoryLabel(template.category)}
        </p>
        <div className="flex items-start gap-2">
          <h3 className="flex-1 font-medium">{template.name}</h3>
          {template.kind === 'saved' ? <Badge variant="secondary">Saved</Badge> : null}
          {template.kind === 'saved' ? <TemplateActions template={template} /> : null}
        </div>
        {template.description ? (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {template.sectionCount} {template.sectionCount === 1 ? 'section' : 'sections'}
        </p>
        <div className="mt-auto flex gap-2 pt-2">
          <UseTemplateDialog templateId={template.ref} name={template.name} />
          <PreviewDialog templateId={template.ref} name={template.name} />
        </div>
      </div>
    </article>
  );
}
