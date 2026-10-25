// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countdown } from '@/lib/blocks/countdown';
import { countdownEndMs } from '@/lib/blocks/countdown/schema';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { byteLength } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = { heading: 'Promo berakhir', endsAt: '2026-11-01T00:00', utcOffset: '+07:00' };
const END = 1793466000000;

describe('countdown schema', () => {
  it('countdownEndMs("2026-11-01T00:00", "+07:00") is 1793466000000', () => {
    expect(countdownEndMs(countdown.schema.parse(props))).toBe(END);
    expect(countdownEndMs(countdown.schema.parse({ ...props, utcOffset: '+00:00' }))).toBe(
      END + 7 * 3600_000,
    );
    expect(
      countdownEndMs(countdown.schema.parse({ endsAt: '2028-02-29T23:59', utcOffset: '+09:00' })),
    ).toBe(Date.parse('2028-02-29T23:59:00+09:00'));
    expect(countdownEndMs(countdown.schema.parse({}))).toBeNull();
  });
  it('rejects 2026-02-30T10:00 and 24:00', () => {
    for (const endsAt of [
      '2026-02-30T10:00',
      '2026-11-01T24:00',
      '2027-02-29T10:00',
      '2026-13-01T10:00',
      '2026-11-01 10:00',
    ]) {
      expect(countdown.schema.safeParse({ endsAt }).success, endsAt).toBe(false);
    }
    expect(countdown.schema.safeParse({ endsAt: '2028-02-29T10:00' }).success).toBe(true);
  });
});

describe('countdown block', () => {
  it('renders nothing in export without a deadline', () => {
    expect(renderBlock(countdown, {})).toBe('');
    expect(renderBlock(countdown, {}, { mode: 'preview' })).toContain(
      'Set an end date in the inspector',
    );
  });
  it('renders the units and the hidden end message', () => {
    const out = renderBlock(countdown, props);
    expect(out).toContain(`data-lp-countdown data-end="${END}" data-on-end="message"`);
    expect(out.match(/<span class="lp-countdown__n" data-u="[dhms]">--<\/span>/g)).toHaveLength(4);
    expect(out).toContain('Hari');
    expect(out).toContain('<p class="lp-countdown__end" hidden>Promo telah berakhir</p>');
    const noDays = renderBlock(countdown, { ...props, showDays: false, endedText: 'Habis' });
    expect(noDays).not.toContain('data-u="d"');
    expect(noDays).toContain('>Habis</p>');
  });
});

describe('countdown snippet', () => {
  const run = (markup: string) => {
    document.body.innerHTML = markup;
    new Function(countdown.snippet!.asset.src)();
  };
  const exportMarkup = (p: object) => `<div class="lp-b">${renderBlock(countdown, p)}</div>`;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('counts down in two-digit units and shows the message at zero', () => {
    vi.setSystemTime(END - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000);
    run(exportMarkup(props));
    const digits = () => [...document.querySelectorAll('[data-u]')].map((el) => el.textContent);
    expect(digits()).toEqual(['02', '03', '04', '05']);
    vi.advanceTimersByTime(1000);
    expect(digits()).toEqual(['02', '03', '04', '04']);
    vi.setSystemTime(END);
    vi.advanceTimersByTime(1000);
    expect(document.querySelector<HTMLElement>('.lp-countdown__end')!.hidden).toBe(false);
  });
  it('an ended countdown shows its message at once; hide mode hides the block but never in the canvas', () => {
    vi.setSystemTime(END + 1000);
    run(exportMarkup(props));
    expect(document.querySelector<HTMLElement>('.lp-countdown__end')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.lp-countdown__units')!.hidden).toBe(true);

    run(exportMarkup({ ...props, onEnd: 'hide' }));
    expect(document.querySelector<HTMLElement>('.lp-b')!.hidden).toBe(true);

    run(
      `<div class="lp-b" data-lp-block="b1">${renderBlock(countdown, { ...props, onEnd: 'hide' }, { mode: 'preview' })}</div>`,
    );
    expect(document.querySelector<HTMLElement>('.lp-b')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.lp-countdown__end')!.hidden).toBe(false);
  });
  it('reads one second until the deadline, then ends exactly on it', () => {
    vi.setSystemTime(END - 400);
    run(exportMarkup(props));
    expect(document.querySelector('[data-u="s"]')!.textContent).toBe('01');
    expect(document.querySelector<HTMLElement>('.lp-countdown__end')!.hidden).toBe(true);
    vi.advanceTimersByTime(400);
    expect(document.querySelector<HTMLElement>('.lp-countdown__end')!.hidden).toBe(false);
  });
  it('hours carry the days when days are off', () => {
    vi.setSystemTime(END - (2 * 86400 + 3600) * 1000);
    run(exportMarkup({ ...props, showDays: false }));
    expect(document.querySelector('[data-u="h"]')!.textContent).toBe('49');
  });
  it('stops ticking once its root is gone', () => {
    vi.setSystemTime(END - 10_000);
    run(exportMarkup(props));
    document.body.innerHTML = '';
    expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
    vi.advanceTimersByTime(1000);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('snippet stays within 1024 bytes', () => {
    expect(byteLength(countdown.snippet!.asset.min)).toBeLessThanOrEqual(1024);
  });
});

describe('countdown page', () => {
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{}, props]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('countdown', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('ships the snippet only with a deadline', () => {
    const page = (p: object) =>
      renderPage(parseDocument(singleBlockDoc('countdown', p)), { mode: 'export' }).html;
    expect(page({})).not.toContain('<script>');
    expect(page(props)).toContain('<script>');
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(countdown, props)).toMatchFileSnapshot(
      './__snapshots__/countdown.html',
    );
  });
});
