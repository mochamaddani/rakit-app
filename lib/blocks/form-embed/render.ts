import type { RenderContext } from '@/lib/renderer/context';
import { html, unsafeRaw, type SafeHtml } from '@/lib/renderer/html';
import { detectFormProvider, webLink } from './providers';
import type { FormEmbedProps } from './schema';

// An external form (docs/DECISIONS.md D-048). Export carries the iframe or the provider's code;
// preview shows a placeholder, because third-party code never runs in the editor (Plan §2.10).

function renderForm(props: FormEmbedProps, ctx: RenderContext): SafeHtml {
  const missing = html`<p class="lp-form__missing">${ctx.t('formMissing')}</p>`;
  if (props.mode === 'snippet') {
    return props.code.trim() ? unsafeRaw(props.code) : missing;
  }
  const raw = webLink(props.url);
  if (!raw) return missing;
  const provider = detectFormProvider(props);
  const src = provider ? (webLink(provider.embedUrl(new URL(raw))) ?? raw) : raw;
  return html`<iframe class="lp-form__frame" src="${src}" title="${
    props.title.trim() || ctx.t('orderForm')
  }" height="${props.height}" loading="${ctx.aboveFold ? 'eager' : 'lazy'}" data-lp-pass data-lp-form-frame></iframe>`;
}

export function renderFormEmbed(props: FormEmbedProps, ctx: RenderContext): SafeHtml {
  const provider = detectFormProvider(props);
  const head =
    props.heading || props.subheading
      ? html`<div class="lp-form__head">${
          props.heading
            ? html`<h2 class="lp-h2"${ctx.field('heading', 'rich')}>${ctx.rich(props.heading)}</h2>`
            : ''
        }${
          props.subheading
            ? html`<p class="lp-sub"${ctx.field('subheading', 'rich')}>${ctx.rich(props.subheading)}</p>`
            : ''
        }</div>`
      : '';
  if (ctx.mode === 'preview') {
    return html`<div class="lp-form">${head}<div class="lp-form__ph"><p class="lp-form__ph-title">Form · ${
      provider?.label ?? 'Embedded form'
    }</p><p>Shows in the exported page</p></div></div>`;
  }
  const thanks = provider?.conversions === 'message' ? webLink(props.thankYouUrl) : null;
  return html`<div class="lp-form" data-lp-form="${provider?.id ?? 'other'}"${
    thanks ? html` data-lp-thanks="${thanks}"` : ''
  }>${head}${renderForm(props, ctx)}</div>`;
}
