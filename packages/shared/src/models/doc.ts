import { z } from 'zod';
import { auditFieldsSchema, isoDateSchema } from '../timestamp';

export const linkSharingSchema = z.enum(['off', 'view', 'edit']);
export type LinkSharing = z.infer<typeof linkSharingSchema>;

export const docSchema = auditFieldsSchema.extend({
  spaceId: z.string(),
  title: z.string().max(500),
  /** First lines of text, kept up to date by the editor so lists can show it without reading blocks. */
  preview: z.string().max(300).optional(),
  icon: z.string().nullable(),
  cover: z.string().optional(),
  folderId: z.string().optional(),
  ownerId: z.string(),
  sharedWith: z.array(z.string()).default([]),
  linkSharing: linkSharingSchema.default('off'),
  published: z.boolean().default(false),
  publicSlug: z.string().optional(),
  isDailyNote: z.boolean().default(false),
  dailyDate: isoDateSchema.optional(),
  deleted: z.boolean().default(false),
});
export type Doc = z.infer<typeof docSchema>;

export const blockTypeSchema = z.enum([
  'paragraph',
  'heading',
  'todo',
  'bullet',
  'numbered',
  'quote',
  'code',
  'image',
  'divider',
  'toggle',
  'page-link',
]);
export type BlockType = z.infer<typeof blockTypeSchema>;

/** A Tiptap JSON node. Kept loose here; the editor module owns the exact node shapes. */
export const tiptapNodeSchema = z.record(z.string(), z.unknown());
export type TiptapNode = z.infer<typeof tiptapNodeSchema>;

export const blockSchema = auditFieldsSchema.extend({
  type: blockTypeSchema,
  content: tiptapNodeSchema,
  /** Fractional index string, see the `fractional-indexing` package. */
  order: z.string().min(1),
  parentId: z.string().optional(),
  updatedBy: z.string(),
});
export type Block = z.infer<typeof blockSchema>;

export const chunkSchema = z.object({
  text: z.string(),
  /** Stored as a Firestore vector value; the shape differs per SDK so it is not validated here. */
  embedding: z.unknown(),
});
export type Chunk = z.infer<typeof chunkSchema>;

export const folderSchema = auditFieldsSchema.extend({
  spaceId: z.string(),
  name: z.string().min(1).max(200),
  parentId: z.string().optional(),
  order: z.string().min(1),
});
export type Folder = z.infer<typeof folderSchema>;

export const publicDocSchema = z.object({
  docId: z.string(),
  spaceId: z.string(),
  title: z.string(),
  renderedHtml: z.string().optional(),
  updatedAt: auditFieldsSchema.shape.updatedAt,
});
export type PublicDoc = z.infer<typeof publicDocSchema>;
