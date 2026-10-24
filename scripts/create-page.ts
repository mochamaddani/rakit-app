// Creates a page from a stored page document in an owner's workspace, uploading its images through
// the same WebP pipeline as the editor's uploads (docs/DECISIONS.md D-045). Service role: scripts only.
// Usage: pnpm page:create --email you@example.com --template teh-kumis-kucing --images <dir>
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ASSET_BUCKET, variantPath } from '@/lib/assets/limits';
import { processImage } from '@/lib/assets/process';
import { uniqueSlug } from '@/lib/pages/slug';
import { CURRENT_SCHEMA_VERSION, parseDocument } from '@/lib/schema/document';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  TEH_KUMIS_KUCING_FILES,
  TEH_KUMIS_KUCING_IMAGES,
  tehKumisKucingDocument,
  type TemplateImage,
} from '@/lib/templates/teh-kumis-kucing';

const TEMPLATES = {
  'teh-kumis-kucing': {
    name: 'Teh Kumis Kucing',
    slug: 'teh-kumis-kucing',
    images: TEH_KUMIS_KUCING_IMAGES,
    files: TEH_KUMIS_KUCING_FILES,
    build: tehKumisKucingDocument,
  },
} as const;
type TemplateId = keyof typeof TEMPLATES;

export function parsePageArgs(argv: string[]): {
  email: string;
  template: TemplateId;
  images: string;
} {
  const { values } = parseArgs({
    args: argv,
    options: {
      email: { type: 'string' },
      template: { type: 'string' },
      images: { type: 'string' },
    },
    strict: true,
  });
  const email = z.email().safeParse(values.email);
  if (!email.success) throw new Error('Pass a valid --email address.');
  if (!values.template || !Object.hasOwn(TEMPLATES, values.template)) {
    throw new Error(`Pass --template, one of: ${Object.keys(TEMPLATES).join(', ')}.`);
  }
  if (!values.images) throw new Error('Pass --images, the folder holding the original images.');
  return { email: email.data, template: values.template as TemplateId, images: values.images };
}

const YEAR_SECONDS = '31536000';

/** One image → 1600/800 WebP variants in the public assets bucket plus its assets row. */
async function uploadImage(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  file: string,
): Promise<TemplateImage> {
  const { large, small } = await processImage(new Uint8Array(await readFile(file)));
  const assetId = crypto.randomUUID();
  const assetPath = `${workspaceId}/${assetId}`;
  const bucket = admin.storage.from(ASSET_BUCKET);
  for (const [width, variant] of [
    [1600, large],
    [800, small],
  ] as const) {
    const { error } = await bucket.upload(variantPath(assetPath, width), variant.data, {
      contentType: 'image/webp',
      cacheControl: YEAR_SECONDS,
      upsert: false,
    });
    if (error) throw error;
  }
  const { error } = await admin.from('assets').insert({
    id: assetId,
    workspace_id: workspaceId,
    path: assetPath,
    mime: 'image/webp',
    width: large.width,
    height: large.height,
    size: large.data.byteLength,
  });
  if (error) throw error;
  return {
    src: bucket.getPublicUrl(variantPath(assetPath, 1600)).data.publicUrl,
    width: large.width,
    height: large.height,
    assetId,
  };
}

async function main(): Promise<number> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // No .env.local: rely on variables already in the environment.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
    return 1;
  }
  let args: ReturnType<typeof parsePageArgs>;
  try {
    args = parsePageArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const template = TEMPLATES[args.template];
  const admin = createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: users, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) throw usersError;
  const owner = users.users.find((user) => user.email === args.email);
  if (!owner) {
    console.error(`No account ${args.email}. Create it with pnpm owner:create first.`);
    return 1;
  }
  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', owner.id)
    .single();
  if (workspaceError) throw workspaceError;

  const images = {} as Record<(typeof template.images)[number], TemplateImage>;
  for (const key of template.images) {
    images[key] = await uploadImage(admin, workspace.id, join(args.images, template.files[key]));
    console.log(`Uploaded ${template.files[key]}`);
  }
  const doc = parseDocument(template.build(images));

  const { data: taken, error: slugError } = await admin
    .from('pages')
    .select('slug')
    .eq('workspace_id', workspace.id)
    .like('slug', `${template.slug}%`);
  if (slugError) throw slugError;
  const { data: page, error } = await admin
    .from('pages')
    .insert({
      workspace_id: workspace.id,
      name: template.name,
      slug: uniqueSlug(template.slug, new Set(taken.map((row) => row.slug))),
      current_draft: doc as unknown as NonNullable<Json>,
      schema_version: CURRENT_SCHEMA_VERSION,
    })
    .select('id, slug')
    .single();
  if (error) throw error;
  console.log(`Created "${template.name}" (${page.slug}): /editor/${page.id}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
