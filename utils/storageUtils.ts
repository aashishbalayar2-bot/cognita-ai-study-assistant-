
export const saveToStorage = (subjectId: string, key: string, data: any) => {
  try {
    const storageKey = `cognita_${subjectId}_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save to local storage:", error);
  }
};

export const loadFromStorage = <T>(subjectId: string, key: string): T | null => {
  try {
    const storageKey = `cognita_${subjectId}_${key}`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load from local storage:", error);
    return null;
  }
};
