import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Bug, CheckCircle2, Pencil } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn, formatDate } from '../../lib/utils';
import { lastControllerName } from '../../lib/controller';
import { cadenceLabel, interventionLabel, nextCheckFrom, pestStatus } from '../../lib/pestControl';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Registre de suivi — dératisation / désinsectisation (plan de lutte contre
// les nuisibles, PMS). Contrôle périodique : un passage par ligne, avec un
// prochain contrôle calculé depuis la cadence. Le `embedded` saute l'en-tête,
// la carte parente affichant le titre et le statut.
export default function PestControlSection({ embedded = false }: { embedded?: boolean }) {
  const store = useActiveStore();
  const { pestControlChecks, pestStations, pestCadence, addPestControlCheck, updatePestControlCheck } = store;

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deratisation, setDeratisation] = useState(true);
  const [desinsectisation, setDesinsectisation] = useState(false);
  const [nature, setNature] = useState<'preventif' | 'curatif'>('preventif');
  const [zones, setZones] = useState('');
  const [baitLocations, setBaitLocations] = useState('');
  const [products, setProducts] = useState('');
  const [amm, setAmm] = useState('');
  const [findings, setFindings] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [controller, setController] = useState('');

  const recent = [...pestControlChecks].sort((a, b) => b.timestamp - a.timestamp);
  const status = pestStatus(pestControlChecks, pestCadence, Date.now());
  const nextHint = nextCheckFrom(Date.now(), pestCadence);

  const canSave = controller.trim().length > 0 && (deratisation || desinsectisation);

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setDeratisation(true);
    setDesinsectisation(false);
    setNature('preventif');
    setZones('');
    setBaitLocations('');
    setProducts('');
    setAmm('');
    setFindings('');
    setCorrectiveAction('');
  };

  const handleSave = () => {
    if (!canSave) return;
    const interventionTypes: ('deratisation' | 'desinsectisation')[] = [];
    if (deratisation) interventionTypes.push('deratisation');
    if (desinsectisation) interventionTypes.push('desinsectisation');
    const data = {
      interventionTypes,
      nature,
      operatorName: controller.trim(),
      ...(zones.trim() ? { zones: zones.trim() } : {}),
      ...(baitLocations.trim() ? { baitLocations: baitLocations.trim() } : {}),
      ...(products.trim() ? { products: products.trim() } : {}),
      ...(amm.trim() ? { amm: amm.trim() } : {}),
      ...(findings.trim() ? { findings: findings.trim() } : {}),
      ...(correctiveAction.trim() ? { correctiveAction: correctiveAction.trim() } : {}),
    };
    if (editingId) {
      updatePestControlCheck(editingId, data);
    } else {
      addPestControlCheck(data);
    }
    closeForm();
  };

  const startEdit = (id: string) => {
    const check = pestControlChecks.find((c) => c.id === id);
    if (!check) return;
    setEditingId(id);
    setDeratisation(check.interventionTypes?.includes('deratisation') ?? false);
    setDesinsectisation(check.interventionTypes?.includes('desinsectisation') ?? false);
    setNature(check.nature);
    setZones(check.zones ?? '');
    setBaitLocations(check.baitLocations ?? '');
    setProducts(check.products ?? '');
    setAmm(check.amm ?? '');
    setFindings(check.findings ?? '');
    setCorrectiveAction(check.correctiveAction ?? '');
    setController(check.operatorName ?? lastControllerName(store));
    setIsAdding(true);
  };

  const openForm = () => {
    setController(lastControllerName(store));
    setIsAdding(true);
  };

  return (
    <View className="gap-4">
      {!embedded && (
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lutte contre les nuisibles</Text>
      )}

      {/* Rappel du plan : n° de piège → zone (mêmes infos que le plan papier). */}
      {pestStations.length > 0 && !isAdding && (
        <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-2">
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Plan — pièges / appâts</Text>
          <View className="flex-row flex-wrap gap-2">
            {pestStations.map((s) => (
              <View key={s.id} className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                <Text className="text-[10px] font-black text-gray-600 uppercase">
                  {s.number ? `${s.number} · ` : ''}{s.zone}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {!isAdding && (
        <Pressable onPress={openForm} className="py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2">
          <Bug size={14} color="#fff" />
          <Text className="text-[10px] font-black text-white uppercase">Enregistrer un passage</Text>
        </Pressable>
      )}

      {isAdding && (
        <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-4">
          {/* Type — Déra / Désin (multi) */}
          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Type d'intervention</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={() => setDeratisation((v) => !v)} className={cn('flex-1 py-3 rounded-xl border items-center', deratisation ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}>
                <Text className={cn('text-[10px] font-black uppercase', deratisation ? 'text-primary' : 'text-gray-400')}>Dératisation</Text>
              </Pressable>
              <Pressable onPress={() => setDesinsectisation((v) => !v)} className={cn('flex-1 py-3 rounded-xl border items-center', desinsectisation ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}>
                <Text className={cn('text-[10px] font-black uppercase', desinsectisation ? 'text-primary' : 'text-gray-400')}>Désinsectisation</Text>
              </Pressable>
            </View>
          </View>

          {/* Nature — Préventif / Curatif */}
          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Nature</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={() => setNature('preventif')} className={cn('flex-1 py-3 rounded-xl border items-center', nature === 'preventif' ? 'bg-success/10 border-success' : 'bg-gray-50 border-gray-100')}>
                <Text className={cn('text-[10px] font-black uppercase', nature === 'preventif' ? 'text-success' : 'text-gray-400')}>Préventif</Text>
              </Pressable>
              <Pressable onPress={() => setNature('curatif')} className={cn('flex-1 py-3 rounded-xl border items-center', nature === 'curatif' ? 'bg-alert/10 border-alert' : 'bg-gray-50 border-gray-100')}>
                <Text className={cn('text-[10px] font-black uppercase', nature === 'curatif' ? 'text-alert' : 'text-gray-400')}>Curatif</Text>
              </Pressable>
            </View>
          </View>

          <TextInput placeholder="Zones concernées (ex: 1/2/3/4/5)" value={zones} onChangeText={setZones} className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          <TextInput placeholder="Localisation appâts / pièges" value={baitLocations} onChangeText={setBaitLocations} className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          <TextInput placeholder="Produits utilisés" value={products} onChangeText={setProducts} className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          <TextInput placeholder="N° AMM (optionnel)" value={amm} onChangeText={setAmm} className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          <TextInput placeholder="Constats (traces, captures, activité)" value={findings} onChangeText={setFindings} multiline className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          <TextInput placeholder="Actions correctives (optionnel)" value={correctiveAction} onChangeText={setCorrectiveAction} multiline className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />

          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Responsable</Text>
            <TextInput placeholder="Nom du responsable" value={controller} onChangeText={setController} className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          </View>

          {!editingId && (
            <View className="bg-gray-50 p-3 rounded-xl">
              <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                Prochain contrôle calculé : {format(new Date(nextHint), 'EEEE d MMMM', { locale: fr })} ({cadenceLabel(pestCadence)})
              </Text>
            </View>
          )}

          <View className="flex-row gap-2">
            <Pressable onPress={closeForm} className="flex-1 py-3"><Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text></Pressable>
            <Pressable disabled={!canSave} onPress={handleSave} className={cn('flex-1 py-3 bg-primary rounded-xl', !canSave && 'opacity-40')}>
              <Text className="text-[10px] font-black uppercase text-center text-white">{editingId ? 'Modifier' : 'Enregistrer'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Échéance du prochain contrôle */}
      {!isAdding && status.state !== 'none' && status.nextDue && (
        <View className={cn('p-4 rounded-2xl flex-row items-center gap-3', status.state === 'ok' ? 'bg-success/10' : status.state === 'due' ? 'bg-alert/10' : 'bg-danger/10')}>
          <Text className={cn('text-[10px] font-black uppercase tracking-widest', status.state === 'ok' ? 'text-success' : status.state === 'due' ? 'text-alert' : 'text-danger')}>
            {status.state === 'overdue'
              ? `En retard — prévu le ${format(new Date(status.nextDue), 'd MMM', { locale: fr })}`
              : status.state === 'due'
              ? "Contrôle dû aujourd'hui"
              : `À jour • prochain le ${format(new Date(status.nextDue), 'd MMM', { locale: fr })}`}
          </Text>
        </View>
      )}

      <View className="gap-3">
        {recent.slice(0, 8).map((check) => (
          <View key={check.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <View className={cn('w-10 h-10 rounded-xl items-center justify-center', check.nature === 'curatif' ? 'bg-alert/10' : 'bg-gray-100')}>
                <Bug size={18} color={check.nature === 'curatif' ? '#F59E0B' : '#6B7280'} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black text-gray-900 uppercase">
                  {interventionLabel(check.interventionTypes)} • {check.nature === 'curatif' ? 'Curatif' : 'Préventif'}
                </Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase">
                  {formatDate(check.timestamp)}{check.operatorName ? ` • ${check.operatorName}` : ''}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => startEdit(check.id)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
              <Pencil size={14} color="#9CA3AF" />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
