import { AppState, Fabrication, FabricationDestination, FabricationType, FabricationValue, LotUsage } from '../types';

export const LOT_USAGE_LABELS: Record<LotUsage, string> = {
  entier: 'Entier',
  fractionne: 'Fractionné',
  retravaille: 'Produit retravaillé',
};

export const DESTINATION_LABELS: Record<FabricationDestination, string> = {
  congelateur: 'Congél.',
  froid_positif: 'Froid positif',
  liaison_chaude: 'Liaison chaude',
  servi: 'Servi',
  emporte: 'Emporté',
  livre: 'Livré',
};

export const ALL_DESTINATIONS = Object.keys(DESTINATION_LABELS) as FabricationDestination[];

// Built-in type mirroring the paper register columns. Always available,
// not editable/deletable — admin-created types come from the store.
export const STANDARD_FABRICATION_TYPE: FabricationType = {
  id: 'standard',
  label: 'Standard',
  modifiedAt: 0,
  fields: [
    { id: 'ingredients', label: 'Ingrédients majeurs', kind: 'text' },
    { id: 'lot', label: 'Lot utilisé', kind: 'choice', required: true, options: Object.values(LOT_USAGE_LABELS) },
    { id: 'cooking-time', label: 'Cuisson basse température — temps', kind: 'text' },
    { id: 'cooking-temp', label: 'Cuisson basse température — T°C', kind: 'number', unit: '°C' },
    { id: 'cool-start', label: 'Refroidissement / remise en T° — début', kind: 'number', unit: '°C' },
    { id: 'cool-end', label: 'Refroidissement / remise en T° — fin', kind: 'number', unit: '°C' },
    { id: 'destinations', label: 'Stockage / Distribution', kind: 'multi_choice', required: true, options: Object.values(DESTINATION_LABELS) },
  ],
};

// Types offered in the fabrication form: the built-in Standard + the live
// admin-defined ones.
export function getAvailableFabricationTypes(state: Pick<AppState, 'fabricationTypes'>): FabricationType[] {
  const customs = (state.fabricationTypes ?? []).filter((t) => !t.deletedAt);
  return [STANDARD_FABRICATION_TYPE, ...customs];
}

// Human-readable string for one snapshot value (history modal, PDF).
export function formatFabricationValue(v: FabricationValue): string {
  if (Array.isArray(v.value)) return v.value.join(', ');
  if (typeof v.value === 'boolean') return v.value ? 'Oui' : 'Non';
  return String(v.value);
}

// Detail rows for a record — schema records read their own snapshot;
// legacy fixed-field records (pre-schema) are mapped explicitly.
export function fabricationDetails(f: Fabrication): { label: string; value: string }[] {
  if (f.values && f.values.length > 0) {
    return f.values.map((v) => ({ label: v.label, value: formatFabricationValue(v) }));
  }
  return [
    ...(f.ingredients ? [{ label: 'Ingrédients majeurs', value: f.ingredients }] : []),
    ...(f.lotUsage ? [{ label: 'Lot utilisé', value: LOT_USAGE_LABELS[f.lotUsage] }] : []),
    ...(f.cookingTime || f.cookingTemp !== undefined
      ? [{ label: 'Cuisson basse température', value: [f.cookingTime, f.cookingTemp !== undefined ? `${f.cookingTemp}°C` : null].filter(Boolean).join(' • ') }]
      : []),
    ...(f.coolingTempStart !== undefined || f.coolingTempEnd !== undefined
      ? [{ label: 'Refroidissement / remise en T°', value: [f.coolingTempStart !== undefined ? `Début ${f.coolingTempStart}°C` : null, f.coolingTempEnd !== undefined ? `Fin ${f.coolingTempEnd}°C` : null].filter(Boolean).join(' • ') }]
      : []),
    ...(f.destinations && f.destinations.length > 0
      ? [{ label: 'Stockage / Distribution', value: f.destinations.map((d) => DESTINATION_LABELS[d]).join(', ') }]
      : []),
  ];
}
