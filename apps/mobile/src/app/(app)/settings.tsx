import Constants from 'expo-constants';
import { Info, LogOut, Mail, Monitor, Moon, Sun, User as UserIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { ThemePreference, User } from '@inkwell/shared';

import { Avatar, Card, ListRow, OfflineBanner, Screen, Text } from '@/components';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/session';
import { FirestoreUsageRow } from '@/features/dev/FirestoreUsageRow';
import { TopBar } from '@/features/navigation/TopBar';
import { applyThemePreference, saveSettings } from '@/features/settings/api';
import { haptics } from '@/lib/haptics';

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

const WEEK_STARTS: { value: 0 | 1; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 0, label: 'Sunday' },
];

function confirmSignOut() {
  Alert.alert('Sign out?', 'You can sign back in with your email at any time.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
  ]);
}

export default function SettingsScreen() {
  const uid = useSession((s) => s.uid);
  const profile = useSession((s) => s.profile);
  if (!uid || !profile) return null;
  return <Settings uid={uid} profile={profile} />;
}

function Settings({ uid, profile }: { uid: string; profile: User }) {
  const update = (settings: User['settings']) => {
    void haptics.selection();
    if (settings.theme !== profile.settings.theme) applyThemePreference(settings.theme);
    saveSettings(uid, settings).catch((error: unknown) => {
      console.warn('[settings] save failed', error);
      Alert.alert("Couldn't save your settings", 'Check your connection and try again.');
    });
  };

  return (
    <Screen scroll>
      <TopBar back />
      <OfflineBanner />
      <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
        Settings
      </Text>

      <Section title="Appearance">
        <Segmented
          options={THEMES}
          value={profile.settings.theme}
          onChange={(theme) => update({ ...profile.settings, theme })}
        />
      </Section>

      <Section title="Calendar">
        <Text variant="subhead" color="textSecondary">
          Week starts on
        </Text>
        <Segmented
          options={WEEK_STARTS}
          value={profile.settings.startOfWeek}
          onChange={(startOfWeek) => update({ ...profile.settings, startOfWeek })}
        />
      </Section>

      <Section title="Your account">
        <Card flush>
          <View style={styles.account}>
            <Avatar name={profile.displayName} size={48} />
            <View style={styles.flex}>
              <Text variant="headline">{profile.displayName}</Text>
              {profile.email ? (
                <Text variant="footnote" color="textSecondary">
                  {profile.email}
                </Text>
              ) : null}
            </View>
          </View>
          <ListRow title="Name" subtitle={profile.displayName} icon={UserIcon} />
          {profile.email ? <ListRow title="Email" subtitle={profile.email} icon={Mail} /> : null}
          <ListRow title="Sign out" icon={LogOut} destructive onPress={confirmSignOut} />
        </Card>
      </Section>

      <Section title="About">
        <Card flush>
          <ListRow
            title="Inkwell"
            subtitle={`Version ${Constants.expoConfig?.version ?? '–'}`}
            icon={Info}
          />
          {__DEV__ ? <FirestoreUsageRow /> : null}
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title3" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: typeof Sun }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => !selected && onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            {Icon ? (
              <Icon
                size={theme.iconSize.md}
                color={selected ? theme.colors.accent : theme.colors.textSecondary}
              />
            ) : null}
            <Text variant="subhead" color={selected ? 'accent' : 'textSecondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    paddingTop: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  segmented: {
    flexDirection: 'row',
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.hitTarget,
    borderRadius: theme.radii.md,
  },
  segmentSelected: {
    backgroundColor: theme.colors.surface,
    boxShadow: theme.shadows.card,
  },
}));
