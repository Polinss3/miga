import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Chip, Icon, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

/** Single-select vertical option list, Apple Settings style. */
export function OptionList<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.lg,
              borderRadius: theme.radius.lg,
              backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
              borderWidth: 1.5,
              borderColor: selected ? theme.colors.accent : theme.colors.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="headline">{option.label}</AppText>
              {option.hint ? (
                <AppText variant="footnote" color="secondary">
                  {option.hint}
                </AppText>
              ) : null}
            </View>
            {selected ? <Icon name="check" size={18} color={theme.colors.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-select chip cloud. */
export function ChipSelect<T extends string>({
  options,
  values,
  onToggle,
}: {
  options: Option<T>[];
  values: T[];
  onToggle: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={values.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
    </View>
  );
}

/** Free-text tags (allergies, dislikes): type + return to add, tap to remove. */
export function TagInput({
  label,
  placeholder,
  tags,
  onChange,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft('');
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addTag}
        returnKeyType="done"
        submitBehavior="submit"
      />
      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {tags.map((tag) => (
            <Chip key={tag} label={`${tag} ✕`} selected onPress={() => onChange(tags.filter((t) => t !== tag))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Numeric field that reports null while empty/invalid. */
export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  allowDecimal,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  allowDecimal?: boolean;
}) {
  const [text, setText] = useState(value != null ? String(value) : '');

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={text}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      onChangeText={(raw) => {
        setText(raw);
        const parsed = allowDecimal ? parseFloat(raw.replace(',', '.')) : parseInt(raw, 10);
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
    />
  );
}
