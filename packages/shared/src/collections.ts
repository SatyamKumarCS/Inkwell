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
} as const;

export const Paths = {
  user: (uid: string) => `users/${uid}`,
  stars: (uid: string) => `users/${uid}/stars`,
  recents: (uid: string) => `users/${uid}/recents`,
  aiChats: (uid: string) => `users/${uid}/aiChats`,
  aiMessages: (uid: string, chatId: string) => `users/${uid}/aiChats/${chatId}/messages`,
  blocks: (docId: string) => `docs/${docId}/blocks`,
  chunks: (docId: string) => `docs/${docId}/chunks`,
  aiModelsConfig: 'config/aiModels',
} as const;
