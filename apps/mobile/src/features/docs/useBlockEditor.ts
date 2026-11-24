import { useCallback, useEffect, useRef, useState } from 'react';
import { Paths } from '@inkwell/shared';

import { commitBatch, listenQuery, newDocId, orderBy } from '@/lib/db';

import {
  applyShortcut,
  fromStored,
  orderBetween,
  saveOps,
  sortBlocks,
  typeAfterEnter,
  type EditorBlock,
  type EditorBlockType,
} from './blocks';

/** Saves batch keystrokes: one commit per pause in typing (see the Phase 2 quota budget). */
const SAVE_DEBOUNCE_MS = 700;

/** How long an empty cached doc waits for the server before it is treated as empty (offline). */
const OFFLINE_FALLBACK_MS = 1500;

export type EditorStatus = 'loading' | 'ready' | 'error';

interface Pending {
  dirty: Set<string>;
  created: Set<string>;
  removed: Set<string>;
  title: string | undefined;
}

const emptyPending = (): Pending => ({
  dirty: new Set(),
  created: new Set(),
  removed: new Set(),
  title: undefined,
});

/**
 * Local-first block editing for one doc. The editor's state is the source of truth while it is open;
 * remote changes are merged in for blocks that aren't being edited. Changes are written in one batched
 * commit after a pause in typing, and flushed when the editor closes.
 */
