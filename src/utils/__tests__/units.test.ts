import { formatQuantity, normalizeQuantity } from '../units';

describe('normalizeQuantity', () => {
  it('normalizes kg to grams', () => {
    expect(normalizeQuantity(2, 'kg')).toEqual({ quantity: 2000, unit: 'g' });
  });

  it('normalizes liters to ml', () => {
    expect(normalizeQuantity(1.5, 'L')).toEqual({ quantity: 1500, unit: 'ml' });
  });

  it('handles Spanish unit aliases', () => {
    expect(normalizeQuantity(3, 'unidades')).toEqual({ quantity: 3, unit: 'unit' });
    expect(normalizeQuantity(500, 'gramos')).toEqual({ quantity: 500, unit: 'g' });
  });

  it('falls back to unit for unknown strings', () => {
    expect(normalizeQuantity(2, 'paquete')).toEqual({ quantity: 2, unit: 'unit' });
  });

  it('is case and whitespace insensitive', () => {
    expect(normalizeQuantity(1, ' KG ')).toEqual({ quantity: 1000, unit: 'g' });
  });
});

describe('formatQuantity', () => {
  it('promotes large grams to kg', () => {
    expect(formatQuantity(1500, 'g')).toBe('1.5 kg');
  });

  it('keeps small grams as g', () => {
    expect(formatQuantity(250, 'g')).toBe('250 g');
  });

  it('promotes large ml to L', () => {
    expect(formatQuantity(2000, 'ml')).toBe('2 L');
  });

  it('renders units as ud', () => {
    expect(formatQuantity(3, 'unit')).toBe('3 ud');
  });
});
