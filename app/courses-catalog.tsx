import React from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ShoppingCatalogManager from '../src/components/ShoppingCatalogManager';

// Réglage du catalogue de courses. Écran à part plutôt que section des
// Paramètres, parce qu'on y arrive des DEUX côtés : depuis les Paramètres comme
// les autres catalogues, et depuis l'écran Courses quand il manque un produit
// — auquel cas revenir doit ramener à la liste qu'on était en train de remplir.
export default function CoursesCatalogScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
              <ArrowLeft size={20} color="#9CA3AF" />
            </Pressable>
            <View>
              <Text className="text-sm font-black text-gray-900 uppercase">Catalogue de courses</Text>
              <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
                Fournisseurs & produits
              </Text>
            </View>
          </View>
          <ShoppingCatalogManager />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
