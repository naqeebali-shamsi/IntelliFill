/**
 * In-memory File Object Store
 *
 * Stores actual File objects that can't be persisted to localStorage.
 * Used by SmartUploadZone to store files and SmartProfile to retrieve them for extraction.
 *
 * This is a simple singleton pattern since File objects are non-serializable
 * and Zustand's persist middleware can't handle them.
 */

const fileStore = new Map<string, File>();

/**
 * Get all stored files
 */
export function getAllFiles(): Map<string, File> {
  return fileStore;
}

/**
 * Get a file by ID
 */
export function getFile(id: string): File | undefined {
  return fileStore.get(id);
}

/**
 * Store a file
 */
export function setFile(id: string, file: File): void {
  fileStore.set(id, file);
}

/**
 * Remove a file
 */
export function removeFile(id: string): void {
  fileStore.delete(id);
}

/**
 * Clear all files
 */
export function clearFiles(): void {
  fileStore.clear();
}

/**
 * Get files by their IDs
 */
export function getFilesByIds(ids: string[]): File[] {
  return ids.map((id) => fileStore.get(id)).filter((f): f is File => f !== undefined);
}

/**
 * Get file entries (id and file) for detected files
 */
export function getFileEntries(): Array<{ id: string; file: File }> {
  return Array.from(fileStore.entries()).map(([id, file]) => ({ id, file }));
}

export const fileObjectStore = {
  getAll: getAllFiles,
  get: getFile,
  set: setFile,
  remove: removeFile,
  clear: clearFiles,
  getByIds: getFilesByIds,
  getEntries: getFileEntries,
};

export default fileObjectStore;
