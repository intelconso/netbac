import { Flame, PackageOpen, Snowflake, Truck } from 'lucide-react-native';
import { ActionType } from '../types';

export interface ActionTypeDef {
  id: ActionType;
  label: string;
  shortLabel: string;
  icon: any;
  dlcDays: number;
}

export const ACTION_TYPES: ActionTypeDef[] = [
  { id: 'received', label: 'Reçu', shortLabel: 'Rec.', icon: Truck, dlcDays: 5 },
  { id: 'cooked', label: 'Fabriqué', shortLabel: 'Fab.', icon: Flame, dlcDays: 3 },
  { id: 'opened', label: 'Ouvert', shortLabel: 'Ouv.', icon: PackageOpen, dlcDays: 2 },
  { id: 'defrosted', label: 'Décongelé', shortLabel: 'Déc.', icon: Snowflake, dlcDays: 1 },
];

export const getActionType = (id: ActionType): ActionTypeDef =>
  ACTION_TYPES.find((a) => a.id === id) ?? ACTION_TYPES[0];
