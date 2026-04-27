import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { AppState } from '../types';
import { formatDate, getDaysRemaining } from './utils';

type PdfOptions = {
  includeTraceability?: boolean;
  includeExpired?: boolean;
  includeInventory?: boolean;
};

export function buildHaccpHtml(state: AppState, opts: PdfOptions = {}): string {
  const { products, zones, storageUnits, shelves, bacs, tempLogs, cleaningTasks, user, logs } = state;
  const active = products.filter((p) => p.status === 'active');
  const expired = active.filter((p) => getDaysRemaining(p.dlc) < 0);
  const compliance = active.length > 0
    ? Math.round(((active.length - expired.length) / active.length) * 100)
    : 100;

  const locFor = (bacId: string) => {
    const bac = bacs.find((b) => b.id === bacId);
    const shelf = shelves.find((s) => s.id === bac?.shelfId);
    const unit = storageUnits.find((u) => u.id === shelf?.unitId);
    const zone = zones.find((z) => z.id === unit?.zoneId);
    return [zone?.name, unit?.name, shelf?.name, bac?.name].filter(Boolean).join(' • ');
  };

  const traceability = opts.includeTraceability !== false
    ? `<h2>Traçabilité des produits actifs (${active.length})</h2>
       <table>
         <thead><tr><th>Produit</th><th>Qté</th><th>Emplacement</th><th>Ajouté</th><th>DLC</th><th>Opérateur</th><th>Lot</th></tr></thead>
         <tbody>${active.map((p) => `
           <tr>
             <td><strong>${p.name}</strong></td>
             <td>${p.quantity} ${p.unit}</td>
             <td>${locFor(p.bacId)}</td>
             <td>${formatDate(p.addedAt)}</td>
             <td>${formatDate(p.dlc)}</td>
             <td>${p.preparerName || '—'}</td>
             <td>${p.batchNumber || '—'}</td>
           </tr>`).join('')}</tbody>
       </table>`
    : '';

  const expiredSection = opts.includeExpired
    ? `<h2>Produits expirés (${expired.length})</h2>
       ${expired.length === 0 ? '<p>Aucun produit expiré.</p>' : `
       <table>
         <thead><tr><th>Produit</th><th>Emplacement</th><th>DLC</th><th>Jours</th></tr></thead>
         <tbody>${expired.map((p) => `
           <tr>
             <td>${p.name}</td>
             <td>${locFor(p.bacId)}</td>
             <td>${formatDate(p.dlc)}</td>
             <td>${getDaysRemaining(p.dlc)}</td>
           </tr>`).join('')}</tbody>
       </table>`}`
    : '';

  const inventory = opts.includeInventory
    ? `<h2>Inventaire</h2>
       <ul>${zones.map((z) => {
         const units = storageUnits.filter((u) => u.zoneId === z.id);
         return `<li><strong>${z.name}</strong>: ${units.length} support(s)</li>`;
       }).join('')}</ul>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"/>
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { color: #10B981; margin: 0 0 4px; }
      .meta { color: #6B7280; font-size: 12px; margin-bottom: 24px; }
      h2 { border-bottom: 2px solid #10B981; padding-bottom: 4px; margin-top: 32px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E5E7EB; }
      th { background: #F9FAFB; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
      .ok { background: #D1FAE5; color: #065F46; }
      .warn { background: #FEE2E2; color: #991B1B; }
    </style></head><body>
    <h1>Rapport HACCP — ${user?.restaurantName || 'Restaurant'}</h1>
    <div class="meta">Généré le ${formatDate(Date.now())} • Opérateur: ${user?.name || 'Inconnu'}</div>
    <p>
      <span class="badge ${expired.length === 0 ? 'ok' : 'warn'}">Conformité: ${compliance}%</span>
      &nbsp;Produits actifs: ${active.length} &nbsp;|&nbsp; Expirés: ${expired.length} &nbsp;|&nbsp; Relevés temp: ${tempLogs.length} &nbsp;|&nbsp; Nettoyages: ${cleaningTasks.length}
    </p>
    ${traceability}
    ${expiredSection}
    ${inventory}
    <h2>Historique d'activité (${Math.min(logs.length, 20)} dernières)</h2>
    <ul style="font-size: 11px;">${logs.slice(0, 20).map((l) =>
      `<li>${formatDate(l.timestamp)} — <strong>${l.userName}</strong>: ${l.details}</li>`
    ).join('')}</ul>
    </body></html>`;
}

export async function generateAndShareHaccpPdf(state: AppState, opts: PdfOptions = {}): Promise<string> {
  const html = buildHaccpHtml(state, opts);
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Rapport HACCP' });
  }
  return uri;
}
