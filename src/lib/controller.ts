import { AppState } from '../types';

// Dernier nom de contrôleur utilisé, tous contrôles confondus — sert à
// pré-remplir le champ "Contrôleur" (colonne "Signature du contrôleur" du
// registre papier) pour que la saisie quotidienne reste un seul geste.
export function lastControllerName(state: Partial<AppState>): string {
  const pools = [
    state.oilChecks,
    state.fridgeTempChecks,
    state.fabrications,
    state.cleaningChecks,
    state.receptions,
  ];
  let best: { t: number; name: string } | null = null;
  for (const arr of pools) {
    for (const r of arr ?? []) {
      const name = (r as { operatorName?: string }).operatorName;
      if (!name) continue;
      const t = (r as { recordedAt?: number; modifiedAt?: number }).recordedAt ?? (r as { modifiedAt?: number }).modifiedAt ?? 0;
      if (!best || t > best.t) best = { t, name };
    }
  }
  return best?.name ?? state.user?.name ?? '';
}
