const DB_NAME = 'EstoqueDB';
const DB_VERSION = 1;
const STORE_CACHE = 'cache_estoque';
const STORE_QUEUE = 'queue_retiradas';
const STORE_META = 'metadata';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction(storeName, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    callback(store, resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveCache(data) {
  return runTransaction(STORE_CACHE, 'readwrite', (store, resolve, reject) => {
    const request = store.put(data, 'main');
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedData() {
  return runTransaction(STORE_CACHE, 'readonly', (store, resolve, reject) => {
    const request = store.get('main');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMetadata(key, value) {
  return runTransaction(STORE_META, 'readwrite', (store, resolve, reject) => {
    const request = store.put(value, key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function getMetadata(key) {
  return runTransaction(STORE_META, 'readonly', (store, resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearCache() {
  return runTransaction(STORE_CACHE, 'readwrite', (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function getDb() {
  return openDb();
}
