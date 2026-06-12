import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { CheckCircle2, Pencil, Thermometer, XCircle } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn } from '../../lib/utils';
import { isColdUnit, isTempConform, targetLabel } from '../../lib/fridgeTemp';
import { lastControllerName } from '../../lib/controller';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY = 86400000;
const SERVICES = [
  { id: 'debut' as const, label: 'Début de service' },
  { id: 'fin' as const, label: 'Fin de service' },
];

// Relevé des températures des enceintes frigorifiques — deux relevés par jour
// et par enceinte (début / fin de service). Conformité dérivée de la plage
// réglementaire du type d'enceinte ; action corrective exigée en cas d'écart.
export default function FridgeTempSection() {
  const store = useActiveStore();
  const { storageUnits, fridgeTempChecks, addFridgeTempCheck, updateFridgeTempCheck } = store;
  const coldUnits = storageUnits.filter((u) => isColdUnit(u.type));

  const [service, setService] = useState<'debut' | 'fin'>('debut');
  // Shared across all readings saved in this session — prefilled with the
  // last controller name used anywhere in the register.
  const [controller, setController] = useState(() => lastControllerName(store));
  const [backfillDay, setBackfillDay] = useState<number | null>(null);
  // Drafts keyed by unitId — temperature text and corrective action text.
  const [temps, setTemps] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<Record<string, string>>({});
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const dayStart = backfillDay ?? startOfToday;
  const dayEnd = dayStart + DAY;

  const checksFor = (unitId: string, svc: 'debut' | 'fin') =>
    fridgeTempChecks.find((c) => c.unitId === unitId && c.service === svc && c.timestamp >= dayStart && c.timestamp < dayEnd);

  // Days of the past week with no reading at all, starting from the first-ever
  // reading (same rule as the oil control).
  const firstCheckAt = fridgeTempChecks.reduce((min, c) => Math.min(min, c.timestamp), Infinity);
  const missedDays: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const day = startOfToday - i * DAY;
    if (day + DAY <= firstCheckAt) break;
    const covered = fridgeTempChecks.some((c) => c.timestamp >= day && c.timestamp < day + DAY);
    if (!covered) missedDays.push(day);
  }

  const doneCount = (svc: 'debut' | 'fin') => coldUnits.filter((u) => checksFor(u.id, svc)).length;

  const setTemp = (unitId: string, value: string) => setTemps((t) => ({ ...t, [unitId]: value }));
  const setAction = (unitId: string, value: string) => setActions((a) => ({ ...a, [unitId]: value }));

  const parseTemp = (raw: string): number | null => {
    const v = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  };

  const startEdit = (unitId: string) => {
    const existing = checksFor(unitId, service);
    if (!existing) return;
    setEditingUnitId(unitId);
    setTemp(unitId, String(existing.temperature));
    setAction(unitId, existing.correctiveAction ?? '');
    if (existing.operatorName) setController(existing.operatorName);
  };

  const saveUnit = (unitId: string) => {
    const unit = coldUnits.find((u) => u.id === unitId);
    const temp = parseTemp(temps[unitId] ?? '');
    if (!unit || temp === null || !controller.trim()) return;
    const conform = isTempConform(unit.type, temp);
    const correctiveAction = (actions[unitId] ?? '').trim();
    if (!conform && !correctiveAction) return; // action corrective requise
    const data = {
      temperature: temp,
      conform,
      operatorName: controller.trim(),
      ...(correctiveAction ? { correctiveAction } : {}),
    };
    const existing = checksFor(unitId, service);
    if (existing) {
      updateFridgeTempCheck(existing.id, data);
    } else {
      addFridgeTempCheck(
        {
          ...data,
          unitId,
          service,
          ...(backfillDay ? { backfilled: true } : {}),
        },
        // Backfilled readings land at plausible service times of their day.
        backfillDay ? { timestamp: backfillDay + (service === 'debut' ? 10 : 22) * 3600000 } : undefined
      );
    }
    setTemps((t) => ({ ...t, [unitId]: '' }));
    setActions((a) => ({ ...a, [unitId]: '' }));
    setEditingUnitId(null);
  };

  if (coldUnits.length === 0) {
    return (
      <View className="bg-gray-50 p-4 rounded-2xl">
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
          Aucune enceinte frigorifique — ajoutez un frigo, congélateur ou saladette dans Paramètres → Structure
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {backfillDay && (
        <View className="bg-alert/10 p-3 rounded-xl flex-row items-center justify-between">
          <Text className="text-[10px] font-black text-alert uppercase tracking-widest flex-1">
            Saisie a posteriori — {format(new Date(backfillDay), 'EEEE d MMMM', { locale: fr })}
          </Text>
          <Pressable onPress={() => setBackfillDay(null)}>
            <Text className="text-[10px] font-black text-gray-400 uppercase">Retour</Text>
          </Pressable>
        </View>
      )}

      <View className="gap-2">
        <Text className="text-[9px] font-bold text-gray-400 uppercase">Contrôleur</Text>
        <TextInput
          value={controller}
          onChangeText={setController}
          placeholder="Nom du contrôleur"
          className="p-3 bg-white border border-gray-100 rounded-xl text-sm font-bold"
        />
      </View>

      <View className="flex-row p-1 bg-gray-100 rounded-2xl">
        {SERVICES.map((s) => (
          <Pressable key={s.id} onPress={() => { setService(s.id); setEditingUnitId(null); }} className={cn('flex-1 py-2.5 rounded-xl items-center', service === s.id && 'bg-white')}>
            <Text className={cn('text-[9px] font-black uppercase tracking-widest', service === s.id ? 'text-primary' : 'text-gray-400')}>
              {s.label} ({doneCount(s.id)}/{coldUnits.length})
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="gap-3">
        {coldUnits.map((unit) => {
          const existing = checksFor(unit.id, service);
          const editing = editingUnitId === unit.id;
          const draft = temps[unit.id] ?? '';
          const parsed = parseTemp(draft);
          const draftConform = parsed === null ? null : isTempConform(unit.type, parsed);

          if (existing && !editing) {
            return (
              <View key={unit.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className={cn('w-10 h-10 rounded-xl items-center justify-center', existing.conform ? 'bg-success/10' : 'bg-danger/10')}>
                    {existing.conform
                      ? <CheckCircle2 size={18} color="#10B981" />
                      : <XCircle size={18} color="#EF4444" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black text-gray-900 uppercase">{unit.name}</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                      {format(new Date(existing.timestamp), 'HH:mm', { locale: fr })}
                      {existing.correctiveAction ? ` • ${existing.correctiveAction}` : ''}
                    </Text>
                  </View>
                </View>
                <Text className={cn('text-sm font-black mr-3', existing.conform ? 'text-success' : 'text-danger')}>
                  {existing.temperature}°C
                </Text>
                <Pressable onPress={() => startEdit(unit.id)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                  <Pencil size={14} color="#9CA3AF" />
                </Pressable>
              </View>
            );
          }

          return (
            <View key={unit.id} className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs font-black text-gray-900 uppercase">{unit.name}</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Cible : {targetLabel(unit.type)}</Text>
                </View>
                <Thermometer size={16} color="#9CA3AF" />
              </View>
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={draft}
                  onChangeText={(v) => setTemp(unit.id, v)}
                  placeholder="—"
                  keyboardType="numbers-and-punctuation"
                  className={cn('flex-1 p-3 bg-gray-50 rounded-xl text-sm font-bold', draftConform === false && 'border border-danger')}
                />
                <Text className="text-xs font-black text-gray-400">°C</Text>
                <Pressable
                  disabled={parsed === null || !controller.trim() || (draftConform === false && !(actions[unit.id] ?? '').trim())}
                  onPress={() => saveUnit(unit.id)}
                  className={cn('px-4 py-3 bg-primary rounded-xl', (parsed === null || !controller.trim() || (draftConform === false && !(actions[unit.id] ?? '').trim())) && 'opacity-40')}
                >
                  <Text className="text-[10px] font-black text-white uppercase">{editing ? 'Modifier' : 'OK'}</Text>
                </Pressable>
              </View>
              {draftConform === false && (
                <View className="gap-2">
                  <Text className="text-[9px] font-black text-danger uppercase tracking-widest">
                    Hors plage — action corrective requise
                  </Text>
                  <TextInput
                    value={actions[unit.id] ?? ''}
                    onChangeText={(v) => setAction(unit.id, v)}
                    placeholder="Action corrective (ex. produits déplacés, technicien appelé)"
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {!backfillDay && missedDays.length > 0 && (
        <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {missedDays.length} jour{missedDays.length > 1 ? 's' : ''} sans relevé — compléter
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {missedDays.map((day) => (
              <Pressable
                key={day}
                onPress={() => { setBackfillDay(day); setEditingUnitId(null); }}
                className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
              >
                <Text className="text-[10px] font-black text-gray-600 uppercase">
                  {format(new Date(day), 'EEE d MMM', { locale: fr })}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
