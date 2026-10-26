import { aksesoriGadget } from './aksesori-gadget';
import { camilanKekinian } from './camilan-kekinian';
import { kelasOnline } from './kelas-online';
import { koleksiFashion } from './koleksi-fashion';
import type { BuiltinTemplate } from './parts';
import { perabotRumah } from './perabot-rumah';
import { produkUmum } from './produk-umum';
import { serumSkincare } from './serum-skincare';
import { tehHerbal } from './teh-herbal';

export type { BuiltinTemplate } from './parts';

/** In gallery order (the category order). Ids are stable form values; never rename one. */
export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  tehHerbal,
  koleksiFashion,
  serumSkincare,
  camilanKekinian,
  perabotRumah,
  aksesoriGadget,
  kelasOnline,
  produkUmum,
];
