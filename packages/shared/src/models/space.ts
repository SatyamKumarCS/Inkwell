import { z } from 'zod';
import { auditFieldsSchema } from '../timestamp';

export const spaceRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export type SpaceRole = z.infer<typeof spaceRoleSchema>;

export const spaceSchema = auditFieldsSchema.extend({
  name: z.string().min(1).max(100),
  icon: z.string(),
  ownerId: z.string(),
  memberIds: z.array(z.string()).min(1),
  roles: z.record(z.string(), spaceRoleSchema),
});
export type Space = z.infer<typeof spaceSchema>;
