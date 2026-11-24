import { Collections, Paths } from '@inkwell/shared';

import { orderBetween, previewText, type EditorBlockType } from '@/features/docs/blocks';
import { addDays, createTask, createTaskList, isoDate } from '@/features/tasks/api';
import { commitBatch, newDocId, serverTimestamp, type BatchOp } from '@/lib/db';

type SeedBlock = [EditorBlockType, string, boolean?];

const DOCS: { title: string; icon: string; blocks: SeedBlock[] }[] = [
  {
    title: 'Getting Started',
    icon: '👋',
    blocks: [
      ['paragraph', 'Inkwell keeps your docs, tasks and calendar in one place.'],
      ['heading', 'Writing'],
      ['bullet', 'Type "# " for a heading, "- " for a list, "[] " for a to-do'],
      ['bullet', 'Press Enter to continue a list'],
      ['todo', 'Star this doc from the top bar', false],
      ['todo', 'Create your first doc with +', true],
      ['divider', ''],
      ['quote', 'Everything works offline and syncs when you are back online.'],
    ],
  },
  {
    title: 'Trip to Goa',
    icon: '🏖️',
    blocks: [
      ['heading', 'Packing'],
      ['todo', 'Sunscreen', true],
      ['todo', 'Swimwear', false],
      ['todo', 'Chargers', false],
      ['heading', 'Plan'],
      ['numbered', 'Fly in on Friday morning'],
      ['numbered', 'Beach day at Palolem'],
      ['numbered', 'Spice farm tour'],
    ],
  },
  {
    title: 'Product sync notes',
    icon: '🗒️',
    blocks: [
      ['paragraph', 'Weekly sync with design and engineering.'],
      ['heading', 'Decisions'],
      ['bullet', 'Ship the editor demo on Wednesday'],
      ['bullet', 'Keep Firestore writes batched per pause in typing'],
      ['heading', 'Follow-ups'],
      ['todo', 'Share the demo recording', false],
    ],
  },
];

/** Dev only: fills the signed-in account with sample docs, lists and tasks for demos. */
export async function seedSampleContent(uid: string, spaceId: string): Promise<void> {
  const docOps: BatchOp[] = [];
  const blockOps: BatchOp[] = [];
  for (const doc of DOCS) {
    const docId = newDocId(Collections.docs);
    docOps.push({
      kind: 'set',
      path: `${Collections.docs}/${docId}`,
      data: {
        spaceId,
        ownerId: uid,
        title: doc.title,
        preview: previewText(
          doc.blocks.map(([type, text], i) => ({ id: String(i), type, text, checked: false, order: 'a0' })),
        ),
        icon: doc.icon,
        sharedWith: [],
        linkSharing: 'off',
        published: false,
        isDailyNote: false,
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
    let order: string | null = null;
    for (const [type, text, checked] of doc.blocks) {
      order = orderBetween(order, null);
      blockOps.push({
        kind: 'set',
        path: `${Paths.blocks(docId)}/${newDocId(Paths.blocks(docId))}`,
        data: {
          type,
          content: type === 'todo' ? { text, checked: checked ?? false } : { text },
          order,
          updatedBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }
  // Blocks are checked against their doc by the rules, so the docs must exist first.
  await commitBatch(docOps, 'seed docs');
  await commitBatch(blockOps, 'seed blocks');

  const today = new Date();
  const work = createTaskList(uid, spaceId, 'Work', '💼');
  const home = createTaskList(uid, spaceId, 'Home', '🏡');
  const tasks: { title: string; listId?: string; day?: number }[] = [
    { title: 'Review the editor demo', listId: work, day: 0 },
    { title: 'Reply to design feedback', listId: work, day: 0 },
    { title: 'Plan next sprint', listId: work, day: 2 },
    { title: 'Buy groceries', listId: home, day: 0 },
    { title: 'Call the plumber', listId: home, day: 1 },
    { title: 'Read "Deep Work"' },
  ];
  for (const task of tasks) {
    createTask({
      uid,
      spaceId,
      title: task.title,
      listId: task.listId,
      scheduledDate: task.day === undefined ? undefined : isoDate(addDays(today, task.day)),
    });
  }
}
