import { generateKeyBetween } from 'fractional-indexing';
import { Paths } from '@inkwell/shared';

import { fetchQuery, serverTimestamp, type BatchOp } from '@/lib/db';

/** Block types the demo editor supports (a subset of the shared `blockTypeSchema`). */
export type EditorBlockType =
  | 'paragraph'
  | 'heading'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'divider';

export const EDITOR_BLOCK_TYPES: readonly EditorBlockType[] = [
  'paragraph',
  'heading',
  'todo',
  'bullet',
  'numbered',
  'quote',
  'divider',
];

/** A block as the editor holds it. Stored as `{ type, content: { text, checked }, order, … }`. */
export interface EditorBlock {
  id: string;
  type: EditorBlockType;
  text: string;
  checked: boolean;
  /** Fractional index; blocks sort by it. */
  order: string;
}

/** Converts a stored block (`docs/{id}/blocks/{blockId}`) to the editor's shape; null if unsupported. */
export function fromStored(id: string, data: Record<string, unknown>): EditorBlock | null {
  const type = data.type;
  if (typeof type !== 'string' || !EDITOR_BLOCK_TYPES.includes(type as EditorBlockType)) return null;
  const content = (data.content ?? {}) as { text?: unknown; checked?: unknown };
  return {
    id,
    type: type as EditorBlockType,
    text: typeof content.text === 'string' ? content.text : '',
    checked: content.checked === true,
    order: typeof data.order === 'string' ? data.order : 'a0',
  };
}

export const sortBlocks = (blocks: EditorBlock[]) =>
  [...blocks].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));

/** An order key between two neighbours (either may be missing). */
export const orderBetween = (before: string | null | undefined, after: string | null | undefined) =>
  generateKeyBetween(before ?? null, after ?? null);

const SHORTCUTS: [RegExp, EditorBlockType][] = [
  [/^#{1,3} /, 'heading'],
  [/^(\[\]|\[ \]|x) /i, 'todo'],
  [/^[-*] /, 'bullet'],
  [/^1[.)] /, 'numbered'],
  [/^> /, 'quote'],
];

/**
 * Markdown-style shortcuts typed at the start of a paragraph: "# ", "[] ", "- ", "1. ", "> ", "---".
 * Returns the new type and the remaining text, or null if nothing matched.
 */
export function applyShortcut(text: string): { type: EditorBlockType; text: string } | null {
  if (text === '---') return { type: 'divider', text: '' };
  for (const [pattern, type] of SHORTCUTS) {
    const match = pattern.exec(text);
    if (match) return { type, text: text.slice(match[0].length) };
  }
  return null;
}

/** The type a new block gets after pressing Enter in `type` (lists continue, everything else is text). */
export function typeAfterEnter(type: EditorBlockType): EditorBlockType {
  return type === 'todo' || type === 'bullet' || type === 'numbered' ? type : 'paragraph';
}

/** 1-based position within a run of consecutive numbered blocks. */
export function listNumber(blocks: EditorBlock[], index: number): number {
  let n = 1;
  for (let i = index - 1; i >= 0 && blocks[i]?.type === 'numbered'; i--) n++;
  return n;
}

/** Firestore writes for a save: changed blocks (set), removed blocks (delete) and the doc's timestamp. */
export function saveOps({
  docId,
  uid,
  blocks,
  dirty,
  created,
  removed,
  title,
}: {
  docId: string;
  uid: string;
  blocks: EditorBlock[];
  dirty: Set<string>;
  /** Ids never written before (they get createdAt). */
  created: Set<string>;
  removed: Set<string>;
  /** New title, if it changed. */
  title?: string;
}): BatchOp[] {
  const ops: BatchOp[] = [];
  for (const block of blocks) {
    if (!dirty.has(block.id)) continue;
    const path = `${Paths.blocks(docId)}/${block.id}`;
    const fields = {
      type: block.type,
      content: block.type === 'todo' ? { text: block.text, checked: block.checked } : { text: block.text },
      order: block.order,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    };
    ops.push(
      created.has(block.id)
        ? { kind: 'set', path, data: { ...fields, createdAt: serverTimestamp() } }
        : { kind: 'update', path, data: fields },
    );
  }
  for (const id of removed) {
    if (!created.has(id)) ops.push({ kind: 'delete', path: `${Paths.blocks(docId)}/${id}` });
  }
  if (ops.length > 0 || title !== undefined) {
    ops.push({
      kind: 'update',
      path: `docs/${docId}`,
      data: { ...(title !== undefined ? { title } : {}), updatedAt: serverTimestamp() },
    });
  }
  return ops;
}

/** The ids of a doc's blocks (for deleting it for good). */
export async function loadBlockIds(docId: string): Promise<string[]> {
  return (await fetchQuery(Paths.blocks(docId), [])).map((d) => d.id);
}
