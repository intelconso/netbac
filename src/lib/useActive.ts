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
  return { ...state, zones, storageUnits, shelves, bacs, products, cleaningTasks, oilChecks };
}
