import { timestampToMillis } from '@inkwell/shared';
import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '@/components';
import { useNow } from '@/lib/useNow';

import { docTitle, type DocItem } from '../api';
import { editedLabel } from '../format';

interface DocCardProps {
  doc: DocItem;
  starred: boolean;
  onPress: () => void;
  /** Fixed width for carousels; grids pass undefined and stretch. */
  width?: number;
}

/** A doc as a tall paper card: title with icon, a rule, and when it was edited. */
export function DocCard({ doc, starred, onPress, width }: DocCardProps) {
  const { theme } = useUnistyles();
  const now = useNow();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={docTitle(doc)}
      onPress={onPress}
      style={({ pressed }) => [styles.frame, width !== undefined && { width }, pressed && styles.pressed]}
    >
      <View style={styles.paper}>
        <Text variant="title3" numberOfLines={3}>
          {docTitle(doc)}
          {doc.icon ? ` ${doc.icon}` : ''}
        </Text>
        <View style={styles.rule} />
        {doc.preview ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={6}>
            {doc.preview}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text variant="caption" color="textTertiary" numberOfLines={1} style={styles.flex}>
            {editedLabel(timestampToMillis(doc.updatedAt), now)}
          </Text>
          {starred ? (
            <Star size={theme.iconSize.sm} color={theme.colors.warning} fill={theme.colors.warning} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  frame: {
    padding: theme.spacing.xs,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.accentSoft,
    aspectRatio: 0.78,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  paper: {
    flex: 1,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  rule: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  flex: {
    flex: 1,
  },
}));
