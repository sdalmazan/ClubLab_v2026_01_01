// IndexedDB helper for persisting local match video files across sessions

export const IDB_DB_NAME = "ClubLabVideoDB";
export const IDB_STORE_NAME = "local_videos";

export function openVideoIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported"));
    }
    const request = window.indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalVideoToIDB(matchId: string, type: string, file: File): Promise<string> {
  const db = await openVideoIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const key = `local_vid_${matchId}_${type}`;
    const req = store.put({
      id: key,
      file: file,
      fileName: file.name,
      updatedAt: Date.now()
    });
    req.onsuccess = () => resolve(key);
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalVideoFromIDB(matchId: string, type: string): Promise<File | null> {
  try {
    const db = await openVideoIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const key = `local_vid_${matchId}_${type}`;
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.file) {
          resolve(req.result.file as File);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
