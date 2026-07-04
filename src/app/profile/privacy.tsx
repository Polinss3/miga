import { useTranslation } from 'react-i18next';

import { AppText, Card, Screen } from '@/components/ui';
import { useTheme } from '@/theme';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen padBottom={false} contentStyle={{ paddingTop: theme.spacing.xl }}>
      <AppText variant="largeTitle">{t('profile.privacy')}</AppText>

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="headline">{t('profile.privacyPolicy')}</AppText>
        <AppText variant="body" color="secondary">
          {t('legal.privacyIntro')}
        </AppText>
      </Card>

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="headline">{t('legal.medicalDisclaimerTitle')}</AppText>
        <AppText variant="body" color="secondary">
          {t('legal.medicalDisclaimerBody')}
        </AppText>
      </Card>
    </Screen>
  );
}
