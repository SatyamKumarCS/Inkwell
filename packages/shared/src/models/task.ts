import { z } from 'zod';
import { auditFieldsSchema, isoDateSchema, timestampSchema } from '../timestamp';

export const taskListSchema = auditFieldsSchema.extend({
  spaceId: z.string(),
  ownerId: z.string(),
  name: z.string().min(1).max(100),
  icon: z.string(),
  order: z.string().min(1),
});
export type TaskList = z.infer<typeof taskListSchema>;

export const taskSchema = auditFieldsSchema.extend({
  spaceId: z.string(),
  ownerId: z.string(),
  /** Missing listId means the task is in the Inbox. */
  listId: z.string().optional(),
  title: z.string().max(1000),
  notes: z.string().optional(),
  done: z.boolean().default(false),
  doneAt: timestampSchema.optional(),
  dueDate: isoDateSchema.optional(),
  scheduledDate: isoDateSchema.optional(),
  reminderAt: timestampSchema.optional(),
  /** Set when the task is a to-do block inside a doc. */
  docId: z.string().optional(),
  blockId: z.string().optional(),
  order: z.string().min(1),
});
export type Task = z.infer<typeof taskSchema>;
