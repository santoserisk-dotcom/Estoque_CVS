import { getPendingRetiradas, removePendingRetirada, setLastSync, setPendingCount } from './offline.js';
import { postRetirada } from './api.js';

export async function syncPendingRetiradas(updateStatus) {
  const pending = await getPendingRetiradas();
  if (!pending.length) {
    updateStatus('Nenhuma retirada pendente.');
    await setLastSync(new Date().toISOString());
    await setPendingCount(0);
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const retirada of pending) {
    try {
      await postRetirada(retirada.data, retirada.token);
      await removePendingRetirada(retirada.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      console.warn('Falha ao sincronizar retirada', retirada.id, error);
    }
  }

  await setLastSync(new Date().toISOString());
  await setPendingCount(pending.length - synced);

  const message = failed === 0
    ? `${synced} retirada(s) sincronizada(s) com sucesso.`
    : `${synced} sincronizadas, ${failed} falharam. Verifique a conexão.`;

  updateStatus(message);
  return { synced, failed };
}
