import { z } from 'zod';
import { auditFieldsSchema, timestampSchema } from '../timestamp';

export const aiProviderSchema = z.enum(['anthropic', 'openai', 'google']);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const aiModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: aiProviderSchema,
  isPro: z.boolean(),
});
export type AiModel = z.infer<typeof aiModelSchema>;

/** `config/aiModels` */
export const aiModelsConfigSchema = z.object({
  models: z.array(aiModelSchema),
});
export type AiModelsConfig = z.infer<typeof aiModelsConfigSchema>;

export const aiChatSchema = auditFieldsSchema.extend({
  title: z.string(),
  model: z.string(),
  docId: z.string().optional(),
});
export type AiChat = z.infer<typeof aiChatSchema>;

export const aiMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: timestampSchema,
});
export type AiMessage = z.infer<typeof aiMessageSchema>;
