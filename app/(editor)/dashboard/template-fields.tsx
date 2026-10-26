'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { normalizeCategory, TEMPLATE_CATEGORIES } from '@/lib/templates/categories';

/** Name, category and description, shared by "Save as template" and "Edit template". */
export function TemplateFields({
  name,
  category = 'other',
  description = '',
}: {
  name: string;
  category?: string;
  description?: string;
}) {
  const id = useId();
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          name="name"
          defaultValue={name}
          maxLength={120}
          required
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-category`}>Category</Label>
        <select
          id={`${id}-category`}
          name="category"
          defaultValue={normalizeCategory(category)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {TEMPLATE_CATEGORIES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-description`}>Description</Label>
        <Textarea
          id={`${id}-description`}
          name="description"
          defaultValue={description}
          maxLength={300}
          placeholder="What this template is for (optional)"
        />
      </div>
    </>
  );
}
