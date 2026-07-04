import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

/**
 * Primary navigation: 5 tabs (Today, Scan, Pantry, Recipes, Plan).
 * Uses the native iOS tab bar (UITabBar) via expo-router native tabs, so on
 * iOS 26 it renders the real floating Liquid Glass tab bar automatically, and
 * a standard native bottom bar on older iOS / Android.
 *
 * Profile and the AI advisor are reached from the Today/Plan headers — 7 tabs
 * would cramp the bar (HIG max 5).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <NativeTabs tintColor={theme.colors.accent}>
      <NativeTabs.Trigger name="today">
        <Icon sf="sun.max" />
        <Label>{t('tabs.today')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan">
        <Icon sf="viewfinder" />
        <Label>{t('tabs.scan')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inventory">
        <Icon sf="basket" />
        <Label>{t('tabs.inventory')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipes">
        <Icon sf="book" />
        <Label>{t('tabs.recipes')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="planning">
        <Icon sf="calendar" />
        <Label>{t('tabs.planning')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
