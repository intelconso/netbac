import * as Print from 'expo-print';
import { AppState, Product } from '../types';
import { formatDate, getDaysRemaining } from './utils';
import { fabricationDetails } from './fabrication';

export type ReportFilter = {
  from?: number | null;        // timestamp, inclusive
  to?: number | null;          // timestamp, inclusive
  statuses?: Array<'active' | 'used' | 'discarded'>;
  zoneId?: string | null;
  unitId?: string | null;
  shelfId?: string | null;
  bacId?: string | null;
  search?: string;
  productNames?: string[];     // exact match against any of these names
  includeSummary?: boolean;
  includeTraceability?: boolean;
  includeOilChecks?: boolean;
  includeFridgeTemps?: boolean;
  includeFabrications?: boolean;
  includeCleaningChecks?: boolean;
  includeReceptions?: boolean;
};

const DEFAULT_FILTER: Required<Pick<ReportFilter, 'statuses' | 'includeSummary' | 'includeTraceability'>> = {
  statuses: ['active', 'used', 'discarded'],
  includeSummary: true,
  includeTraceability: true,
};

export function filterProducts(state: AppState, f: ReportFilter): Product[] {
  const { products, bacs, shelves, storageUnits } = state;
  const statuses = f.statuses ?? DEFAULT_FILTER.statuses;
  const search = (f.search || '').trim().toLowerCase();
  const productNames = f.productNames ?? [];
  return products.filter((p) => {
    if (p.deletedAt) return false;
    if (!statuses.includes(p.status)) return false;
    if (productNames.length > 0 && !productNames.includes(p.name)) return false;
    if (productNames.length === 0 && search && !p.name.toLowerCase().includes(search)) return false;
    const ts = p.status === 'active' ? p.addedAt : p.modifiedAt;
    if (f.from && ts < f.from) return false;
    if (f.to && ts > f.to) return false;
    if (f.bacId) return p.bacId === f.bacId;
    const bac = bacs.find((b) => b.id === p.bacId);
    if (f.shelfId) return bac?.shelfId === f.shelfId;
    const shelf = shelves.find((s) => s.id === bac?.shelfId);
    if (f.unitId) return shelf?.unitId === f.unitId;
    const unit = storageUnits.find((u) => u.id === shelf?.unitId);
    if (f.zoneId) return unit?.zoneId === f.zoneId;
    return true;
  });
}

function locFor(state: AppState, bacId: string): string {
  const { zones, storageUnits, shelves, bacs } = state;
  const bac = bacs.find((b) => b.id === bacId);
  const shelf = shelves.find((s) => s.id === bac?.shelfId);
  const unit = storageUnits.find((u) => u.id === shelf?.unitId);
  const zone = zones.find((z) => z.id === unit?.zoneId);
  return [zone?.name, unit?.name, shelf?.name, bac?.name].filter(Boolean).join(' • ');
}

function statusLabel(s: Product['status']): string {
  return s === 'active' ? 'Actif' : s === 'used' ? 'Utilisé' : 'Jeté';
}

function statusClass(s: Product['status']): string {
  return s === 'active' ? 'ok' : s === 'used' ? 'used' : 'discarded';
}

function rangeLabel(f: ReportFilter): string {
  if (!f.from && !f.to) return 'Toute la période';
  if (f.from && f.to) return `${formatDate(f.from)} → ${formatDate(f.to)}`;
  if (f.from) return `Depuis le ${formatDate(f.from)}`;
  return `Jusqu'au ${formatDate(f.to!)}`;
}

