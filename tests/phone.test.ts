import { describe, expect, it } from 'vitest';
import { tenDigits } from '../src/phone';

describe('the sign-in number field', () => {
  it('keeps the ten digits however the number was typed or pasted', () => {
    expect(tenDigits('98765 43210')).toBe('9876543210');
    expect(tenDigits('+91 98765 43210')).toBe('9876543210');
    expect(tenDigits('919876543210')).toBe('9876543210');
    expect(tenDigits('09876543210')).toBe('9876543210');
    expect(tenDigits('+91-98765-43210')).toBe('9876543210');
  });
  it('does not mistake a number that itself starts with 91 or is still being typed', () => {
    expect(tenDigits('9198765432')).toBe('9198765432');
    expect(tenDigits('91')).toBe('91');
    expect(tenDigits('987')).toBe('987');
    expect(tenDigits('abc')).toBe('');
  });
});
