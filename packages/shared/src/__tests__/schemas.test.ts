import { describe, expect, it } from 'vitest';
import { docSchema, Paths, spaceSchema, taskSchema, userSchema } from '../index';

const ts = { seconds: 1_700_000_000, nanoseconds: 0 };

describe('shared schemas', () => {
  it('accepts a valid user and applies settings defaults', () => {
    const user = userSchema.parse({
      createdAt: ts,
      updatedAt: ts,
      displayName: 'Ada',
      firstName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
      defaultSpaceId: 'space1',
      settings: {},
    });
    expect(user.settings).toEqual({ theme: 'system', startOfWeek: 1 });
    expect(user.fcmTokens).toEqual([]);
    expect(user.lastName).toBe('');
    expect(user.onboarding).toEqual({});
  });

  it('rejects a space with an unknown role', () => {
    const result = spaceSchema.safeParse({
      createdAt: ts,
      updatedAt: ts,
      name: 'Personal',
      icon: '🏠',
      ownerId: 'u1',
      memberIds: ['u1'],
      roles: { u1: 'admin' },
    });
    expect(result.success).toBe(false);
  });

  it('applies doc defaults and validates dailyDate format', () => {
    const base = {
      createdAt: ts,
      updatedAt: ts,
      spaceId: 's',
      title: 'T',
      icon: null,
      ownerId: 'u',
    };
    const doc = docSchema.parse(base);
    expect(doc).toMatchObject({
      deleted: false,
      published: false,
      linkSharing: 'off',
      sharedWith: [],
    });
    expect(docSchema.safeParse({ ...base, dailyDate: '2026/11/23' }).success).toBe(false);
  });

  it('rejects a non-timestamp createdAt', () => {
    const result = taskSchema.safeParse({
      createdAt: new Date(),
      updatedAt: ts,
      spaceId: 's',
      title: 'Buy milk',
      order: 'a0',
    });
    expect(result.success).toBe(false);
  });

  it('builds subcollection paths', () => {
    expect(Paths.aiMessages('u1', 'c1')).toBe('users/u1/aiChats/c1/messages');
  });
});
