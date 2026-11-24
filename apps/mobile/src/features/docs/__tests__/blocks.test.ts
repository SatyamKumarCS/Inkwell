import {
  applyShortcut,
  fromStored,
  listNumber,
  orderBetween,
  previewText,
  saveOps,
  sortBlocks,
  typeAfterEnter,
  type EditorBlock,
} from '../blocks';
import { editedLabel, matchesQuery } from '../format';

jest.mock('@/lib/db', () => ({
  fetchQuery: jest.fn(),
  serverTimestamp: () => 'SERVER_TIME',
}));

const block = (id: string, overrides: Partial<EditorBlock> = {}): EditorBlock => ({
  id,
  type: 'paragraph',
  text: '',
  checked: false,
  order: 'a0',
  ...overrides,
});

describe('applyShortcut', () => {
  it.each([
    ['# Title', 'heading', 'Title'],
    ['[] Buy milk', 'todo', 'Buy milk'],
    ['x Call Ada', 'todo', 'Call Ada'],
    ['- item', 'bullet', 'item'],
    ['* item', 'bullet', 'item'],
    ['1. first', 'numbered', 'first'],
    ['> said', 'quote', 'said'],
    ['---', 'divider', ''],
  ])('turns "%s" into a %s block', (input, type, text) => {
    expect(applyShortcut(input)).toEqual({ type, text });
  });

  it('leaves ordinary text alone', () => {
    expect(applyShortcut('Hello')).toBeNull();
    expect(applyShortcut('#hashtag')).toBeNull();
    expect(applyShortcut('xylophone')).toBeNull();
  });
});

describe('block helpers', () => {
  it('continues lists after Enter, and starts text after anything else', () => {
    expect(typeAfterEnter('todo')).toBe('todo');
    expect(typeAfterEnter('numbered')).toBe('numbered');
    expect(typeAfterEnter('heading')).toBe('paragraph');
    expect(typeAfterEnter('quote')).toBe('paragraph');
  });

  it('numbers consecutive numbered blocks', () => {
    const blocks = [
      block('a', { type: 'numbered' }),
      block('b', { type: 'numbered' }),
      block('c'),
      block('d', { type: 'numbered' }),
    ];
    expect([0, 1, 3].map((i) => listNumber(blocks, i))).toEqual([1, 2, 1]);
  });

  it('orders keys between neighbours and sorts by them', () => {
    const first = orderBetween(null, null);
    const last = orderBetween(first, null);
    const middle = orderBetween(first, last);
    expect(first < middle && middle < last).toBe(true);
    const sorted = sortBlocks([block('z', { order: last }), block('a', { order: first })]);
    expect(sorted.map((b) => b.id)).toEqual(['a', 'z']);
  });

  it('reads stored blocks and skips unsupported types', () => {
    expect(fromStored('b1', { type: 'todo', content: { text: 'Pay', checked: true }, order: 'a1' })).toEqual(
      block('b1', { type: 'todo', text: 'Pay', checked: true, order: 'a1' }),
    );
    expect(fromStored('b2', { type: 'image', content: {}, order: 'a2' })).toBeNull();
  });
});

describe('saveOps', () => {
  const blocks = [block('new', { text: 'Hi' }), block('old', { type: 'todo', text: 'Do', checked: true })];

  it('creates new blocks, updates changed ones, deletes removed ones and touches the doc', () => {
    const ops = saveOps({
      docId: 'd1',
      uid: 'ada',
      blocks,
      dirty: new Set(['new', 'old']),
      created: new Set(['new']),
      removed: new Set(['gone']),
      title: 'Plan',
    });
    expect(ops).toEqual([
      {
        kind: 'set',
        path: 'docs/d1/blocks/new',
        data: {
          type: 'paragraph',
          content: { text: 'Hi' },
          order: 'a0',
          updatedBy: 'ada',
          updatedAt: 'SERVER_TIME',
          createdAt: 'SERVER_TIME',
        },
      },
      {
        kind: 'update',
        path: 'docs/d1/blocks/old',
        data: {
          type: 'todo',
          content: { text: 'Do', checked: true },
          order: 'a0',
          updatedBy: 'ada',
          updatedAt: 'SERVER_TIME',
        },
      },
      { kind: 'delete', path: 'docs/d1/blocks/gone' },
      {
        kind: 'update',
        path: 'docs/d1',
        data: { title: 'Plan', preview: 'Hi · Do', updatedAt: 'SERVER_TIME' },
      },
    ]);
  });

  it('writes nothing when nothing changed, and never deletes blocks that were never saved', () => {
    const none = { docId: 'd1', uid: 'ada', blocks, dirty: new Set<string>(), created: new Set<string>() };
    expect(saveOps({ ...none, removed: new Set() })).toEqual([]);
    expect(saveOps({ ...none, created: new Set(['x']), removed: new Set(['x']) })).toEqual([]);
  });
});

describe('previewText', () => {
  it('joins block text and truncates long previews', () => {
    expect(previewText([block('a', { text: ' One ' }), block('b'), block('c', { text: 'Two' })])).toBe(
      'One · Two',
    );
    const long = previewText([block('a', { text: 'x'.repeat(400) })]);
    expect(long).toHaveLength(160);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('format', () => {
  const now = Date.parse('2026-11-25T10:00:00');
  it.each([
    [now - 10_000, 'Edited just now'],
    [now - 5 * 60_000, 'Edited 5 min ago'],
    [now - 3 * 3_600_000, 'Edited 3 h ago'],
    [now - 30 * 3_600_000, 'Edited yesterday'],
    [Date.parse('2026-11-12T09:00:00'), 'Edited 12 Nov'],
  ])('labels %p as "%s"', (edited, label) => {
    expect(editedLabel(edited, now)).toBe(label);
  });

  it('matches titles case-insensitively, and everything for an empty query', () => {
    expect(matchesQuery('Trip to Goa', 'goa')).toBe(true);
    expect(matchesQuery('Trip to Goa', '  ')).toBe(true);
    expect(matchesQuery('Trip to Goa', 'paris')).toBe(false);
  });
});
