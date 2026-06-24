import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { CheckCircle2, Pencil, Thermometer, XCircle } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn } from '../../lib/utils';
import { defaultTemp, isTempConform, targetLabel } from '../../lib/fridgeTemp';
import { resolveTempUnits } from '../../lib/tempUnits';
import { lastControllerName } from '../../lib/controller';
import { isClosedDay, isSingleServiceDay } from '../../lib/serviceDays';
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
  const { storageUnits, tempUnits, fridgeTempChecks, addFridgeTempCheck, updateFridgeTempCheck, closedWeekdays, singleServiceWeekdays, dayOverrides } = store;
  const coldUnits = resolveTempUnits({ tempUnits, storageUnits });
  const schedule = { closedWeekdays, singleServiceWeekdays, dayOverrides };

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
    if (isClosedDay(day, schedule)) continue; // service fermé — pas un manque
    const covered = fridgeTempChecks.some((c) => c.timestamp >= day && c.timestamp < day + DAY);
    if (!covered) missedDays.push(day);
  }

  const doneCount = (svc: 'debut' | 'fin') => coldUnits.filter((u) => checksFor(u.id, svc)).length;
  // Service unique : un seul relevé par enceinte suffit (peu importe début/fin).
  const singleDay = isSingleServiceDay(dayStart, schedule);

  const setTemp = (unitId: string, value: string) => setTemps((t) => ({ ...t, [unitId]: value }));
  const setAction = (unitId: string, value: string) => setActions((a) => ({ ...a, [unitId]: value }));

  const parseTemp = (raw: string): number | null => {
    const v = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  };

  // Saisie sans clavier : steppers ±0.5°C et bascule de signe — évite de
  // chercher le « − » sur le pavé numérique (réglages froid souvent négatifs).
  const fmtTemp = (n: number) => String(Math.round(n * 10) / 10);
  // Les helpers tweakent la valeur visible (qui peut être le défaut pré-rempli).
  const stepTemp = (unitId: string, draft: string, delta: number) => {
    setTemp(unitId, fmtTemp((parseTemp(draft) ?? 0) + delta));
  };
  const toggleSign = (unitId: string, draft: string) => {
    const cur = parseTemp(draft);
    // Champ vide : amorce un « − » pour que les chiffres saisis soient négatifs.
    if (cur === null) setTemp(unitId, draft.trim().startsWith('-') ? '' : '-');
    else setTemp(unitId, fmtTemp(-cur));
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
    if (!unit) return;
    // Honore le défaut pré-rempli même non édité (sinon temps[unitId] reste
    // undefined et OK ne sauvegarde rien) — même fallback que `draft` au rendu.
    const temp = parseTemp(temps[unitId] ?? defaultTemp(unit.type));
    if (temp === null || !controller.trim()) return;
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
    // Retire le brouillon (et non '') pour que le défaut se ré-applique au
    // prochain relevé de la même enceinte (2e service, jour suivant…).
    setTemps((t) => { const { [unitId]: _drop, ...rest } = t; return rest; });
    setActions((a) => ({ ...a, [unitId]: '' }));
    setEditingUnitId(null);
  };

  if (coldUnits.length === 0) {
    return (
      <View className="bg-gray-50 p-4 rounded-2xl">
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
          Aucune zone de température — ajoutez-en une dans Paramètres → Personnalisation → Zones de température
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

      {singleDay && (
        <View className="bg-blue-500/10 p-3 rounded-xl">
          <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">
            Service unique — un relevé par enceinte suffit
          </Text>
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
          // Pré-rempli avec un relevé conforme typique — à ajuster, pas à ressaisir.
          const draft = temps[unit.id] ?? defaultTemp(unit.type);
          const parsed = parseTemp(draft);
          const draftConform = parsed === null ? null : isTempConform(unit.type, parsed);
          const negative = draft.trim().startsWith('-');
          const canSave = parsed !== null && !!controller.trim() && !(draftConform === false && !(actions[unit.id] ?? '').trim());

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
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => toggleSign(unit.id, draft)}
                    className={cn('w-12 h-12 rounded-xl items-center justify-center border', negative ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-100')}
                  >
                    <Text className={cn('text-lg font-black', negative ? 'text-white' : 'text-gray-400')}>±</Text>
                  </Pressable>
                  <TextInput
                    value={draft}
                    onChangeText={(v) => setTemp(unit.id, v)}
                    placeholder="—"
                    keyboardType="decimal-pad"
                    className={cn('flex-1 p-3 bg-gray-50 rounded-xl text-2xl font-black text-center', draftConform === false && 'border border-danger')}
                  />
                  <Text className="text-xs font-black text-gray-400">°C</Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => stepTemp(unit.id, draft, -0.5)} className="flex-1 py-3 bg-gray-50 rounded-xl items-center border border-gray-100">
                    <Text className="text-base font-black text-gray-600">− 0.5</Text>
                  </Pressable>
                  <Pressable onPress={() => stepTemp(unit.id, draft, 0.5)} className="flex-1 py-3 bg-gray-50 rounded-xl items-center border border-gray-100">
                    <Text className="text-base font-black text-gray-600">+ 0.5</Text>
                  </Pressable>
                  <Pressable
                    disabled={!canSave}
                    onPress={() => saveUnit(unit.id)}
                    className={cn('px-5 py-3 bg-primary rounded-xl items-center justify-center', !canSave && 'opacity-40')}
                  >
                    <Text className="text-[10px] font-black text-white uppercase">{editing ? 'Modifier' : 'OK'}</Text>
                  </Pressable>
                </View>
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
