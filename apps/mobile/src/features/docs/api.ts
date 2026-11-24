import { useEffect } from 'react';
import { create } from 'zustand';
import { Collections, Paths, docSchema, type Doc } from '@inkwell/shared';

import {
  commitBatch,
  deleteDocument,
  listenQuery,
  newDocId,
  orderBy,
  serverTimestamp,
  setDocument,
  updateDocument,
  where,
} from '@/lib/db';

/** A doc with its id. */
export type DocItem = Doc & { id: string };

export type DocsState =
  | { status: 'loading'; docs: DocItem[] }
  | { status: 'ready'; docs: DocItem[]; fromCache: boolean }
  | { status: 'error'; docs: DocItem[] };

const docPath = (docId: string) => `${Collections.docs}/${docId}`;

function parseDocs(raw: { id: string; data: Record<string, unknown> }[]): DocItem[] {
  return raw.flatMap(({ id, data }) => {
    const parsed = docSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('[docs] skipped invalid doc', id, parsed.error.issues);
      return [];
    }
    return [{ ...parsed.data, id }];
  });
}

interface DocsStore {
  state: DocsState;
  stars: Set<string>;
}

const useDocsStore = create<DocsStore>(() => ({
  state: { status: 'loading', docs: [] },
  stars: new Set(),
}));

/**
 * Keeps the user's docs in a space (newest first) and their stars in memory. Mounted once in the signed-in
 * layout: Home, All Docs, Starred, Trash and Calendar filter this list instead of opening their own queries.
 */
export function useDocsSync(uid: string, spaceId: string): void {
  useEffect(() => {
    useDocsStore.setState({ state: { status: 'loading', docs: [] } });
    return listenQuery(
      Collections.docs,
      [where('ownerId', '==', uid), where('spaceId', '==', spaceId), orderBy('updatedAt', 'desc')],
      (view) =>
        useDocsStore.setState({
          state: { status: 'ready', docs: parseDocs(view.docs), fromCache: view.fromCache },
        }),
      (error) => {
        console.warn('[docs] listener failed', error);
        useDocsStore.setState((s) => ({ state: { status: 'error', docs: s.state.docs } }));
      },
    );
  }, [uid, spaceId]);

  useEffect(
    () =>
      listenQuery(
        Paths.stars(uid),
        [],
        (view) => useDocsStore.setState({ stars: new Set(view.docs.map((d) => d.id)) }),
        (error) => console.warn('[docs] stars listener failed', error),
      ),
    [uid],
  );
}

export const useDocs = (): DocsState => useDocsStore((s) => s.state);
export const useStars = (): Set<string> => useDocsStore((s) => s.stars);

/** One doc from the synced list (undefined while loading or if it doesn't exist). */
export const useDocItem = (docId: string): DocItem | undefined =>
  useDocsStore((s) => s.state.docs.find((d) => d.id === docId));

export interface NewDoc {
  uid: string;
  spaceId: string;
  title?: string;
  icon?: string | null;
  /** "YYYY-MM-DD" for a daily note. */
  dailyDate?: string;
}

/**
 * Creates a doc and returns its id right away (the write is queued offline and confirmed later, so the
 * editor can open immediately).
 */
export function createDoc({ uid, spaceId, title = '', icon = null, dailyDate }: NewDoc): string {
  const id = newDocId(Collections.docs);
  void setDocument(docPath(id), {
    spaceId,
    ownerId: uid,
    title,
    icon,
    sharedWith: [],
    linkSharing: 'off',
    published: false,
    isDailyNote: dailyDate !== undefined,
    ...(dailyDate !== undefined ? { dailyDate } : {}),
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((error: unknown) => console.warn('[docs] create failed', error));
  return id;
}

export function updateDocFields(
  docId: string,
  fields: Partial<Pick<Doc, 'title' | 'icon' | 'deleted'>>,
): Promise<void> {
  return updateDocument(docPath(docId), { ...fields, updatedAt: serverTimestamp() });
}

export const moveToTrash = (docId: string) => updateDocFields(docId, { deleted: true });
export const restoreFromTrash = (docId: string) => updateDocFields(docId, { deleted: false });

/** Deletes a doc and its blocks for good (one commit). */
export function deleteForever(docId: string, blockIds: string[]): Promise<void> {
  return commitBatch(
    [
      ...blockIds.map((id) => ({ kind: 'delete' as const, path: `${Paths.blocks(docId)}/${id}` })),
      { kind: 'delete', path: docPath(docId) },
    ],
    `delete doc ${docId}`,
  );
}

// --- Stars: users/{uid}/stars/{docId} -------------------------------------------------------------------

export function setStarred(uid: string, docId: string, starred: boolean): Promise<void> {
  const path = `${Paths.stars(uid)}/${docId}`;
  return starred ? setDocument(path, { starredAt: serverTimestamp() }) : deleteDocument(path);
}

/** "Untitled" for docs without a title, so lists never show an empty row. */
export const docTitle = (doc: Pick<Doc, 'title'>) => doc.title.trim() || 'Untitled';
