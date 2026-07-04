import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from './AppText';

import { useTheme } from '@/theme';
import type { Nutrients } from '@/types/domain';

interface MacroSummaryProps {
  nutrients: Partial<Nutrients>;
  /** Small caption above the block, e.g. "Por ración". */
  caption?: string;
  /** Multiplies every value (e.g. servings) before rounding. */
  factor?: number;
  /** Prefix the kcal value with ≈ for estimates. */
  approximate?: boolean;
}

/**
 * Clear macro breakdown: prominent kcal + a colored card per macro
 * (protein / carbs / fat). Reused wherever a recipe or meal shows its macros.
 */
export function MacroSummary({ nutrients, caption, factor = 1, approximate }: MacroSummaryProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const macros = [
    { label: t('today.protein'), value: (nutrients.protein_g ?? 0) * factor, color: theme.colors.protein },
    { label: t('today.carbs'), value: (nutrients.carbs_g ?? 0) * factor, color: theme.colors.carbs },
    { label: t('today.fat'), value: (nutrients.fat_g ?? 0) * factor, color: theme.colors.fat },
  ];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {caption ? (
        <AppText variant="footnote" color="tertiary">
          {caption}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
        <AppText variant="title" style={{ fontVariant: ['tabular-nums'] }}>
          {approximate ? '≈ ' : ''}
          {Math.round((nutrients.kcal ?? 0) * factor)}
        </AppText>
        <AppText variant="subhead" color="secondary">
          {t('common.kcal')}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {macros.map((macro) => (
          <View
            key={macro.label}
            style={{
              flex: 1,
              gap: 4,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: macro.color }} />
              <AppText variant="caption" color="secondary" numberOfLines={1}>
                {macro.label}
              </AppText>
            </View>
            <AppText variant="headline" style={{ fontVariant: ['tabular-nums'], color: macro.color }}>
              {Math.round(macro.value)} g
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
