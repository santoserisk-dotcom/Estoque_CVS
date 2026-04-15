import { getCachedData, saveCache, saveMetadata, getMetadata, getDb } from './cache.js';

export async function addPendingRetirada(retirada) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue_retiradas', 'readwrite');
    const store = tx.objectStore('queue_retiradas');
    const request = store.put(retirada);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getPendingRetiradas() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue_retiradas', 'readonly');
    const store = tx.objectStore('queue_retiradas');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function removePendingRetirada(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue_retiradas', 'readwrite');
    const store = tx.objectStore('queue_retiradas');
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getPendingCount() {
  const items = await getPendingRetiradas();
  return items.length;
}

export async function applyLocalStockUpdate(itemNome, quantity) {
  const cache = await getCachedData();
  if (!cache || !cache.items) {
    return;
  }
  const item = cache.items.find(i => i.nome === itemNome);
  if (!item) {
    return;
  }
  item.quantidadeAtual = Math.max(0, item.quantidadeAtual - quantity);
  await saveCache(cache);
}

export async function getLastSync() {
  return getMetadata('lastSync');
}

export async function setLastSync(timestamp) {
  return saveMetadata('lastSync', timestamp);
}

export async function setPendingCount(count) {
  return saveMetadata('pendingCount', count);
}

export async function getPendingCountMetadata() {
  return getMetadata('pendingCount');
}
