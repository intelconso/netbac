import { Share } from 'react-native';
import { AppState } from '../types';
import { getDaysRemaining, formatDate } from './utils';

export function buildShareMessage(state: AppState): string {
  const { products, user } = state;
  const active = products.filter((p) => p.status === 'active');
  const expired = active.filter((p) => getDaysRemaining(p.dlc) < 0);
  const expiringSoon = active.filter((p) => {
    const d = getDaysRemaining(p.dlc);
    return d >= 0 && d <= 1;
  });
  const compliance = active.length > 0
    ? Math.round(((active.length - expired.length) / active.length) * 100)
    : 100;

  return [
    `📋 NETBAC — ${user?.restaurantName || 'Restaurant'}`,
    `🗓 ${formatDate(Date.now())}`,
    ``,
    `✅ Conformité HACCP: ${compliance}%`,
    `📦 Produits actifs: ${active.length}`,
    `⚠️ Expirés: ${expired.length}`,
    `⏰ Expire aujourd'hui: ${expiringSoon.length}`,
    ``,
    `Généré par NETBAC Pro`,
  ].join('\n');
}

export async function shareHaccpSummary(state: AppState): Promise<{ action: string }> {
  const message = buildShareMessage(state);
  const result = await Share.share({ message, title: 'NETBAC — Résumé HACCP' });
  return { action: result.action };
}
