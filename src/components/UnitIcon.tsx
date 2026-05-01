import React from 'react';
import { Refrigerator, Snowflake, Archive, Salad, Box } from 'lucide-react-native';
import { StorageUnit } from '../types';

const ICON_BY_TYPE: Record<StorageUnit['type'], React.ComponentType<{ size?: number; color?: string }>> = {
  frigo: Refrigerator,
  congelateur: Snowflake,
  reserve: Archive,
  saladette: Salad,
  autre: Box,
};

type Props = {
  type: StorageUnit['type'];
  size?: number;
  color?: string;
};

export default function UnitIcon({ type, size = 20, color = '#10B981' }: Props) {
  const Icon = ICON_BY_TYPE[type] || Box;
  return <Icon size={size} color={color} />;
}
