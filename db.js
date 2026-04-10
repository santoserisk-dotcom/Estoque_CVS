(() => {
  const DB_NAME = 'estoque_cvs';
  const DB_VERSION = 1;

  const stores = {
    items: 'items',
    queue: 'queue',
    recent: 'recent',
    meta: 'meta',
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(stores.items)) {
          const s = db.createObjectStore(stores.items, { keyPath: 'id' });
          s.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains(stores.queue)) {
          db.createObjectStore(stores.queue, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(stores.recent)) {
          db.createObjectStore(stores.recent, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(stores.meta)) {
          db.createObjectStore(stores.meta, { keyPath: 'key' });
        }
      };
    });
  }

  async function tx(storeName, mode, run) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const s = t.objectStore(storeName);
      const result = run(s);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
    });
  }

  const DB = {
    stores,
    async setItems(items) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const t = db.transaction(stores.items, 'readwrite');
        const s = t.objectStore(stores.items);
        s.clear();
        items.forEach((item) => s.put(item));
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    },
    getAllItems: () => tx(stores.items, 'readonly', (s) => s.getAll()),
    putItem: (item) => tx(stores.items, 'readwrite', (s) => s.put(item)),
    queuePush: (job) => tx(stores.queue, 'readwrite', (s) => s.put(job)),
    queueAll: () => tx(stores.queue, 'readonly', (s) => s.getAll()),
    queueDelete: (id) => tx(stores.queue, 'readwrite', (s) => s.delete(id)),
    recentPut: (entry) => tx(stores.recent, 'readwrite', (s) => s.put(entry)),
    recentAll: () => tx(stores.recent, 'readonly', (s) => s.getAll()),
    metaSet: (key, value) => tx(stores.meta, 'readwrite', (s) => s.put({ key, value })),
    metaGet: (key) => tx(stores.meta, 'readonly', (s) => s.get(key)),
  };

  window.DB = DB;
})();
