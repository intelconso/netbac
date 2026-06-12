import { Flame, PackageOpen, Snowflake, Tag, ThermometerSnowflake, Truck } from 'lucide-react-native';
import { ActionType, CustomActionType, DefaultActionTypeState } from '../types';

export interface ActionTypeDef {
  // Either one of the built-in ActionType ids, or a custom uuid (for admin-defined types).
  id: string;
  label: string;
  shortLabel: string;
  icon: any;
  dlcDays: number;
  isCustom?: boolean;
}

// Single shared icon for every admin-added custom type, per spec.
export const CUSTOM_ACTION_TYPE_ICON = Tag;

export const ACTION_TYPES: ActionTypeDef[] = [
  { id: 'received', label: 'Reçu', shortLabel: 'Rec.', icon: Truck, dlcDays: 5 },
  { id: 'cooked', label: 'Fabriqué', shortLabel: 'Fab.', icon: Flame, dlcDays: 3 },
  { id: 'opened', label: 'Ouvert', shortLabel: 'Ouv.', icon: PackageOpen, dlcDays: 2 },
  { id: 'defrosted', label: 'Décongelé', shortLabel: 'Déc.', icon: Snowflake, dlcDays: 1 },
  { id: 'cooling', label: 'Refroidi', shortLabel: 'Refr.', icon: ThermometerSnowflake, dlcDays: 3 },
];

// Best-effort fallback used when a product references a type that no longer
// resolves — only happens if the DB has been hand-edited or a type was wiped
// in a way the UI flow shouldn't allow.
const UNKNOWN_DEF: ActionTypeDef = {
  id: 'unknown',
  label: 'Type inconnu',
  shortLabel: '?',
  icon: Tag,
  dlcDays: 3,
};

// "Mariné" → "Mar.", "OK" → "Ok.", "  poulet  " → "Pou.", "" → "—".
export function deriveShortLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '—';
  const prefix = trimmed.slice(0, 3).toLowerCase();
  return prefix.charAt(0).toUpperCase() + prefix.slice(1) + '.';
}

interface RegistryState {
  customActionTypes: CustomActionType[];
  defaultActionTypeStates: DefaultActionTypeState[];
}

function customToDef(c: CustomActionType): ActionTypeDef {
  return {
    id: c.id,
    label: c.label,
    shortLabel: deriveShortLabel(c.label),
    icon: CUSTOM_ACTION_TYPE_ICON,
    dlcDays: c.dlcDays,
    isCustom: true,
  };
}

// What the picker should offer: enabled defaults + non-deleted customs.
// Disabled defaults and tombstoned customs are excluded.
export function getAvailableActionTypes(state: RegistryState): ActionTypeDef[] {
  const stateById = new Map(state.defaultActionTypeStates.map((s) => [s.id, s]));
  const defaults = ACTION_TYPES.filter((def) => {
    const override = stateById.get(def.id as ActionType);
    return !override?.disabled;
  });
  const customs = state.customActionTypes.filter((c) => !c.deletedAt).map(customToDef);
  return [...defaults, ...customs];
}

// What history rendering needs: resolve ANY id, including disabled defaults
// and tombstoned customs. Falls back to a placeholder if the id is truly
// unknown (should never happen for valid data).
export function getActionTypeDef(id: string, state: RegistryState): ActionTypeDef {
  const builtin = ACTION_TYPES.find((d) => d.id === id);
  if (builtin) return builtin;
  const custom = state.customActionTypes.find((c) => c.id === id);
  if (custom) return customToDef(custom);
  return UNKNOWN_DEF;
}

// Back-compat: existing code paths used getActionType(id) on the strict union.
// Keep it as a thin wrapper so we don't have to thread `state` through every
// consumer in this change.
export const getActionType = (id: ActionType): ActionTypeDef =>
  ACTION_TYPES.find((a) => a.id === id) ?? ACTION_TYPES[0];
