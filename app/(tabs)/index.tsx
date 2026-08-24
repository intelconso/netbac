import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, AlertTriangle, ClipboardCheck, FileText, Eye, ListChecks, Boxes } from 'lucide-react-native';
import { useActiveStore } from '../../src/lib/useActive';
import { cn, getDaysRemaining } from '../../src/lib/utils';
import { resolveTempUnits } from '../../src/lib/tempUnits';
import { dayStatus, startOfDayMs } from '../../src/lib/serviceDays';
import { pendingTaskCount } from '../../src/lib/tasks';
import { lowStockArticles } from '../../src/lib/inventory';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Palette des tuiles du tableau de bord. Une tuile "urgente" est pleine et
// colorée (blanc sur fond), une tuile au repos est blanche et bordée — donc
// une carte qui passe de "à faire" à "fait" change de tonalité sans changer
// de place ni de taille : la grille ne bouge jamais.
type Tone = 'primary' | 'alert' | 'danger' | 'ok' | 'blue' | 'neutral';

const TONES: Record<Tone, {
  bg: string; bordered?: boolean; title: string; sub: string; iconBg: string; icon: string; count: string;
}> = {
  primary: { bg: '#10B981', title: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', iconBg: 'rgba(255,255,255,0.2)', icon: '#FFFFFF', count: 'rgba(255,255,255,0.35)' },
  alert:   { bg: '#F59E0B', title: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', iconBg: 'rgba(255,255,255,0.2)', icon: '#FFFFFF', count: 'rgba(255,255,255,0.35)' },
  danger:  { bg: '#EF4444', title: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', iconBg: 'rgba(255,255,255,0.2)', icon: '#FFFFFF', count: 'rgba(255,255,255,0.35)' },
  ok:      { bg: '#FFFFFF', bordered: true, title: '#111827', sub: '#10B981', iconBg: 'rgba(16,185,129,0.1)', icon: '#10B981', count: '#E5E7EB' },
  blue:    { bg: '#FFFFFF', bordered: true, title: '#111827', sub: '#9CA3AF', iconBg: '#EFF6FF', icon: '#3B82F6', count: '#E5E7EB' },
  neutral: { bg: '#FFFFFF', bordered: true, title: '#111827', sub: '#9CA3AF', iconBg: '#F3F4F6', icon: '#9CA3AF', count: '#E5E7EB' },
};

interface TileProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  tone: Tone;
  count?: number;
  onPress: () => void;
}

function Tile({ icon: Icon, title, subtitle, tone, count, onPress }: TileProps) {
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      className={cn('flex-1 w-full rounded-3xl p-4 gap-3', t.bordered && 'border border-gray-100')}
      style={{ backgroundColor: t.bg, minHeight: 112 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: t.iconBg }}>
          <Icon size={22} color={t.icon} />
        </View>
        {!!count && <Text className="text-2xl font-black" style={{ color: t.count }}>{count}</Text>}
      </View>
      <View className="gap-0.5">
        <Text className="text-xs font-black uppercase tracking-widest" style={{ color: t.title }} numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[9px] font-bold uppercase tracking-widest" style={{ color: t.sub }} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    products, user, oilChecks, fridgeTempChecks, cleaningChecks, cleaningAreas,
    storageUnits, tempUnits, closedWeekdays, singleServiceWeekdays, dayOverrides,
    tasks, taskCompletions, articles, stockMovements,
  } = useActiveStore();

  const activeProducts = useMemo(() => products.filter((p) => p.status === 'active'), [products]);

  // Expirés (days < 0) + dernier jour de consommation (days === 0). Compte réel,
  // non plafonné — cohérent avec le seuil "périmé" de getStatusColor / alerts.
  const expiringSoon = useMemo(
    () => activeProducts.filter((p) => getDaysRemaining(p.dlc) <= 0),
    [activeProducts]
  );

  const todayCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return activeProducts.filter((p) => p.addedAt >= startOfToday.getTime()).length;
  }, [activeProducts]);

  const schedule = { closedWeekdays, singleServiceWeekdays, dayOverrides };

  // Daily mandatory controls still to do (oils, fridge temps, cleaning) —
  // drives the Traçabilité tile.
  const pendingControls = useMemo(() => {
    const t0 = startOfDayMs(Date.now());
    const status = dayStatus(t0, schedule);
    // Jour fermé : aucun contrôle n'est attendu aujourd'hui.
    if (status === 'closed') return 0;
    let pending = 0;
    if (!oilChecks.some((c) => c.timestamp >= t0)) pending += 1;
    const coldUnits = resolveTempUnits({ tempUnits, storageUnits });
    const tempToday = fridgeTempChecks.filter((c) => c.timestamp >= t0);
    // Service unique : un relevé par enceinte suffit ; sinon début + fin.
    const tempComplete = coldUnits.length > 0 && (status === 'single'
      ? coldUnits.every((u) => tempToday.some((c) => c.unitId === u.id))
      : (['debut', 'fin'] as const).every((svc) =>
          coldUnits.every((u) => tempToday.some((c) => c.unitId === u.id && c.service === svc))
        ));
    if (coldUnits.length > 0 && !tempComplete) pending += 1;
    const cleaningComplete = cleaningAreas.length > 0 && cleaningAreas.every((a) =>
      cleaningChecks.some((c) => c.area === a && c.timestamp >= t0)
    );
    if (cleaningAreas.length > 0 && !cleaningComplete) pending += 1;
    return pending;
  }, [oilChecks, fridgeTempChecks, cleaningChecks, cleaningAreas, storageUnits, tempUnits, closedWeekdays, singleServiceWeekdays, dayOverrides]);

  // Checklist d'équipe — même logique de jour fermé, portée par tasks.ts.
  const pendingTasks = useMemo(
    () => pendingTaskCount(startOfDayMs(Date.now()), tasks, taskCompletions, schedule),
    [tasks, taskCompletions, closedWeekdays, singleServiceWeekdays, dayOverrides]
  );
  const hasTasks = tasks.length > 0;

  // Articles dont le stock a atteint le seuil réglé — le compte de la tuile
  // Stock. Sans seuil réglé, un article n'alerte jamais (voir inventory.ts).
  const lowStock = useMemo(() => lowStockArticles(articles, stockMovements), [articles, stockMovements]);

  const firstName = (user?.name || '').split(' ')[0];
  const today = format(new Date(), 'EEEE d MMMM', { locale: fr });

  // Gyrophare : les tuiles Traçabilité et Tâches "respirent" tant qu'il reste
  // quelque chose à faire, et se figent une fois la journée en règle. Une seule
  // boucle partagée — seules les tuiles concernées s'y accrochent.
  const pulse = useRef(new Animated.Value(1)).current;
  const anyPending = pendingControls > 0 || pendingTasks > 0;
  useEffect(() => {
    if (!anyPending) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anyPending, pulse]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 96, gap: 14 }}>
      {/* Header */}
      <View className="gap-1">
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{today}</Text>
        <Text className="text-2xl font-black text-gray-900">
          {firstName ? `Bonjour, ${firstName}` : 'Tableau de bord'}
        </Text>
      </View>

      {/* Raccourcis — grille 2 × 3 */}
      <View className="flex-row gap-4">
        <View className="flex-1">
          <Tile
            icon={AlertTriangle}
            title="À surveiller"
            subtitle={expiringSoon.length > 0
              ? `${expiringSoon.length} ${expiringSoon.length > 1 ? 'étiquettes critiques' : 'étiquette critique'}`
              : 'Rien à signaler'}
            tone={expiringSoon.length > 0 ? 'danger' : 'neutral'}
            count={expiringSoon.length}
            onPress={() => router.push('/(tabs)/alerts' as any)}
          />
        </View>
        <Animated.View style={{ flex: 1, opacity: pendingControls > 0 ? pulse : 1 }}>
          <Tile
            icon={ClipboardCheck}
            title="Traçabilité"
            subtitle={pendingControls > 0
              ? `${pendingControls} contrôle${pendingControls > 1 ? 's' : ''} du jour`
              : 'Contrôles effectués'}
            tone={pendingControls > 0 ? 'alert' : 'ok'}
            count={pendingControls}
            onPress={() => router.push('/(tabs)/tracabilite' as any)}
          />
        </Animated.View>
      </View>

      <View className="flex-row gap-4">
        <Animated.View style={{ flex: 1, opacity: pendingTasks > 0 ? pulse : 1 }}>
          <Tile
            icon={ListChecks}
            title="Tâches"
            subtitle={pendingTasks > 0
              ? `${pendingTasks} tâche${pendingTasks > 1 ? 's' : ''} à faire`
              : hasTasks ? 'Tout est fait' : "Checklist de l'équipe"}
            tone={pendingTasks > 0 ? 'alert' : hasTasks ? 'ok' : 'neutral'}
            count={pendingTasks}
            onPress={() => router.push('/tasks' as any)}
          />
        </Animated.View>
        <View className="flex-1">
          <Tile
            icon={Plus}
            title="Étiquetage"
            subtitle="Traçabilité instantanée"
            tone="primary"
            onPress={() => router.push('/express-add')}
          />
        </View>
      </View>

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Tile
            icon={Eye}
            title="Vue spatiale"
            subtitle="Zones & contenants"
            tone="blue"
            onPress={() => router.push('/spatial' as any)}
          />
        </View>
        <View className="flex-1">
          <Tile
            icon={FileText}
            title="Rapports"
            subtitle="PDF HACCP"
            tone="ok"
            onPress={() => router.push('/reports' as any)}
          />
        </View>
      </View>

      {/* Inventaire — pleine largeur pour ne pas déranger la grille 2 × 3
          au-dessus, dont l'intérêt est justement de ne jamais bouger. */}
      <View>
        <Tile
          icon={Boxes}
          title="Inventaire"
          subtitle={articles.length === 0
            ? 'Suivi des articles'
            : lowStock.length > 0
              ? `${lowStock.length} article${lowStock.length > 1 ? 's' : ''} sous le seuil`
              : `${articles.length} article${articles.length > 1 ? 's' : ''} suivi${articles.length > 1 ? 's' : ''}`}
          tone={lowStock.length > 0 ? 'alert' : articles.length > 0 ? 'ok' : 'neutral'}
          count={lowStock.length}
          onPress={() => router.push('/inventory' as any)}
        />
      </View>

      {/* Stats */}
      <View className="flex-row gap-4 mt-2">
        <Pressable
          onPress={() => router.push('/(tabs)/labels' as any)}
          className="flex-1 bg-white rounded-3xl border border-gray-100 p-5 items-center gap-1 active:bg-gray-50"
        >
          <Text className="text-3xl font-black text-gray-900">{activeProducts.length}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest" numberOfLines={1}>Actives</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/(tabs)/labels' as any, params: { filter: 'today' } })}
          className="flex-1 bg-white rounded-3xl border border-gray-100 p-5 items-center gap-1 active:bg-gray-50"
        >
          <Text className="text-3xl font-black text-primary">{todayCount}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Aujourd'hui</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
