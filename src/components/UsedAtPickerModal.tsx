import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import { addMonths, startOfMonth, endOfMonth, startOfDay, getDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { validateUsedAt } from '../lib/usedAt';

interface Props {
  visible: boolean;
  productName: string;
  addedAt: number;
  dlc: number;
  onCancel: () => void;
  onConfirm: (usedAt: number) => void;
}

// Picker for the real-world date of use, used when back-dating "Utilisé" on
// an expired (or any) product. The chosen date is constrained to the window
// [addedAt .. min(dlc - 1ms, now)]. Dates outside the window are grey + disabled,
// and a final pure-function check via validateUsedAt blocks invalid submissions.
export default function UsedAtPickerModal({ visible, productName, addedAt, dlc, onCancel, onConfirm }: Props) {
  const startOfAdded = startOfDay(new Date(addedAt)).getTime();
  // Default: the day before DLC, or addedAt if DLC is older than addedAt+1d.
  const dlcDay = startOfDay(new Date(dlc)).getTime();
  const defaultPick = Math.max(startOfAdded, dlcDay - 86400000);
  const [pick, setPick] = useState<number>(defaultPick);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date(defaultPick)));

  const now = Date.now();
  const todayDay = startOfDay(new Date(now)).getTime();
  const errors = validateUsedAt({ usedAt: pick, dlc, addedAt, now });

  const handleConfirm = () => {
    if (errors.length === 0) onConfirm(pick);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/60 items-center justify-center p-6">
        <View className="bg-white w-full rounded-3xl p-6 gap-4" style={{ maxWidth: 400 }}>
          <View className="items-center gap-1">
            <View className="w-14 h-14 rounded-full bg-success/10 items-center justify-center mb-1">
              <CheckCircle2 size={24} color="#10B981" />
            </View>
            <Text className="text-base font-black uppercase text-gray-900 text-center">Date d'utilisation</Text>
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">{productName}</Text>
            <Text className="text-[10px] font-bold text-primary text-center mt-1">
              DLC : {format(new Date(dlc), 'dd/MM/yyyy', { locale: fr })}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Pressable
              disabled={calMonth.getTime() <= startOfMonth(new Date(addedAt)).getTime()}
              onPress={() => setCalMonth((m) => addMonths(m, -1))}
              className={cn('w-10 h-10 rounded-xl items-center justify-center', calMonth.getTime() <= startOfMonth(new Date(addedAt)).getTime() ? 'bg-gray-50 opacity-40' : 'bg-gray-50')}
            >
              <ChevronLeft size={18} color="#374151" />
            </Pressable>
            <Text className="text-sm font-black text-gray-900 uppercase">
              {format(calMonth, 'MMMM yyyy', { locale: fr })}
            </Text>
            <Pressable
              disabled={calMonth.getTime() >= startOfMonth(new Date(Math.min(dlc, now))).getTime()}
              onPress={() => setCalMonth((m) => addMonths(m, 1))}
              className={cn('w-10 h-10 rounded-xl items-center justify-center', calMonth.getTime() >= startOfMonth(new Date(Math.min(dlc, now))).getTime() ? 'bg-gray-50 opacity-40' : 'bg-gray-50')}
            >
              <ChevronRight size={18} color="#374151" />
            </Pressable>
          </View>

          <View className="flex-row">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <View key={i} className="flex-1 items-center py-1.5">
                <Text className="text-[10px] font-bold text-gray-400 uppercase">{d}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {(() => {
              const first = startOfMonth(calMonth);
              const last = endOfMonth(calMonth);
              const leadingBlanks = (getDay(first) + 6) % 7;
              const cells: React.ReactNode[] = [];
              for (let i = 0; i < leadingBlanks; i++) {
                cells.push(<View key={`b${i}`} style={{ width: '14.2857%' }} className="aspect-square" />);
              }
              for (let d = 1; d <= last.getDate(); d++) {
                const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
                const ts = date.getTime();
                // Day cell is disabled if it's outside [addedAt..min(dlc-1ms, today)].
                const disabled = ts < startOfAdded || ts >= dlcDay || ts > todayDay;
                const isPick = startOfDay(new Date(pick)).getTime() === ts;
                cells.push(
                  <View key={d} style={{ width: '14.2857%' }} className="aspect-square p-0.5">
                    <Pressable
                      disabled={disabled}
                      onPress={() => setPick(ts)}
                      className={cn('flex-1 items-center justify-center rounded-xl', isPick ? 'bg-primary' : 'bg-transparent')}
                    >
                      <Text className={cn('text-xs font-bold', isPick ? 'text-white' : disabled ? 'text-gray-200' : 'text-gray-700')}>{d}</Text>
                    </Pressable>
                  </View>,
                );
              }
              return cells;
            })()}
          </View>

          {errors.length > 0 && (
            <View className="gap-1 bg-red-50 border border-red-200 rounded-xl p-2.5">
              {errors.map((err, i) => (
                <Text key={i} className="text-[10px] font-bold text-red-700">{err}</Text>
              ))}
            </View>
          )}

          <View className="flex-row gap-3">
            <Pressable onPress={onCancel} className="flex-1 bg-gray-50 py-3 rounded-2xl">
              <Text className="text-gray-400 font-black uppercase text-xs text-center">Annuler</Text>
            </Pressable>
            <Pressable
              disabled={errors.length > 0}
              onPress={handleConfirm}
              className={cn('flex-[2] py-3 rounded-2xl', errors.length > 0 ? 'bg-gray-200' : 'bg-success')}
            >
              <Text className={cn('font-black uppercase text-xs text-center', errors.length > 0 ? 'text-gray-400' : 'text-white')}>
                Confirmer
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
