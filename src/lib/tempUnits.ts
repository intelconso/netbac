import { AppState, StorageUnit, TempUnit } from '../types';
import { isColdUnit } from './fridgeTemp';

// Enceintes froides de la structure, projetées en TempUnit (mêmes ids → l'historique
// des relevés, indexé par unitId, reste rattaché après le figement).
export function deriveColdUnits(storageUnits: StorageUnit[]): TempUnit[] {
  return storageUnits
    .filter((u) => !u.deletedAt && isColdUnit(u.type))
    .map((u) => ({ id: u.id, name: u.name, type: u.type, modifiedAt: u.modifiedAt }));
}

// Liste vivante des enceintes du relevé de température. Tant que l'utilisateur n'a
// rien personnalisé (tempUnits === undefined), elle reflète la structure ; sinon
// elle renvoie la liste figée (hors éléments supprimés).
export function resolveTempUnits(state: Pick<AppState, 'tempUnits' | 'storageUnits'>): TempUnit[] {
  if (state.tempUnits) return state.tempUnits.filter((u) => !u.deletedAt);
  return deriveColdUnits(state.storageUnits);
}
