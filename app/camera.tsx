import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Camera as CameraIcon, RotateCcw, Check } from 'lucide-react-native';
import { useStore } from '../src/lib/store';

export default function CameraScreen() {
  const router = useRouter();
  const { unitId } = useLocalSearchParams<{ unitId?: string }>();
  const { addLog, storageUnits } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const unitName = storageUnits.find((u) => u.id === unitId)?.name;

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#10B981" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center p-8 gap-4">
        <CameraIcon size={48} color="#10B981" />
        <Text className="text-white text-center text-base">Autorisez l'accès à la caméra pour prendre des photos.</Text>
        <Pressable testID="cam-grant" onPress={requestPermission} className="bg-primary px-6 py-3 rounded-2xl">
          <Text className="text-white font-bold">Autoriser</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="px-6 py-3">
          <Text className="text-gray-400 font-bold">Annuler</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) setCapturedUri(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  const savePicture = () => {
    if (!capturedUri) return;
    addLog({
      action: 'temp_check',
      details: unitName ? `Photo capturée pour ${unitName}` : 'Photo capturée',
      entityId: unitId,
    });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <Text className="text-white font-bold uppercase tracking-widest text-xs">
          {unitName ? `Caméra — ${unitName}` : 'Caméra'}
        </Text>
        <Pressable onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} className="p-2">
          <RotateCcw size={20} color="#fff" />
        </Pressable>
      </View>

      <View className="flex-1">
        {capturedUri ? (
          <View className="flex-1 items-center justify-center bg-black gap-6 p-6">
            <Text className="text-white text-center">Photo capturée.</Text>
            <View className="flex-row gap-4">
              <Pressable testID="cam-retake" onPress={() => setCapturedUri(null)} className="bg-gray-800 px-6 py-3 rounded-2xl">
                <Text className="text-white font-bold">Reprendre</Text>
              </Pressable>
              <Pressable testID="cam-save" onPress={savePicture} className="bg-primary px-6 py-3 rounded-2xl flex-row items-center gap-2">
                <Check size={18} color="#fff" />
                <Text className="text-white font-bold">Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
            <View className="absolute bottom-8 left-0 right-0 items-center">
              <Pressable
                testID="cam-shutter"
                onPress={takePicture}
                disabled={busy}
                className="w-20 h-20 rounded-full bg-white items-center justify-center border-4 border-primary"
              >
                {busy ? <ActivityIndicator color="#10B981" /> : <View className="w-16 h-16 rounded-full bg-primary" />}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
