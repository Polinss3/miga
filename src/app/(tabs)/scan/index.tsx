import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, Icon, Screen, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

interface ScanMode {
  icon: IconName;
  titleKey: string;
  subtitleKey: string;
  href: Href;
}

const MODES: ScanMode[] = [
  { icon: 'barcode', titleKey: 'scan.barcodeTitle', subtitleKey: 'scan.barcodeSubtitle', href: '/scan/barcode' },
  { icon: 'receipt', titleKey: 'scan.receiptTitle', subtitleKey: 'scan.receiptSubtitle', href: '/scan/receipt' },
  { icon: 'camera', titleKey: 'scan.photoTitle', subtitleKey: 'scan.photoSubtitle', href: '/scan/photo' },
  { icon: 'doc', titleKey: 'scan.labelTitle', subtitleKey: 'scan.labelSubtitle', href: '/scan/label' },
  { icon: 'plus', titleKey: 'scan.manualTitle', subtitleKey: 'scan.manualSubtitle', href: '/scan/manual' },
  { icon: 'recipes', titleKey: 'scan.recipeTitle', subtitleKey: 'scan.recipeSubtitle', href: '/scan/recipe' },
];

export default function ScanHub() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.lg }}>
      <AppText variant="largeTitle">{t('scan.title')}</AppText>
      <AppText variant="body" color="secondary">
        {t('scan.subtitle')}
      </AppText>

      <View style={{ gap: theme.spacing.md }}>
        {MODES.map((mode) => (
          <Card key={mode.titleKey} onPress={() => router.push(mode.href)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={mode.icon} size={24} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="headline">{t(mode.titleKey)}</AppText>
                <AppText variant="footnote" color="secondary">
                  {t(mode.subtitleKey)}
                </AppText>
              </View>
              <Icon name="chevronRight" size={14} color={theme.colors.textTertiary} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
