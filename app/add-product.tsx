import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, BackHandler, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Check, Calendar, Package, Eye, MapPin, ChevronRight, X, ChevronLeft, Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadProductImage } from '../src/lib/cloudinary';
import { useActiveStore } from '../src/lib/useActive';
import { cn, findDuplicateProduct } from '../src/lib/utils';
import { ActionType } from '../src/types';
import { ACTION_TYPES, getAvailableActionTypes } from '../src/lib/actionTypes';
import { validateCoolingCycle, computeCoolingDlc } from '../src/lib/cooling';
import { addDays, startOfDay, addMonths, startOfMonth, endOfMonth, getDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ProductLabel from '../src/components/ProductLabel';
import { SafeAreaView } from 'react-native-safe-area-context';

const SUGGESTIONS = ['Poulet blanc', 'Escalope', 'Poulet rôti', 'Aiguillettes', 'Cuisse de poulet'];

export default function AddProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bacId?: string; editMode?: string; productId?: string; zoneId?: string; unitId?: string; shelfId?: string }>();
  const { zones, storageUnits, shelves, bacs, addProduct, updateProduct, products, user, productUnits: UNITS, customActionTypes, defaultActionTypeStates } = useActiveStore();
  const availableActionTypes = getAvailableActionTypes({ customActionTypes, defaultActionTypeStates });

  const editMode = params.editMode === 'true';
  const existingProduct = params.productId ? products.find((p) => p.id === params.productId) : null;
  const initialBacId = params.bacId || existingProduct?.bacId || bacs[0]?.id || '';
  const initialBac = bacs.find((b) => b.id === initialBacId);

  const [bacId, setBacId] = useState(initialBacId);
  const [isSelectingBac, setIsSelectingBac] = useState(false);
  const [selectionPath, setSelectionPath] = useState<{ zoneId?: string; unitId?: string; shelfId?: string }>({});

  const [name, setName] = useState(existingProduct?.name || (params.bacId ? (initialBac?.name || '') : ''));
  const [quantity, setQuantity] = useState(existingProduct?.quantity.toString() || '');
  const [unit, setUnit] = useState(existingProduct?.unit || 'kg');
  const [dlc, setDlc] = useState<number>(existingProduct?.dlc || addDays(startOfDay(new Date()), 3).getTime());
  const [actionType, setActionType] = useState<ActionType>(existingProduct?.actionType || 'received');
  const [temperature, setTemperature] = useState(existingProduct?.temperature?.toString() || '');
  const [origin, setOrigin] = useState(existingProduct?.origin || '');
  // Refroidissement rapide HACCP — only used when actionType === 'cooling'.
  const [coolStartTime, setCoolStartTime] = useState(existingProduct?.coolingStartedAt ? format(new Date(existingProduct.coolingStartedAt), 'HH:mm') : '');
  const [coolEndTime, setCoolEndTime] = useState(existingProduct?.coolingFinishedAt ? format(new Date(existingProduct.coolingFinishedAt), 'HH:mm') : '');
  const [coolTempStart, setCoolTempStart] = useState(existingProduct?.coolingTempStart?.toString() || '');
  const [coolTempEnd, setCoolTempEnd] = useState(existingProduct?.coolingTempEnd?.toString() || '');
  const [coolingErrors, setCoolingErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date(dlc)));
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(existingProduct?.photoUrl);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Pick from camera or gallery → compress + upload to Cloudinary immediately,
  // so the URL is ready by the time the user submits. Upload runs while they
  // fill the rest of the form. Failure is non-blocking: photo is optional.
  const handlePickPhoto = async (source: 'camera' | 'library') => {
    setPhotoError(null);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setPhotoError('Accès caméra refusé.'); return; }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      setPhotoUploading(true);
      const url = await uploadProductImage(result.assets[0].uri);
      setPhotoUrl(url);
    } catch (e: any) {
      setPhotoError(e?.message ?? "Échec de l'envoi de la photo.");
    } finally {
      setPhotoUploading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (showCalendar) { setShowCalendar(false); return true; }
        if (duplicateId) { setDuplicateId(null); return true; }
        if (isSelectingBac) {
          if (selectionPath.shelfId) { setSelectionPath({ zoneId: selectionPath.zoneId, unitId: selectionPath.unitId }); return true; }
          if (selectionPath.unitId) { setSelectionPath({ zoneId: selectionPath.zoneId }); return true; }
          if (selectionPath.zoneId) { setSelectionPath({}); return true; }
          setIsSelectingBac(false);
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [showCalendar, duplicateId, isSelectingBac, selectionPath])
  );

  const handleActionTypeChange = (type: string) => {
    setActionType(type as ActionType);
    setCoolingErrors([]);
    const def = availableActionTypes.find((a) => a.id === type);
    setDlc(addDays(startOfDay(new Date()), def?.dlcDays ?? 3).getTime());
  };

  // "14:30" → epoch ms today. Returns NaN if input is empty or malformed.
  const parseTimeToToday = (hhmm: string): number => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return NaN;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return NaN;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d.getTime();
  };

  const handleSubmit = () => {
    if (!name || !quantity || !bacId) return;
    let coolingFields: Partial<{ coolingStartedAt: number; coolingFinishedAt: number; coolingTempStart: number; coolingTempEnd: number }> = {};
    let dlcToSave = dlc;
    if (actionType === 'cooling') {
      const startedAt = parseTimeToToday(coolStartTime);
      const finishedAt = parseTimeToToday(coolEndTime);
      const tempStart = parseFloat(coolTempStart);
      const tempEnd = parseFloat(coolTempEnd);
      const errors = validateCoolingCycle({ startedAt, finishedAt, tempStart, tempEnd });
      if (errors.length) {
        setCoolingErrors(errors);
        return;
      }
      setCoolingErrors([]);
      coolingFields = { coolingStartedAt: startedAt, coolingFinishedAt: finishedAt, coolingTempStart: tempStart, coolingTempEnd: tempEnd };
      dlcToSave = computeCoolingDlc(finishedAt);
    }
    const dupe = findDuplicateProduct(products, bacId, name, params.productId);
    if (dupe) {
      setDuplicateId(dupe.id);
      return;
    }
    const productData: any = {
      bacId, name,
      quantity: parseFloat(quantity), unit, dlc: dlcToSave, actionType,
      ...coolingFields,
    };
    if (temperature) productData.temperature = parseFloat(temperature);
    if (origin) productData.origin = origin;
    // Assigned unconditionally so clearing the photo on edit actually removes it
    // (undefined is stripped before the cloud push and reads as absent locally).
    productData.photoUrl = photoUrl;
    if (editMode && params.productId) updateProduct(params.productId, productData);
    else addProduct(productData);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      if (router.canGoBack()) router.back();
      else router.replace('/express-add');
    }, 1200);
  };

  const selectedBac = bacs.find((b) => b.id === bacId);
  const selectedShelf = shelves.find((s) => s.id === selectedBac?.shelfId);
  const selectedUnit = storageUnits.find((u) => u.id === selectedShelf?.unitId);
  const selectedZone = zones.find((z) => z.id === selectedUnit?.zoneId);

  const missingFields: string[] = [];
  if (!name.trim()) missingFields.push('Nom');
  if (!quantity.trim() || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) missingFields.push('Quantité');
  if (!bacId) missingFields.push('Emplacement');
  const isValid = missingFields.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">{editMode ? 'Modifier' : 'Nouveau produit'}</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Étiquetage rapide</Text>
          </View>
        </View>
        <Pressable onPress={() => setShowPreview(!showPreview)} className={cn('w-10 h-10 rounded-xl items-center justify-center', showPreview ? 'bg-primary' : 'bg-gray-50')}>
          <Eye size={20} color={showPreview ? '#fff' : '#9CA3AF'} />
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        {showPreview && (
          <View className="bg-gray-50 border-b border-gray-100 p-6">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Aperçu</Text>
            <ProductLabel
              product={{
                id: 'preview', bacId, name: name || 'Nom du produit',
                quantity: parseFloat(quantity) || 0, unit,
                addedAt: Date.now(), dlc, status: 'active', actionType,
                temperature: temperature ? parseFloat(temperature) : undefined, origin, photoUrl,
                modifiedAt: Date.now(), syncStatus: 'synced',
              }}
              size="sm"
            />
          </View>
        )}

        <View className="p-6 gap-8">
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Emplacement</Text>
              <Pressable onPress={() => setIsSelectingBac(true)} className="flex-row items-center gap-1">
                <MapPin size={10} color="#10B981" />
                <Text className="text-[9px] font-black text-primary uppercase tracking-widest">Changer</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setIsSelectingBac(true)} className="bg-white border-2 border-gray-100 p-4 rounded-2xl flex-row items-center gap-4">
              <View className="flex-1">
                <Text className="text-sm font-black text-gray-900 uppercase">{selectedBac?.name || 'Sélectionner'}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {selectedZone?.name} • {selectedUnit?.name} • {selectedShelf?.name}
                </Text>
              </View>
              <ChevronRight size={16} color="#D1D5DB" />
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {bacs.slice(0, 5).map((bac) => (
                <Pressable
                  key={bac.id} onPress={() => setBacId(bac.id)}
                  className={cn('px-3 py-2 rounded-xl border-2', bacId === bac.id ? 'bg-primary/5 border-primary' : 'bg-white border-gray-100')}
                >
                  <Text className={cn('text-[8px] font-black uppercase tracking-widest', bacId === bac.id ? 'text-primary' : 'text-gray-400')}>{bac.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type d'action</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {availableActionTypes.map((type) => {
                const Icon = type.icon;
                const active = actionType === type.id;
                return (
                  <Pressable key={type.id} onPress={() => handleActionTypeChange(type.id)} className={cn('py-3 px-4 rounded-xl border-2 items-center gap-1 min-w-[70px]', active ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white')}>
                    <Icon size={16} color={active ? '#10B981' : '#9CA3AF'} />
                    <Text className={cn('text-[8px] font-bold uppercase', active ? 'text-primary' : 'text-gray-400')}>{type.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {actionType === 'cooling' && (
            <View className="gap-3 bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl">
              <Text className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Cycle de refroidissement HACCP</Text>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-[9px] font-bold text-gray-500 uppercase">Heure début</Text>
                  <TextInput value={coolStartTime} onChangeText={setCoolStartTime} placeholder="14:00" keyboardType="numbers-and-punctuation" className="bg-white border border-blue-100 p-3 rounded-xl text-xs font-bold" />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-[9px] font-bold text-gray-500 uppercase">Heure fin</Text>
                  <TextInput value={coolEndTime} onChangeText={setCoolEndTime} placeholder="15:45" keyboardType="numbers-and-punctuation" className="bg-white border border-blue-100 p-3 rounded-xl text-xs font-bold" />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-[9px] font-bold text-gray-500 uppercase">T° début (°C)</Text>
                  <TextInput value={coolTempStart} onChangeText={setCoolTempStart} placeholder="63" keyboardType="decimal-pad" className="bg-white border border-blue-100 p-3 rounded-xl text-xs font-bold" />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-[9px] font-bold text-gray-500 uppercase">T° fin (°C)</Text>
                  <TextInput value={coolTempEnd} onChangeText={setCoolTempEnd} placeholder="8" keyboardType="decimal-pad" className="bg-white border border-blue-100 p-3 rounded-xl text-xs font-bold" />
                </View>
              </View>
            </View>
          )}

          <View className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom du produit</Text>
            <View className="relative">
              <TextInput
                value={name} onChangeText={setName} placeholder="Ex: Poulet blanc"
                className="bg-white border border-gray-100 p-4 pl-12 rounded-2xl font-bold text-gray-900"
              />
              <View className="absolute left-4 top-4"><Package size={20} color="#D1D5DB" /></View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => setName(s)} className={cn('px-3 py-1.5 rounded-lg', name === s ? 'bg-primary' : 'bg-gray-100')}>
                  <Text className={cn('text-[10px] font-bold uppercase', name === s ? 'text-white' : 'text-gray-500')}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Photo <Text className="text-gray-300">(optionnel)</Text></Text>
            {photoUrl ? (
              <View className="flex-row items-center gap-4 bg-white border-2 border-gray-100 p-3 rounded-2xl">
                <Image source={{ uri: photoUrl }} className="w-16 h-16 rounded-xl" />
                <View className="flex-1">
                  <Text className="text-xs font-black text-gray-900 uppercase">Photo ajoutée</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Enregistrée avec l'étiquette</Text>
                </View>
                <Pressable onPress={() => { setPhotoUrl(undefined); setPhotoError(null); }} className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center">
                  <Trash2 size={18} color="#EF4444" />
                </Pressable>
              </View>
            ) : photoUploading ? (
              <View className="flex-row items-center justify-center gap-3 bg-white border-2 border-gray-100 p-5 rounded-2xl">
                <ActivityIndicator color="#10B981" />
                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Envoi en cours…</Text>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <Pressable onPress={() => handlePickPhoto('camera')} className="flex-1 flex-row items-center justify-center gap-2 bg-white border-2 border-gray-100 py-4 rounded-2xl">
                  <Camera size={18} color="#10B981" />
                  <Text className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Prendre</Text>
                </Pressable>
                <Pressable onPress={() => handlePickPhoto('library')} className="flex-1 flex-row items-center justify-center gap-2 bg-white border-2 border-gray-100 py-4 rounded-2xl">
                  <ImagePlus size={18} color="#10B981" />
                  <Text className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Choisir</Text>
                </Pressable>
              </View>
            )}
            {photoError && (
              <Text className="text-[9px] font-bold text-red-500 uppercase tracking-widest">{photoError}</Text>
            )}
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1 gap-3">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quantité</Text>
              <TextInput value={quantity} onChangeText={setQuantity} placeholder="0.0" keyboardType="decimal-pad" className="bg-white border border-gray-100 p-4 rounded-2xl font-bold text-gray-900" />
            </View>
            <View className="flex-1 gap-3">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unité</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {UNITS.map((u) => (
                  <Pressable key={u} onPress={() => setUnit(u)} className={cn('px-4 py-4 rounded-2xl border', unit === u ? 'bg-primary border-primary' : 'bg-white border-gray-100')}>
                    <Text className={cn('font-bold text-xs', unit === u ? 'text-white' : 'text-gray-900')}>{u}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DLC</Text>
            <View className="flex-row gap-2">
              {[0, 1, 2].map((days) => {
                const date = addDays(startOfDay(new Date()), days);
                const isActive = startOfDay(new Date(dlc)).getTime() === date.getTime();
                return (
                  <Pressable key={days} onPress={() => setDlc(date.getTime())} className={cn('flex-1 py-3 rounded-xl border-2 items-center', isActive ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white')}>
                    <Text className={cn('text-[10px] font-black uppercase', isActive ? 'text-primary' : 'text-gray-400')}>{days === 0 ? 'Auj.' : `+${days}j`}</Text>
                    <Text className={cn('text-[8px] font-bold', isActive ? 'text-primary' : 'text-gray-400')}>{date.getDate()}/{date.getMonth() + 1}</Text>
                  </Pressable>
                );
              })}
              {(() => {
                const today = startOfDay(new Date()).getTime();
                const dlcDay = startOfDay(new Date(dlc)).getTime();
                const offset = Math.round((dlcDay - today) / 86400000);
                const isCustom = offset < 0 || offset > 2;
                const date = new Date(dlc);
                return (
                  <Pressable
                    onPress={() => { setCalMonth(startOfMonth(date)); setShowCalendar(true); }}
                    className={cn('flex-1 py-3 rounded-xl border-2 items-center', isCustom ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white')}
                  >
                    <Calendar size={14} color={isCustom ? '#10B981' : '#9CA3AF'} />
                    <Text className={cn('text-[8px] font-bold mt-0.5', isCustom ? 'text-primary' : 'text-gray-400')}>
                      {isCustom ? `${date.getDate()}/${date.getMonth() + 1}` : 'Autre'}
                    </Text>
                  </Pressable>
                );
              })()}
            </View>
          </View>

          {!user?.settings?.simplifiedMode && (
            <View className="gap-4 pt-4 border-t border-gray-50">
              <Text className="text-[10px] font-black text-primary uppercase tracking-widest">Détails HACCP</Text>
              <View className="gap-2">
                <Text className="text-[9px] font-bold text-gray-400 uppercase">Temp.</Text>
                <TextInput value={temperature} onChangeText={setTemperature} placeholder="3.5" keyboardType="decimal-pad" className="bg-gray-50 p-3 rounded-xl text-xs font-bold" />
              </View>
              <View className="gap-2">
                <Text className="text-[9px] font-bold text-gray-400 uppercase">Origine</Text>
                <TextInput value={origin} onChangeText={setOrigin} placeholder="Metro, Boucher..." className="bg-gray-50 p-3 rounded-xl text-xs font-bold" />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="p-6 bg-white border-t border-gray-100 gap-2">
        {coolingErrors.length > 0 && (
          <View className="gap-1 bg-red-50 border border-red-200 rounded-xl p-3 mb-1">
            {coolingErrors.map((err, i) => (
              <Text key={i} className="text-[10px] font-bold text-red-700">{err}</Text>
            ))}
          </View>
        )}
        {!isValid && (
          <Text className="text-[9px] font-bold text-amber-500 uppercase tracking-widest text-center">
            {missingFields.join(' • ')} requis
          </Text>
        )}
        <View className="flex-row gap-4">
          <Pressable onPress={() => router.back()} className="flex-1 bg-gray-50 py-4 rounded-2xl">
            <Text className="text-gray-400 font-bold uppercase text-xs text-center">Annuler</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid}
            className={cn('flex-[2] py-4 rounded-2xl flex-row items-center justify-center gap-2', isValid ? 'bg-primary' : 'bg-gray-200')}
          >
            <Check size={20} color={isValid ? '#fff' : '#9CA3AF'} />
            <Text className={cn('font-bold', isValid ? 'text-white' : 'text-gray-400')}>{editMode ? 'ENREGISTRER' : 'AJOUTER'}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={!!duplicateId} transparent animationType="fade" onRequestClose={() => setDuplicateId(null)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-8 gap-6" style={{ maxWidth: 400 }}>
            <View className="items-center gap-2">
              <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-2">
                <Check size={28} color="#F59E0B" />
              </View>
              <Text className="text-xl font-black uppercase text-gray-900 text-center">Étiquette existe déjà</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                Un produit "{name}" actif est déjà sur ce support
              </Text>
            </View>
            <View className="gap-3">
              <Pressable
                onPress={() => {
                  const pid = duplicateId;
                  setDuplicateId(null);
                  if (pid) router.replace({ pathname: '/add-product', params: { productId: pid, editMode: 'true' } });
                }}
                className="bg-primary py-4 rounded-2xl"
              >
                <Text className="text-white font-black uppercase text-xs text-center">Voir l'étiquette</Text>
              </Pressable>
              <Pressable onPress={() => setDuplicateId(null)} className="bg-gray-50 py-4 rounded-2xl">
                <Text className="text-gray-400 font-black uppercase text-xs text-center">Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View className="flex-1 bg-primary items-center justify-center p-8">
          <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center mb-6">
            <Check size={48} color="#fff" />
          </View>
          <Text className="text-3xl font-black uppercase text-white text-center mb-2">Étiquette Créée !</Text>
          <Text className="text-white/70 text-sm font-bold uppercase tracking-widest">Enregistré</Text>
        </View>
      </Modal>

      <Modal visible={isSelectingBac} transparent animationType="slide" onRequestClose={() => setIsSelectingBac(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-8 gap-6" style={{ maxHeight: '90%' }}>
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-xl font-black uppercase text-gray-900">Emplacement</Text>
                <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Où placer ?</Text>
              </View>
              <Pressable onPress={() => setIsSelectingBac(false)} className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
                <X size={20} color="#9CA3AF" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {!selectionPath.zoneId && zones.map((zone) => (
                <Pressable key={zone.id} onPress={() => setSelectionPath({ zoneId: zone.id })} className="bg-gray-50 p-4 rounded-2xl flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <Text className="text-sm font-black text-gray-900 uppercase">{zone.name}</Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              ))}

              {selectionPath.zoneId && !selectionPath.unitId && storageUnits.filter((u) => u.zoneId === selectionPath.zoneId).map((u) => (
                <Pressable key={u.id} onPress={() => setSelectionPath({ ...selectionPath, unitId: u.id })} className="bg-gray-50 p-4 rounded-2xl flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <Text className="text-sm font-black text-gray-900 uppercase">{u.name}</Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              ))}

              {selectionPath.unitId && !selectionPath.shelfId && shelves.filter((s) => s.unitId === selectionPath.unitId).map((s) => (
                <Pressable key={s.id} onPress={() => setSelectionPath({ ...selectionPath, shelfId: s.id })} className="bg-gray-50 p-4 rounded-2xl flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                      <Text className="text-primary font-black text-xs">{s.level}</Text>
                    </View>
                    <Text className="text-sm font-black text-gray-900 uppercase">{s.name}</Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              ))}

              {selectionPath.shelfId && bacs.filter((b) => b.shelfId === selectionPath.shelfId).map((bac) => (
                <Pressable
                  key={bac.id}
                  onPress={() => { setBacId(bac.id); setIsSelectingBac(false); setSelectionPath({}); }}
                  className={cn('p-4 rounded-2xl flex-row items-center justify-between border-2', bacId === bac.id ? 'bg-primary/5 border-primary' : 'bg-gray-50 border-transparent')}
                >
                  <View className="flex-row items-center gap-4">
                    <Text className={cn('text-sm font-black uppercase', bacId === bac.id ? 'text-primary' : 'text-gray-900')}>{bac.name}</Text>
                  </View>
                  {bacId === bac.id && <Check size={16} color="#10B981" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-6 gap-4" style={{ maxWidth: 380 }}>
            <View className="flex-row items-center justify-between">
              <Pressable
                disabled={calMonth.getTime() <= startOfMonth(new Date()).getTime()}
                onPress={() => setCalMonth((m) => addMonths(m, -1))}
                className={cn('w-10 h-10 rounded-xl items-center justify-center', calMonth.getTime() <= startOfMonth(new Date()).getTime() ? 'bg-gray-50 opacity-40' : 'bg-gray-50')}
              >
                <ChevronLeft size={18} color="#374151" />
              </Pressable>
              <Text className="text-sm font-black text-gray-900 uppercase">
                {format(calMonth, 'MMMM yyyy', { locale: fr })}
              </Text>
              <Pressable onPress={() => setCalMonth((m) => addMonths(m, 1))} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                <ChevronRight size={18} color="#374151" />
              </Pressable>
            </View>

            <View className="flex-row">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <View key={i} className="flex-1 items-center py-2">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase">{d}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap">
              {(() => {
                const first = startOfMonth(calMonth);
                const last = endOfMonth(calMonth);
                const leadingBlanks = (getDay(first) + 6) % 7; // Monday-first
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < leadingBlanks; i++) cells.push(<View key={`b${i}`} style={{ width: '14.2857%' }} className="aspect-square" />);
                const todayTs = startOfDay(new Date()).getTime();
                for (let d = 1; d <= last.getDate(); d++) {
                  const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
                  const ts = date.getTime();
                  const isPast = ts < todayTs;
                  const isActive = startOfDay(new Date(dlc)).getTime() === ts;
                  const isToday = todayTs === ts;
                  cells.push(
                    <View key={d} style={{ width: '14.2857%' }} className="aspect-square p-0.5">
                      <Pressable
                        disabled={isPast}
                        onPress={() => { setDlc(ts); setShowCalendar(false); }}
                        className={cn('flex-1 items-center justify-center rounded-xl', isActive ? 'bg-primary' : isToday ? 'bg-primary/10' : 'bg-transparent')}
                      >
                        <Text className={cn('text-xs font-bold', isActive ? 'text-white' : isToday ? 'text-primary' : isPast ? 'text-gray-200' : 'text-gray-700')}>{d}</Text>
                      </Pressable>
                    </View>
                  );
                }
                return cells;
              })()}
            </View>

            <Pressable onPress={() => setShowCalendar(false)} className="py-3 bg-gray-50 rounded-2xl">
              <Text className="text-gray-400 font-black uppercase text-xs text-center">Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
