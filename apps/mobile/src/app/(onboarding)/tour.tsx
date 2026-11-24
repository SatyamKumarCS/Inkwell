import { ArrowLeft } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, IconButton, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/session';
import { PageDots } from '@/features/onboarding/components/PageDots';
import { markOnboardingStep } from '@/features/onboarding/progress';
import { tourCards, type TourCard } from '@/features/onboarding/tourCards';
import { haptics } from '@/lib/haptics';

export default function TourScreen() {
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const uid = useSession((s) => s.uid);
  const firstName = useSession((s) => s.profile?.firstName ?? '');
  const cards = useMemo(() => tourCards(firstName), [firstName]);
  const listRef = useRef<FlatList<TourCard>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === cards.length - 1;

  function goTo(next: number) {
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
    haptics.selection();
  }

  function finish() {
    if (!uid) return;
    haptics.success();
    markOnboardingStep(uid, 'tourCompletedAt');
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topBar}>
        {index > 0 ? (
          <IconButton
            icon={ArrowLeft}
            accessibilityLabel="Previous"
            onPress={() => goTo(index - 1)}
          />
        ) : (
          <View style={styles.spacer} />
        )}
        {!isLast ? <Button label="Skip" variant="ghost" onPress={finish} /> : null}
      </View>

      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(card) => card.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.pager}
        renderItem={({ item }) => (
          <View style={styles.page(width)} accessible accessibilityRole="summary">
            <View style={styles.illustration}>
              <item.icon size={theme.iconSize.hero} color={theme.colors.accent} />
            </View>
            <Text variant="largeTitle" accessibilityRole="header">
              {item.title}
            </Text>
            <Text variant="body" color="textSecondary">
              {item.body}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <PageDots count={cards.length} index={index} />
        <Button
          label={isLast ? 'Start writing' : 'Next'}
          size="lg"
          fullWidth
          onPress={isLast ? finish : () => goTo(index + 1)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    minHeight: theme.hitTarget,
  },
  spacer: {
    width: theme.hitTarget,
  },
  // The pager is full-bleed so pages snap to the screen edges.
  pager: {
    flex: 1,
    marginHorizontal: -theme.spacing.lg,
  },
  page: (width: number) => ({
    width,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.lg,
  }),
  illustration: {
    width: 104,
    height: 104,
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
  footer: {
    gap: theme.spacing.xl,
  },
}));
