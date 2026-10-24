import { describe, expect, it } from 'vitest';
import { PageSettingsSchema } from '@/lib/schema/settings';
import { renderTrackingBodyStart, renderTrackingHead, trackingBodyAttributes } from './vendors';

const empty = PageSettingsSchema.parse({}).tracking;
const all = {
  ...empty,
  metaPixelId: '1234567890',
  ga4Id: 'G-TEST1234',
  googleAdsId: 'AW-123456789',
  googleAdsLeadLabel: 'abcdEF12',
  gtmId: 'GTM-TEST12',
};
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

describe('vendor tags', () => {
  it('emits nothing without ids', () => {
    expect(String(renderTrackingHead(empty))).toBe('');
    expect(String(renderTrackingBodyStart(empty))).toBe('');
    expect(String(trackingBodyAttributes(empty))).toBe('');
  });

  it('Meta, gtag (one loader for GA4 and Ads) and GTM with the given ids', () => {
    const head = String(renderTrackingHead(all));
    expect(head).toContain('https://connect.facebook.net/en_US/fbevents.js');
    expect(head).toContain('fbq("init","1234567890")');
    expect(head).toMatch(/fbq\("track","PageView",\{\},\{eventID:/);
    expect(count(head, /googletagmanager\.com\/gtag\/js/g)).toBe(1);
    expect(head).toContain(
      '<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST1234"></script>',
    );
    expect(head).toContain('gtag("config","G-TEST1234")');
    expect(head).toContain('gtag("config","AW-123456789")');
    expect(head).toContain('"GTM-TEST12"');
    expect(head).toContain('https://www.googletagmanager.com/gtm.js?id=');

    const body = String(renderTrackingBodyStart(all));
    expect(body).toContain('https://www.googletagmanager.com/ns.html?id=GTM-TEST12');
    expect(body).toContain(
      'https://www.facebook.com/tr?id=1234567890&amp;ev=PageView&amp;noscript=1',
    );
    expect(String(trackingBodyAttributes(all))).toBe(
      ' data-lp-gtm data-lp-conversion="AW-123456789/abcdEF12"',
    );
  });

  it('Ads alone loads gtag with the Ads id; a conversion needs both id and label', () => {
    const ads = { ...empty, googleAdsId: 'AW-123456789' };
    expect(String(renderTrackingHead(ads))).toContain('gtag/js?id=AW-123456789');
    expect(String(trackingBodyAttributes(ads))).toBe('');
    expect(String(trackingBodyAttributes({ ...empty, googleAdsLeadLabel: 'abcdEF12' }))).toBe('');
  });
});