export function buildReportHtml(state: AppState, f: ReportFilter): string {
  const { user } = state;
  const filtered = filterProducts(state, f);
  const active = filtered.filter((p) => p.status === 'active');
  const used = filtered.filter((p) => p.status === 'used');
  const discarded = filtered.filter((p) => p.status === 'discarded');
  const expired = active.filter((p) => getDaysRemaining(p.dlc) < 0);
  const compliance = active.length > 0
    ? Math.round(((active.length - expired.length) / active.length) * 100)
    : 100;

  const includeSummary = f.includeSummary !== false;
  const includeTraceability = f.includeTraceability !== false;

  const summary = includeSummary
    ? `<section class="summary">
         <div class="card"><div class="label">Conformité</div><div class="value ${expired.length === 0 ? 'ok' : 'warn'}">${compliance}%</div></div>
         <div class="card"><div class="label">Actifs</div><div class="value">${active.length}</div></div>
         <div class="card"><div class="label">Utilisés</div><div class="value">${used.length}</div></div>
         <div class="card"><div class="label">Jetés</div><div class="value">${discarded.length}</div></div>
         <div class="card"><div class="label">Expirés</div><div class="value ${expired.length === 0 ? 'ok' : 'warn'}">${expired.length}</div></div>
       </section>`
    : '';

  const traceability = includeTraceability
    ? `<h2>Traçabilité (${filtered.length})</h2>
       ${filtered.length === 0 ? '<p class="empty">Aucun produit pour ce filtre.</p>' : `
       <table>
         <thead><tr><th>Produit</th><th>Qté</th><th>Emplacement</th><th>Ajouté</th><th>DLC</th><th>Sortie</th><th>Statut</th></tr></thead>
         <tbody>${filtered.map((p) => `
           <tr>
             <td><strong>${p.name}</strong></td>
             <td>${p.quantity} ${p.unit}</td>
             <td>${locFor(state, p.bacId)}</td>
             <td>${formatDate(p.addedAt)}</td>
             <td>${formatDate(p.dlc)}</td>
             <td>${p.status === 'active' ? '—' : formatDate(p.usedAt ?? p.modifiedAt)}</td>
             <td><span class="badge ${statusClass(p.status)}">${statusLabel(p.status)}</span></td>
           </tr>`).join('')}</tbody>
       </table>`}`
    : '';

  const oilChecks = (state.oilChecks ?? [])
    .filter((c) => !c.deletedAt)
    .filter((c) => (!f.from || c.timestamp >= f.from) && (!f.to || c.timestamp <= f.to))
    .sort((a, b) => b.timestamp - a.timestamp);
  const oilSection = f.includeOilChecks !== false && oilChecks.length > 0
    ? `<h2>Contrôles des huiles de friture (${oilChecks.length})</h2>
       <table>
         <thead><tr><th>Date</th><th>Résultat</th><th>Huile changée</th><th>Contrôleur</th><th>Notes</th></tr></thead>
         <tbody>${oilChecks.map((c) => `
           <tr>
             <td>${formatDate(c.timestamp)}</td>
             <td><span class="badge ${c.result === 'conforme' ? 'ok' : 'discarded'}">${c.result === 'conforme' ? 'Conforme' : 'Non conforme'}</span></td>
             <td>${c.oilChanged ? 'Oui — récupération organisme agréé' : '—'}</td>
             <td>${c.operatorName ?? '—'}</td>
             <td>${[c.backfilled ? 'Saisi a posteriori' : null, c.notes].filter(Boolean).join(' — ')}</td>
           </tr>`).join('')}</tbody>
       </table>`
    : '';

  const fridgeTemps = (state.fridgeTempChecks ?? [])
    .filter((c) => !c.deletedAt)
    .filter((c) => (!f.from || c.timestamp >= f.from) && (!f.to || c.timestamp <= f.to))
    .sort((a, b) => b.timestamp - a.timestamp);
  const fridgeSection = f.includeFridgeTemps !== false && fridgeTemps.length > 0
    ? `<h2>Relevés des températures frigorifiques (${fridgeTemps.length})</h2>
       <table>
         <thead><tr><th>Date</th><th>Service</th><th>Enceinte</th><th>T°C</th><th>Conformité</th><th>Action corrective</th><th>Contrôleur</th></tr></thead>
         <tbody>${fridgeTemps.map((c) => `
           <tr>
             <td>${formatDate(c.timestamp)}</td>
             <td>${c.service === 'debut' ? 'Début' : 'Fin'}</td>
             <td>${state.storageUnits.find((u) => u.id === c.unitId)?.name ?? '—'}</td>
             <td>${c.temperature}°C</td>
             <td><span class="badge ${c.conform ? 'ok' : 'discarded'}">${c.conform ? 'Conforme' : 'Non conforme'}</span></td>
             <td>${[c.backfilled ? 'Saisi a posteriori' : null, c.correctiveAction].filter(Boolean).join(' — ') || '—'}</td>
             <td>${c.operatorName ?? '—'}</td>
           </tr>`).join('')}</tbody>
       </table>`
    : '';

  const fabrications = (state.fabrications ?? [])
    .filter((c) => !c.deletedAt)
    .filter((c) => (!f.from || c.timestamp >= f.from) && (!f.to || c.timestamp <= f.to))
    .sort((a, b) => b.timestamp - a.timestamp);
  const fabricationSection = f.includeFabrications !== false && fabrications.length > 0
    ? `<h2>Fabrications du jour (${fabrications.length})</h2>
       <table>
         <thead><tr><th>Date</th><th>Préparation</th><th>Type</th><th>Détails</th><th>Contrôleur</th></tr></thead>
         <tbody>${fabrications.map((c) => `
           <tr>
             <td>${formatDate(c.timestamp)}</td>
             <td><strong>${c.name}</strong></td>
             <td>${c.typeLabel ?? 'Standard'}</td>
             <td>${fabricationDetails(c).map((d) => `<strong>${d.label}:</strong> ${d.value}`).join(' &nbsp;•&nbsp; ') || '—'}</td>
             <td>${c.operatorName ?? '—'}</td>
           </tr>`).join('')}</tbody>
       </table>`
    : '';

  const cleaningChecks = (state.cleaningChecks ?? [])
    .filter((c) => !c.deletedAt)
    .filter((c) => (!f.from || c.timestamp >= f.from) && (!f.to || c.timestamp <= f.to))
    .sort((a, b) => b.timestamp - a.timestamp);
  const cleaningSection = f.includeCleaningChecks !== false && cleaningChecks.length > 0
    ? `<h2>Contrôles nettoyage (${cleaningChecks.length})</h2>
       <table>
         <thead><tr><th>Date</th><th>Zone</th><th>Résultat</th><th>Action corrective</th><th>Contrôleur</th></tr></thead>
         <tbody>${cleaningChecks.map((c) => `
           <tr>
             <td>${formatDate(c.timestamp)}</td>
             <td>${c.area}</td>
             <td><span class="badge ${c.result === 'conforme' ? 'ok' : 'discarded'}">${c.result === 'conforme' ? 'Conforme' : 'Non conforme'}</span></td>
             <td>${[c.backfilled ? 'Saisi a posteriori' : null, c.correctiveAction].filter(Boolean).join(' — ') || '—'}</td>
             <td>${c.operatorName ?? '—'}</td>
           </tr>`).join('')}</tbody>
       </table>`
    : '';

  const receptions = (state.receptions ?? [])
    .filter((r) => !r.deletedAt)
    .filter((r) => (!f.from || r.timestamp >= f.from) && (!f.to || r.timestamp <= f.to))
    .sort((a, b) => b.timestamp - a.timestamp);
  const receptionSection = f.includeReceptions !== false && receptions.length > 0
    ? `<h2>Réceptions (${receptions.length})</h2>
       <table>
         <thead><tr><th>Date</th><th>Fournisseur</th><th>N° BL / facture</th><th>Contrôle à réception</th><th>Action corrective</th><th>Contrôleur</th></tr></thead>
         <tbody>${receptions.map((r) => `
           <tr>
             <td>${formatDate(r.timestamp)}</td>
             <td><strong>${r.supplier}</strong></td>
             <td>${r.reference ?? '—'}</td>
             <td><span class="badge ${r.result === 'conforme' ? 'ok' : 'discarded'}">${r.result === 'conforme' ? 'Conforme' : 'Non conforme'}</span></td>
             <td>${[r.backfilled ? 'Saisi a posteriori' : null, r.correctiveAction].filter(Boolean).join(' — ') || '—'}</td>
             <td>${r.operatorName ?? '—'}</td>
           </tr>`).join('')}</tbody>
       </table>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"/>
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { color: #10B981; margin: 0 0 4px; font-size: 22px; }
      .meta { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
      .filters { background: #F9FAFB; padding: 12px 16px; border-radius: 8px; font-size: 11px; color: #4B5563; margin-bottom: 24px; }
      .filters strong { color: #111827; }
      h2 { border-bottom: 2px solid #10B981; padding-bottom: 4px; margin-top: 32px; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E5E7EB; }
      th { background: #F9FAFB; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; color: #6B7280; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 700; }
      .badge.ok { background: #D1FAE5; color: #065F46; }
      .badge.used { background: #DBEAFE; color: #1E40AF; }
      .badge.discarded { background: #FEE2E2; color: #991B1B; }
      .badge.warn { background: #FEE2E2; color: #991B1B; }
      .empty { color: #9CA3AF; font-size: 11px; font-style: italic; }
      .summary { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
      .summary .card { flex: 1; min-width: 100px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; }
      .summary .label { font-size: 9px; text-transform: uppercase; color: #6B7280; letter-spacing: 0.05em; }
      .summary .value { font-size: 20px; font-weight: 800; color: #111827; margin-top: 2px; }
      .summary .value.ok { color: #10B981; }
      .summary .value.warn { color: #EF4444; }
    </style></head><body>
    <h1>Rapport HACCP — ${user?.restaurantName || user?.name || 'Restaurant'}</h1>
    <div class="meta">Généré le ${formatDate(Date.now())}</div>
    <div class="filters">
      <strong>Période:</strong> ${rangeLabel(f)}
      &nbsp;•&nbsp; <strong>Statuts:</strong> ${(f.statuses ?? DEFAULT_FILTER.statuses).map(statusLabel).join(', ')}
      ${f.zoneId || f.unitId || f.shelfId || f.bacId ? `&nbsp;•&nbsp; <strong>Emplacement:</strong> filtré` : ''}
      ${f.productNames && f.productNames.length > 0 ? `&nbsp;•&nbsp; <strong>Produits:</strong> ${f.productNames.join(', ')}` : ''}
      ${f.search && !(f.productNames && f.productNames.length) ? `&nbsp;•&nbsp; <strong>Recherche:</strong> "${f.search}"` : ''}
    </div>
    ${summary}
    ${traceability}
    ${oilSection}
    ${fridgeSection}
    ${fabricationSection}
    ${cleaningSection}
    ${receptionSection}
    </body></html>`;
}

export async function generateAndShareReport(state: AppState, f: ReportFilter): Promise<void> {
  const html = buildReportHtml(state, f);
  // Opens the native print dialog (Android) / print interaction (iOS).
  // From there the user can pick "Save as PDF" → system file picker, or send to a printer.
  // No messaging/share apps are surfaced — only PDF tools and printers.
  await Print.printAsync({ html });
}
