import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { ASSET_BUCKET, UPLOAD_BUCKET } from './limits';
import type { AssetStore } from './upload';

const YEAR_SECONDS = '31536000';

/** AssetStore on Supabase Storage and the assets table, as the signed-in user (D-045 policies). */
export function createSupabaseAssetStore(supabase: SupabaseClient<Database>): AssetStore {
  return {
    async download(path) {
      const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).download(path);
      if (error) {
        // A missing object, or one the caller's policies hide, is simply not there.
        const status = (error as { status?: number }).status;
        if (status === 400 || status === 404 || /not.?found/i.test(error.message)) return null;
        throw error;
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    async removeUpload(path) {
      const { error } = await supabase.storage.from(UPLOAD_BUCKET).remove([path]);
      if (error) throw error;
    },
    async putVariant(path, data) {
      const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, data, {
        contentType: 'image/webp',
        cacheControl: YEAR_SECONDS,
        upsert: false,
      });
      if (error) throw error;
    },
    async insertAsset(row) {
      const { error } = await supabase.from('assets').insert(row);
      if (error) throw error;
    },
    publicUrl: (path) => supabase.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl,
  };
}
