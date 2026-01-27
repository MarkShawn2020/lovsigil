export const sigilKeys = {
  all: ['sigil'] as const,
  history: () => [...sigilKeys.all, 'history'] as const,
  historyList: (filters?: { limit?: number }) =>
    [...sigilKeys.history(), { ...filters }] as const,
}

// Keep spiritKeys as alias for backwards compatibility
export const spiritKeys = sigilKeys
