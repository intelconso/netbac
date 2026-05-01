import React from 'react';
import { ChefHat, ThermometerSnowflake, Wine, Archive, Droplets, Cake, MapPin } from 'lucide-react-native';
import { ZoneType } from '../types';

const ICON_BY_TYPE: Record<ZoneType, React.ComponentType<{ size?: number; color?: string }>> = {
  cuisine: ChefHat,
  chambre_froide: ThermometerSnowflake,
  bar: Wine,
  reserve: Archive,
  plonge: Droplets,
  patisserie: Cake,
  autre: MapPin,
};

type Props = {
  type: ZoneType | undefined;
  size?: number;
  color?: string;
};

export default function ZoneIcon({ type, size = 20, color = '#10B981' }: Props) {
  const Icon = (type && ICON_BY_TYPE[type]) || MapPin;
  return <Icon size={size} color={color} />;
}

export const ZONE_TYPES: { key: ZoneType; label: string; defaultName: string }[] = [
  { key: 'cuisine', label: 'Cuisine', defaultName: 'Cuisine' },
  { key: 'chambre_froide', label: 'Chambre froide', defaultName: 'Chambre froide' },
  { key: 'bar', label: 'Bar', defaultName: 'Bar' },
  { key: 'reserve', label: 'Réserve', defaultName: 'Réserve' },
  { key: 'plonge', label: 'Plonge', defaultName: 'Plonge' },
  { key: 'patisserie', label: 'Pâtisserie', defaultName: 'Pâtisserie' },
  { key: 'autre', label: 'Autre', defaultName: '' },
];
