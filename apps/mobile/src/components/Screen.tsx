import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  /** Shrink the content when the keyboard opens (forms). */
  avoidKeyboard?: boolean;
}

/** Root container for a screen: theme background, safe-area padding and optional scrolling. */
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
  avoidKeyboard = false,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, styles.grow]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {avoidKeyboard ? (
        // "padding" on both platforms: the app is edge-to-edge on Android, so the window no longer resizes.
        <KeyboardAvoidingView style={styles.fill} behavior="padding">
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fill: {
    flex: 1,
  },
  grow: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
}));
