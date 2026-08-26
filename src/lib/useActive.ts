import { useMemo } from 'react';
import { useStore } from './store';

// Drop-in replacement for `useStore()` that filters out soft-deleted items.
// Component code never has to think about tombstones — it just sees the live
// items. Actions are pass-through from the underlying store.
export function useActiveStore() {
  const state = useStore();
  const zones = useMemo(() => state.zones.filter((z) => !z.deletedAt), [state.zones]);
  const storageUnits = useMemo(() => state.storageUnits.filter((u) => !u.deletedAt), [state.storageUnits]);
  const shelves = useMemo(() => state.shelves.filter((s) => !s.deletedAt), [state.shelves]);
  const bacs = useMemo(() => state.bacs.filter((b) => !b.deletedAt), [state.bacs]);
  const products = useMemo(() => state.products.filter((p) => !p.deletedAt), [state.products]);
  const cleaningTasks = useMemo(() => state.cleaningTasks.filter((t) => !t.deletedAt), [state.cleaningTasks]);
  const oilChecks = useMemo(() => state.oilChecks.filter((c) => !c.deletedAt), [state.oilChecks]);
  const fridgeTempChecks = useMemo(() => state.fridgeTempChecks.filter((c) => !c.deletedAt), [state.fridgeTempChecks]);
  const fabrications = useMemo(() => state.fabrications.filter((f) => !f.deletedAt), [state.fabrications]);
  const fabricationTypes = useMemo(() => state.fabricationTypes.filter((t) => !t.deletedAt), [state.fabricationTypes]);
  const cleaningChecks = useMemo(() => state.cleaningChecks.filter((c) => !c.deletedAt), [state.cleaningChecks]);
  const receptions = useMemo(() => state.receptions.filter((r) => !r.deletedAt), [state.receptions]);
  const dailyRemarks = useMemo(() => state.dailyRemarks.filter((r) => !r.deletedAt), [state.dailyRemarks]);
  const witnessSamples = useMemo(() => state.witnessSamples.filter((s) => !s.deletedAt), [state.witnessSamples]);
  const pestControlChecks = useMemo(() => (state.pestControlChecks ?? []).filter((c) => !c.deletedAt), [state.pestControlChecks]);
  const pestStations = useMemo(() => (state.pestStations ?? []).filter((s) => !s.deletedAt), [state.pestStations]);
  const dayOverrides = useMemo(() => (state.dayOverrides ?? []).filter((o) => !o.deletedAt), [state.dayOverrides]);
  const employees = useMemo(() => (state.employees ?? []).filter((e) => !e.deletedAt), [state.employees]);
  const tasks = useMemo(() => (state.tasks ?? []).filter((t) => !t.deletedAt), [state.tasks]);
  const taskCompletions = useMemo(() => (state.taskCompletions ?? []).filter((c) => !c.deletedAt), [state.taskCompletions]);
  // TaskPhoto n'a pas de deletedAt (une preuve ne s'efface pas) : seul le `?? []`
  // est utile ici, pour un état d'avant la fonctionnalité.
  const taskPhotos = useMemo(() => state.taskPhotos ?? [], [state.taskPhotos]);
  const articles = useMemo(() => (state.articles ?? []).filter((a) => !a.deletedAt), [state.articles]);
  const stockMovements = useMemo(() => (state.stockMovements ?? []).filter((m) => !m.deletedAt), [state.stockMovements]);
  const articleCategories = useMemo(() => (state.articleCategories ?? []).filter((c) => !c.deletedAt), [state.articleCategories]);
  return { ...state, zones, storageUnits, shelves, bacs, products, cleaningTasks, oilChecks, fridgeTempChecks, fabrications, fabricationTypes, cleaningChecks, receptions, dailyRemarks, witnessSamples, pestControlChecks, pestStations, dayOverrides, employees, tasks, taskCompletions, taskPhotos, articles, stockMovements, articleCategories };
}
