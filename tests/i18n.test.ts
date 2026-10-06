import { describe, expect, it } from 'vitest';
import { getLang, setLang, t, tn } from '../src/i18n';
import { HI } from '../src/i18n.hi';
import { purityHindi, toHindi } from '../shared/hindi';

describe('buyer language (English / Hindi)', () => {
  it('starts in English and shows the English text as written', () => {
    expect(getLang()).toBe('en');
    expect(t('Add to cart')).toBe('Add to cart');
    expect(tn(2, '{n} design', '{n} designs')).toBe('2 designs');
    expect(tn(1, '{n} design', '{n} designs')).toBe('1 design');
  });

  it('switches to Hindi, fills placeholders, and keeps unknown text in English', () => {
    setLang('hi');
    expect(t('Add to cart')).toBe('कार्ट में डालें');
    expect(t('Open {name}', { name: 'Bridal Chokers' })).toBe('Bridal Chokers खोलें');
    expect(tn(5, '{n} design', '{n} designs')).toBe('5 डिज़ाइन');
    expect(t('A line nobody translated')).toBe('A line nobody translated');
    setLang('en');
    expect(t('Add to cart')).toBe('Add to cart');
  });

  it('every Hindi line keeps the same placeholders as its English key', () => {
    const marks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [en, hi] of Object.entries(HI)) expect(marks(hi), en).toBe(marks(en));
  });

  it("writes the store's English names in Hindi when the owner has not", () => {
    expect(toHindi('Royal Kundan Choker')).toBe('रॉयल कुंदन चोकर');
    expect(toHindi('Bangles & Kadas')).toBe('चूड़ियाँ और कड़े');
    expect(toHindi("Men's Chains & Bracelets")).toBe('पुरुषों की चेन और ब्रेसलेट');
    expect(toHindi('Black Bead Mangalsutra')).toBe('काले मोतियों वाला मंगलसूत्र');
    expect(toHindi('Vasundhara Necklace')).toBe('वसुन्धरा हार');
    expect(toHindi('BIS Coin 22K')).toBe('BIS सिक्का 22K');
    expect(purityHindi('22K 916')).toBe('22 कैरेट 916');
  });
});
