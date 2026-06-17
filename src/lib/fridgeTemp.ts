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

// Valeur de départ proposée dans le champ de saisie — un relevé conforme
// typique que l'opérateur n'a plus qu'à ajuster : milieu de plage pour les
// enceintes positives, quelques degrés sous la limite pour les négatives.
export function defaultTemp(type: StorageUnit['type']): string {
  const t = FRIDGE_TEMP_TARGETS[type];
  if (!t) return '';
  if (t.min !== undefined) return String((t.min + t.max) / 2);
  return String(t.max - 2);
}

export function isTempConform(type: StorageUnit['type'], temperature: number): boolean {
  const t = FRIDGE_TEMP_TARGETS[type];
  if (!t) return true;
  if (temperature > t.max) return false;
  if (t.min !== undefined && temperature < t.min) return false;
  return true;
}