export function useBlockEditor(docId: string, uid: string) {
  const [blocks, setBlocksState] = useState<EditorBlock[]>([]);
  const [status, setStatus] = useState<EditorStatus>('loading');
  const blocksRef = useRef<EditorBlock[]>([]);
  const pending = useRef<Pending>(emptyPending());
  const focusedId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  const setBlocks = useCallback((next: EditorBlock[]) => {
    blocksRef.current = next;
    setBlocksState(next);
  }, []);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    const ops = saveOps({ docId, uid, blocks: blocksRef.current, ...p });
    pending.current = emptyPending();
    if (ops.length === 0) return;
    commitBatch(ops, `doc ${docId}`).catch((error: unknown) =>
      console.warn('[editor] save failed', error),
    );
  }, [docId, uid]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  const markDirty = (id: string) => {
    pending.current.dirty.add(id);
    scheduleSave();
  };

  const newBlock = (type: EditorBlockType, text: string, order: string): EditorBlock => {
    const id = newDocId(Paths.blocks(docId));
    pending.current.created.add(id);
    pending.current.dirty.add(id);
    return { id, type, text, checked: false, order };
  };

  // The editor is keyed by doc id, so this effect runs once per doc and starts in "loading".
  useEffect(() => {
    loaded.current = false;
    let offlineFallback: ReturnType<typeof setTimeout> | null = null;

    const load = (remote: EditorBlock[]) => {
      if (offlineFallback) clearTimeout(offlineFallback);
      loaded.current = true;
      if (remote.length === 0) {
        // A new (or empty) doc starts with one paragraph to type into.
        setBlocks([newBlock('paragraph', '', orderBetween(null, null))]);
        scheduleSave();
      } else {
        setBlocks(sortBlocks(remote));
      }
      setStatus('ready');
    };

    const unsubscribe = listenQuery(
      Paths.blocks(docId),
      [orderBy('order')],
      (view) => {
        const remote = view.docs.flatMap((d) => fromStored(d.id, d.data) ?? []);
        if (!loaded.current) {
          if (remote.length === 0 && view.fromCache) {
            // An empty cache may just mean "not downloaded yet": wait for the server, unless offline.
            offlineFallback ??= setTimeout(() => load([]), OFFLINE_FALLBACK_MS);
            return;
          }
          load(remote);
          return;
        }
        // Merge: keep local versions of blocks being edited or not yet saved.
        const p = pending.current;
        const local = new Map(blocksRef.current.map((b) => [b.id, b]));
        const merged: EditorBlock[] = [];
        const seen = new Set<string>();
        for (const block of remote) {
          seen.add(block.id);
          if (p.removed.has(block.id)) continue;
          const mine = local.get(block.id);
          merged.push(mine && (p.dirty.has(block.id) || focusedId.current === block.id) ? mine : block);
        }
        for (const block of blocksRef.current) {
          if (!seen.has(block.id) && p.created.has(block.id)) merged.push(block);
        }
        setBlocks(sortBlocks(merged));
      },
      (error) => {
        console.warn('[editor] blocks listener failed', error);
        setStatus('error');
      },
    );
    return () => {
      if (offlineFallback) clearTimeout(offlineFallback);
      unsubscribe();
      flush();
    };
    // newBlock/scheduleSave only touch refs; re-subscribing per render would drop local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, flush, setBlocks]);

  /** Handles typing in a block: markdown shortcuts change its type. Returns the id to focus, if any. */
  const changeText = (id: string, rawText: string): string | null => {
    const current = blocksRef.current;
    const block = current.find((b) => b.id === id);
    if (!block) return null;
    const text = rawText.replace(/\n/g, ' '); // pasted line breaks; Enter itself is handled by `enter`
    const shortcut = block.type === 'paragraph' ? applyShortcut(text) : null;
    const updated = shortcut ? { ...block, ...shortcut } : { ...block, text };
    setBlocks(current.map((b) => (b.id === id ? updated : b)));
    markDirty(id);
    if (shortcut?.type === 'divider') {
      // A divider has no text: continue in a new paragraph below it.
      return insertAfter(id, 'paragraph');
    }
    // A shortcut remounts the block's input (see BlockRow), so it needs focusing again.
    return shortcut ? id : null;
  };

  /** Enter at `cursor`: splits the block (lists continue) and returns the id to focus. */
  const enter = (id: string, cursor: number): string | null => {
    const current = blocksRef.current;
    const index = current.findIndex((b) => b.id === id);
    const block = current[index];
    if (!block) return null;
    // Enter on an empty list item ends the list instead of adding another item.
    if (block.text === '' && block.type !== 'paragraph' && typeAfterEnter(block.type) === block.type) {
      setBlocks(current.map((b) => (b.id === id ? { ...b, type: 'paragraph' as const } : b)));
      markDirty(id);
      return id;
    }
    const at = Math.max(0, Math.min(cursor, block.text.length));
    const inserted = newBlock(
      typeAfterEnter(block.type),
      block.text.slice(at),
      orderBetween(block.order, current[index + 1]?.order),
    );
    const next = [...current];
    next[index] = { ...block, text: block.text.slice(0, at) };
    next.splice(index + 1, 0, inserted);
    setBlocks(next);
    markDirty(id);
    return inserted.id;
  };

  /** Inserts an empty block after `id` (or at the end) and returns its id. */
  const insertAfter = (id: string | null, type: EditorBlockType): string => {
    const current = blocksRef.current;
    const index = id ? current.findIndex((b) => b.id === id) : current.length - 1;
    const inserted = newBlock(
      type,
      '',
      orderBetween(current[index]?.order, current[index + 1]?.order),
    );
    const next = [...current];
    next.splice(index + 1, 0, inserted);
    setBlocks(next);
    scheduleSave();
    return inserted.id;
  };

  const setType = (id: string, type: EditorBlockType) => {
    setBlocks(
      blocksRef.current.map((b) =>
        b.id === id ? { ...b, type, text: type === 'divider' ? '' : b.text } : b,
      ),
    );
    markDirty(id);
  };

  const toggleChecked = (id: string) => {
    setBlocks(blocksRef.current.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)));
    markDirty(id);
  };

  /** Removes a block (keeps at least one) and returns the id of the block before it, to focus. */
  const remove = (id: string): string | null => {
    const current = blocksRef.current;
    if (current.length <= 1) return null;
    const index = current.findIndex((b) => b.id === id);
    if (index < 0) return null;
    pending.current.removed.add(id);
    pending.current.dirty.delete(id);
    setBlocks(current.filter((b) => b.id !== id));
    scheduleSave();
    return current[index - 1]?.id ?? current[index + 1]?.id ?? null;
  };

  const setTitle = (title: string) => {
    pending.current.title = title;
    scheduleSave();
  };

  const setFocused = (id: string | null) => {
    focusedId.current = id;
  };

  return { blocks, status, changeText, enter, insertAfter, setType, toggleChecked, remove, setTitle, setFocused, flush };
}
