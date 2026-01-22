export const spiritKeys = {
  all: ['spirit'] as const,
  history: () => [...spiritKeys.all, 'history'] as const,
  historyList: (filters?: { limit?: number }) =>
    [...spiritKeys.history(), { ...filters }] as const,
}
