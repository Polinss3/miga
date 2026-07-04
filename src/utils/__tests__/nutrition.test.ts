import { bmr, calculateTargets, tdee } from '../nutrition';

describe('bmr (Mifflin-St Jeor)', () => {
  it('computes male BMR', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
  });

  it('computes female BMR', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    expect(bmr({ sex: 'female', age: 25, heightCm: 165, weightKg: 60 })).toBeCloseTo(1345.25);
  });

  it('uses midpoint for unspecified sex', () => {
    const male = bmr({ sex: 'male', age: 30, heightCm: 170, weightKg: 70 });
    const female = bmr({ sex: 'female', age: 30, heightCm: 170, weightKg: 70 });
    const unspecified = bmr({ sex: 'unspecified', age: 30, heightCm: 170, weightKg: 70 });
    expect(unspecified).toBeCloseTo((male + female) / 2);
  });
});

describe('tdee', () => {
  it('applies activity multiplier', () => {
    const base = bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 });
    expect(tdee({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activityLevel: 'moderate' })).toBeCloseTo(
      base * 1.55,
    );
  });
});

describe('calculateTargets', () => {
  const inputs = {
    sex: 'male' as const,
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activityLevel: 'moderate' as const,
    goal: 'lose_fat' as const,
  };

  it('applies a deficit for fat loss', () => {
    const targets = calculateTargets(inputs);
    const maintenance = tdee(inputs);
    expect(targets.kcal).toBeLessThan(maintenance);
    expect(targets.kcal).toBeGreaterThan(maintenance * 0.7);
  });

  it('sets protein by body weight (2 g/kg for fat loss)', () => {
    expect(calculateTargets(inputs).protein_g).toBe(160);
  });

  it('macros roughly add up to total calories', () => {
    const t = calculateTargets(inputs);
    const kcalFromMacros = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
    expect(Math.abs(kcalFromMacros - t.kcal)).toBeLessThan(60);
  });

  it('never goes below safe minimum calories', () => {
    const t = calculateTargets({
      sex: 'female',
      age: 60,
      heightCm: 150,
      weightKg: 45,
      activityLevel: 'sedentary',
      goal: 'lose_fat',
    });
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
  });

  it('applies a surplus for muscle gain', () => {
    const t = calculateTargets({ ...inputs, goal: 'gain_muscle' });
    expect(t.kcal).toBeGreaterThan(tdee(inputs));
  });

  it('caps water target between 1.5L and 4L', () => {
    const light = calculateTargets({ ...inputs, weightKg: 40 });
    const heavy = calculateTargets({ ...inputs, weightKg: 150 });
    expect(light.water_ml).toBeGreaterThanOrEqual(1500);
    expect(heavy.water_ml).toBeLessThanOrEqual(4000);
  });
});
