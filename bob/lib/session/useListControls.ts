// Placeholder for ID-based list operations over instanceData.
export function useListControls() {
  return {
    addItem: () => {},
    removeItem: () => {},
    moveItem: () => {},
    reorderList: (_: string[]) => {},
  } as const;
}

