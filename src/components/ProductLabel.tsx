import React from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Flame, PackageOpen, Snowflake, Truck, User as UserIcon, Thermometer, Calendar, Clock, Hash, MapPin,
} from 'lucide-react-native';
import { Product, ActionType } from '../types';
import { formatDate, getDayColor, cn } from '../lib/utils';
import { useStore } from '../lib/store';

interface ProductLabelProps {
  product: Product;
  size?: 'sm' | 'lg';
  className?: string;
}

export default function ProductLabel({ product, size = 'sm', className }: ProductLabelProps) {
  const { zones, storageUnits, shelves, bacs } = useStore();
  const dayColor = getDayColor(product.addedAt);

  const bac = bacs.find((b) => b.id === product.bacId);
  const shelf = shelves.find((s) => s.id === bac?.shelfId);
  const unit = storageUnits.find((u) => u.id === shelf?.unitId);
  const zone = zones.find((z) => z.id === unit?.zoneId);

  const locationPath = unit && shelf && bac
    ? `${unit.name} • ${shelf.name} • ${bac.name}`
    : 'Emplacement inconnu';

  const actions: { id: ActionType; label: string; icon: any }[] = [
    { id: 'cooked', label: 'Fabriqué', icon: Flame },
    { id: 'opened', label: 'Ouvert', icon: PackageOpen },
    { id: 'defrosted', label: 'Décongelé', icon: Snowflake },
    { id: 'received', label: 'Reçu', icon: Truck },
  ];

  const isLg = size === 'lg';

  return (
    <View className={cn('bg-white relative overflow-hidden border-2 border-gray-200', isLg ? 'rounded-3xl p-8' : 'rounded-2xl p-4', className)}>
      <View className={cn('absolute top-0 left-0 bottom-0', isLg ? 'w-6' : 'w-3')} style={{ backgroundColor: dayColor }} />

      <View className={cn('flex-col gap-4', isLg ? 'pl-8' : 'pl-4')}>
        <View className="flex-row justify-between items-center border-b border-gray-100 pb-3">
          <View className="flex-row gap-3">
            {actions.map((action) => {
              const active = product.actionType === action.id;
              const Icon = action.icon;
              return (
                <View key={action.id} className="items-center gap-1">
                  <View className={cn('border-2 rounded items-center justify-center', isLg ? 'w-8 h-8' : 'w-5 h-5', active ? 'border-gray-900 bg-gray-900' : 'border-gray-200')}>
                    {active && <Icon size={isLg ? 16 : 10} color="#fff" />}
                  </View>
                  <Text className={cn('font-black uppercase', isLg ? 'text-[10px]' : 'text-[7px]', active ? 'text-gray-900' : 'text-gray-200')}>
                    {action.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View className="items-end">
            <Text className={cn('font-black text-primary uppercase', isLg ? 'text-sm' : 'text-[10px]')}>NETBAC</Text>
            <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-[8px]' : 'text-[6px]')}>
              Digital Trace
            </Text>
          </View>
        </View>

        <View className="gap-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 gap-1">
              <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-xs' : 'text-[8px]')}>
                Produit / Product
              </Text>
              <Text className={cn('font-black text-gray-900 uppercase', isLg ? 'text-5xl' : 'text-2xl')}>
                {product.name}
              </Text>
            </View>
            <View className="items-end ml-4">
              <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-xs' : 'text-[8px]')}>
                Quantité
              </Text>
              <Text className={cn('font-black text-gray-900', isLg ? 'text-3xl' : 'text-lg')}>
                {product.quantity} {product.unit}
              </Text>
            </View>
          </View>

          <View className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-lg bg-white items-center justify-center">
              <MapPin size={isLg ? 18 : 14} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-[10px]' : 'text-[7px]')}>
                Emplacement / Location
              </Text>
              <Text className={cn('font-black text-gray-900 uppercase', isLg ? 'text-sm' : 'text-[9px]')}>
                {zone?.name ? `${zone.name} • ` : ''}{locationPath}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-100 gap-1">
              <View className="flex-row items-center gap-1">
                <Calendar size={isLg ? 14 : 10} color="#9CA3AF" />
                <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-[10px]' : 'text-[7px]')}>
                  Date {product.actionType === 'cooked' ? 'Fab.' : product.actionType === 'opened' ? 'Ouv.' : 'Rec.'}
                </Text>
              </View>
              <Text className={cn('font-black text-gray-900', isLg ? 'text-2xl' : 'text-sm')}>
                {formatDate(product.addedAt)}
              </Text>
            </View>
            <View className={cn('flex-1 p-3 rounded-xl border-2 gap-1', isLg ? 'border-primary bg-primary' : 'border-primary bg-white')}>
              <View className="flex-row items-center gap-1">
                <Clock size={isLg ? 14 : 10} color={isLg ? 'rgba(255,255,255,0.7)' : '#10B981'} />
                <Text className={cn('font-bold uppercase tracking-widest', isLg ? 'text-[10px] text-white/70' : 'text-[7px] text-primary')}>
                  DLC / Expiry
                </Text>
              </View>
              <Text className={cn('font-black', isLg ? 'text-2xl text-white' : 'text-sm text-primary')}>
                {formatDate(product.dlc)}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between items-end pt-2 border-t border-gray-100 gap-4">
            <View className="flex-row flex-1 gap-4">
              <View className="flex-1 gap-0.5">
                <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-[10px]' : 'text-[6px]')}>
                  Opérateur
                </Text>
                <View className="flex-row items-center gap-1">
                  <UserIcon size={isLg ? 12 : 8} color="#9CA3AF" />
                  <Text className={cn('font-black text-gray-900 uppercase', isLg ? 'text-xs' : 'text-[8px]')}>
                    {product.preparerName || 'Admin'}
                  </Text>
                </View>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-[10px]' : 'text-[6px]')}>
                  N° Lot
                </Text>
                <View className="flex-row items-center gap-1">
                  <Hash size={isLg ? 12 : 8} color="#9CA3AF" />
                  <Text className={cn('font-black text-gray-900 uppercase', isLg ? 'text-xs' : 'text-[8px]')}>
                    {product.batchNumber || '---'}
                  </Text>
                </View>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className={cn('font-bold text-gray-400 uppercase tracking-widest', isLg ? 'text-[10px]' : 'text-[6px]')}>
                  Temp.
                </Text>
                <View className="flex-row items-center gap-1">
                  <Thermometer size={isLg ? 12 : 8} color="#9CA3AF" />
                  <Text className={cn('font-black text-gray-900 uppercase', isLg ? 'text-xs' : 'text-[8px]')}>
                    {product.temperature ? `${product.temperature}°C` : '---'}
                  </Text>
                </View>
              </View>
            </View>
            <View className="items-center gap-1" testID="qr-code">
              <QRCode
                value={`NETBAC:${product.id}`}
                size={isLg ? 72 : 40}
                color="#111827"
                backgroundColor="#fff"
              />
              <Text className={cn('font-mono font-bold text-gray-400', isLg ? 'text-[8px]' : 'text-[5px]')}>
                NB-{product.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
