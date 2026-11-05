// Verrou de lecture seule, partagé entre le store et l'abonnement.
//
// Module à part, sans dépendance, pour que store.ts puisse le lire sans
// importer Firebase (et rester testable sous Jest) : c'est access.ts qui
// pose le verrou, store.ts et sync.ts qui le lisent.

let locked = false;
let onBlocked: ((action: string) => void) | null = null;
const listeners = new Set<(locked: boolean) => void>();

export function isWriteLocked(): boolean {
  return locked;
}

export function setWriteLocked(next: boolean): void {
  if (locked === next) return;
  locked = next;
  for (const l of listeners) l(next);
}

export function onWriteLockChange(listener: (locked: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Appelé quand une action de l'utilisateur est refusée — ouvre l'écran
// d'abonnement. Branché par l'app ; absent sous Jest.
export function setOnWriteBlocked(handler: ((action: string) => void) | null): void {
  onBlocked = handler;
}

export function notifyWriteBlocked(action: string): void {
  onBlocked?.(action);
}
