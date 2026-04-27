import React from 'react';
import { View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { LayoutGrid, Bell, FileText, Settings, ShieldCheck, Wifi, WifiOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../src/lib/store';
import { useSession } from '../../src/lib/useSession';

function TabHeader() {
  const isOffline = useStore((s) => s.isOffline);
  const { user: firebaseUser } = useSession();
  const displayName = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Chef';

  return (
    <SafeAreaView edges={['top']} className="bg-white">
      <View className={`h-1 ${isOffline ? 'bg-gray-300' : 'bg-primary'}`} />
      <View className="px-6 py-5 flex-row justify-between items-center bg-white">
        <View className="flex-row items-center gap-3">
          <View className="w-11 h-11 bg-primary rounded-2xl items-center justify-center">
            <ShieldCheck size={24} color="#fff" />
          </View>
          <View>
            <Text className="text-base font-black text-gray-900 tracking-tighter">NETBAC</Text>
            <View className="flex-row items-center gap-1.5 mt-1">
              <View className="w-1 h-1 rounded-full bg-success" />
              <Text className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Live Trace</Text>
            </View>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="items-end">
            <Text className="text-[10px] font-black text-gray-900 uppercase" numberOfLines={1}>{displayName}</Text>
            <Text className="text-[8px] font-bold text-primary uppercase tracking-widest mt-0.5">Admin</Text>
          </View>
          <View className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 items-center justify-center">
            <Text className="text-xs font-black text-gray-500">{displayName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <View className="px-6 py-1.5 bg-gray-50 flex-row justify-end">
        {isOffline ? (
          <View className="flex-row items-center gap-1">
            <WifiOff size={10} color="#9CA3AF" />
            <Text className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Mode Hors-ligne</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <Wifi size={10} color="#10B981" />
            <Text className="text-[8px] font-bold text-primary uppercase tracking-widest">Synchronisé</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <TabHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#10B981',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#F3F4F6',
            height: 72,
            paddingTop: 8,
            paddingBottom: 12,
          },
          tabBarLabelStyle: {
            fontSize: 8,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <LayoutGrid size={20} color={color} />,
          }}
        />
        {/* Hidden until core flow is solid — files preserved on disk */}
        <Tabs.Screen name="alerts" options={{ href: null }} />
        <Tabs.Screen name="export" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
