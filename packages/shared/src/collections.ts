/** Firestore collection names and path helpers. Use these instead of string literals. */
export const Collections = {
  users: 'users',
  spaces: 'spaces',
  docs: 'docs',
  folders: 'folders',
  taskLists: 'taskLists',
  tasks: 'tasks',
  publicDocs: 'publicDocs',
  config: 'config',
  /** Server-only (email-code sign-in). */
  emailCodes: 'emailCodes',
  /** Server-only (rate-limit counters). */
  rateLimits: 'rateLimits',
} as const;

export const Paths = {
  space: (spaceId: string) => `spaces/${spaceId}`,
  user: (uid: string) => `users/${uid}`,
  stars: (uid: string) => `users/${uid}/stars`,
  recents: (uid: string) => `users/${uid}/recents`,
  aiChats: (uid: string) => `users/${uid}/aiChats`,
  aiMessages: (uid: string, chatId: string) => `users/${uid}/aiChats/${chatId}/messages`,
  blocks: (docId: string) => `docs/${docId}/blocks`,
  chunks: (docId: string) => `docs/${docId}/chunks`,
  aiModelsConfig: 'config/aiModels',
} as const;
