import { Note } from '../types';

// Notes d'équipe — logique pure (visibilité, péremption, libellés).
//
// Rappel de cadrage : rien ici ne touche au registre HACCP. Un mot n'est pas
// une `DailyRemark` — il ne part dans aucun rapport, ne signe rien, et disparaît
// tout seul. Voir Note dans types.ts.

// ─── Péremption ──────────────────────────────────────────────────────────────
//
// Un mot vit 30 jours. Pas par goût du ménage : TOUT l'état de l'app tient dans
// UN document Firestore, plafonné à 1 Mio, et un panneau où personne ne fait le
// tri grossit sans fin — c'est exactement le point de vigilance déjà noté pour
// les photos de tâches.
//
// La péremption se joue en DEUX temps, et les deux sont nécessaires :
//
//  1. `visibleNotes` la CALCULE à partir de `createdAt`. Pur, donc tous les
//     appareils sont d'accord à la seconde près sans que personne n'écrive
//     quoi que ce soit — un mot périmé cesse de s'afficher même sur un
//     téléphone hors ligne depuis un mois.
//  2. `expiredNoteIds` désigne ceux qu'il faut réellement enterrer pour rendre
//     les octets (voir `purgeExpiredNotes` dans le store). Masquer ne suffit
//     pas : le texte reste dans le document tant qu'on ne l'a pas retiré.
//
// Et l'enterrement passe par une tombstone, jamais par un retrait du tableau :
// sous la fusion par union, une ligne physiquement retirée ressusciterait au
// premier appareil qui la détient encore.
export const NOTE_TTL_DAYS = 30;

const DAY_MS = 86_400_000;

export function noteExpiresAt(note: Note): number {
  return note.createdAt + NOTE_TTL_DAYS * DAY_MS;
}

// Les mots à afficher, du plus récent au plus ancien.
//
// Le tri est sur `createdAt` et non `modifiedAt` : corriger une faute dans un
// mot de la semaine dernière ne doit pas le catapulter en haut du panneau.
export function visibleNotes(notes: Note[] | undefined, now: number = Date.now()): Note[] {
  return (notes ?? [])
    .filter((n) => !n.deletedAt && noteExpiresAt(n) > now)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Les mots dont le papier a jauni — vivants dans les données, invisibles à
// l'écran depuis `visibleNotes`. C'est ce que le store enterre au démarrage.
export function expiredNoteIds(notes: Note[] | undefined, now: number = Date.now()): string[] {
  return (notes ?? [])
    .filter((n) => !n.deletedAt && noteExpiresAt(n) <= now)
    .map((n) => n.id);
}

// Le dernier à avoir écrit — la personne présélectionnée quand on rouvre le
// panneau. Même geste que `lastTaskEmployeeId` : sur un poste partagé, c'est
// presque toujours la même personne deux fois de suite.
export function lastNoteEmployeeId(notes: Note[] | undefined): string | undefined {
  let best: { t: number; id: string } | null = null;
  for (const n of notes ?? []) {
    if (n.deletedAt || !n.employeeId) continue;
    if (!best || n.createdAt > best.t) best = { t: n.createdAt, id: n.employeeId };
  }
  return best?.id;
}

// ─── Papier ──────────────────────────────────────────────────────────────────
//
// UN seul papier, pas de palette. Choisir une couleur à chaque note, c'est une
// décision de plus avant d'écrire — pour un panneau dont tout l'intérêt est
// d'être plus rapide qu'un SMS. Et sans convention d'équipe écrite quelque
// part, le rose ne veut rien dire de plus que le jaune.
export const NOTE_PAPER = { bg: '#FEF9C3', border: '#FDE68A', accent: '#D97706' } as const;

// ─── Libellés ────────────────────────────────────────────────────────────────

// Âge d'un mot, en français et à la louche. Volontairement grossier : sur un
// panneau, « il y a 2 h » suffit, l'heure exacte n'apprend rien et allonge la
// ligne. Calcul à la main plutôt que date-fns — le seuil « hier » doit tomber
// sur le changement de jour, pas sur 24 h glissantes.
export function noteTimeLabel(createdAt: number, now: number = Date.now()): string {
  const diff = now - createdAt;
  if (diff < 60_000) return "à l'instant";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (createdAt >= startOfToday) return `il y a ${Math.floor(minutes / 60)} h`;
  const days = Math.round((startOfToday - new Date(createdAt).setHours(0, 0, 0, 0)) / DAY_MS);
  if (days === 1) return 'hier';
  return `il y a ${days} jours`;
}
