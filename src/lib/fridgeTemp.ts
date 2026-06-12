import { StorageUnit } from '../types';

// Plages réglementaires par type d'enceinte (arrêté du 21 décembre 2009,
// annexe 1) : enceintes positives 0..+4°C, enceintes négatives ≤ −18°C.
// `null` = pas une enceinte frigorifique, exclue du relevé.
export const FRIDGE_TEMP_TARGETS: Record<StorageUnit['type'], { min?: number; max: number } | null> = {
  frigo: { min: 0, max: 4 },
  saladette: { min: 0, max: 4 },
  congelateur: { max: -18 },
  reserve: null,
  autre: null,
};

export function isColdUnit(type: StorageUnit['type']): boolean {
  return FRIDGE_TEMP_TARGETS[type] !== null;
}

export function targetLabel(type: StorageUnit['type']): string {
  const t = FRIDGE_TEMP_TARGETS[type];
  if (!t) return '';
  return t.min !== undefined ? `${t.min} à +${t.max}°C` : `≤ ${t.max}°C`;
}

export function isTempConform(type: StorageUnit['type'], temperature: number): boolean {
  const t = FRIDGE_TEMP_TARGETS[type];
  if (!t) return true;
  if (temperature > t.max) return false;
  if (t.min !== undefined && temperature < t.min) return false;
  return true;
}
