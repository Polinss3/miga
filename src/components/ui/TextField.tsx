import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from './AppText';

import { useTheme } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, style, ...rest },
  ref,
) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <AppText variant="subhead" color="secondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textTertiary}
        {...rest}
        style={[
          theme.typography.body,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            color: theme.colors.text,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            minHeight: 48,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="footnote" color="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="footnote" color="tertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { fontWeight: '500' },
});
