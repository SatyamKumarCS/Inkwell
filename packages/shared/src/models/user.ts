import { z } from 'zod';
import { auditFieldsSchema, timestampSchema } from '../timestamp';

export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const userSettingsSchema = z.object({
  theme: themePreferenceSchema.default('system'),
  /** 0 = Sunday, 1 = Monday. */
  startOfWeek: z.union([z.literal(0), z.literal(1)]).default(1),
  defaultAiModelId: z.string().optional(),
  aiResponseStyle: z.enum(['concise', 'balanced', 'detailed']).optional(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const userSchema = auditFieldsSchema.extend({
  displayName: z.string().min(1).max(100),
  email: z.email().nullable(),
  photoURL: z.url().nullable(),
  defaultSpaceId: z.string(),
  settings: userSettingsSchema,
  fcmTokens: z.array(z.string()).default([]),
});
export type User = z.infer<typeof userSchema>;

export const starSchema = z.object({ starredAt: timestampSchema });
export type Star = z.infer<typeof starSchema>;

export const recentSchema = z.object({ openedAt: timestampSchema });
export type Recent = z.infer<typeof recentSchema>;
