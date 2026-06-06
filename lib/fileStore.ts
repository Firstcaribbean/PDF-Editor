import type { StoredPDFDocument } from "@/lib/types";

const DB_NAME = "inline-pdf-editor";
const DB_VERSION = 1;
const STORE_NAME = "documents";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function storePDFFile(file: File) {
  return storePDFBytes(await file.arrayBuffer(), file.name);
}

export async function storePDFBytes(bytes: ArrayBuffer, fileName: string, options?: { downloadable?: boolean }) {
  const db = await openDatabase();
  const id = `${Date.now()}-${crypto.randomUUID()}`;
  const record: StoredPDFDocument = {
    id,
    fileName,
    bytes,
    createdAt: Date.now(),
    downloadable: options?.downloadable,
    size: bytes.byteLength,
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
  return id;
}

export async function loadStoredPDF(id: string) {
  const db = await openDatabase();

  const record = await new Promise<StoredPDFDocument | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return record;
}
