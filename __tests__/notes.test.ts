// Les notes d'équipe.
//
// La promesse : un mot écrit sur un téléphone apparaît sur les autres, et
// personne n'écrase personne. Deux choses sont donc verrouillées ici — la
// FUSION (un mot par enregistrement, jamais un panneau réécrit en bloc) et la
// PÉREMPTION (masquage calculé d'un côté, octets réellement rendus de l'autre).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';
import {
  NOTE_TTL_DAYS,
  expiredNoteIds,
  lastNoteEmployeeId,
  noteTimeLabel,
  visibleNotes,
} from '../src/lib/notes';
import { Note } from '../src/types';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

const DAY = 86_400_000;
const MIN = 60_000;

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1',
  text: 'Commander du sopalin',
  createdAt: Date.now(),
  authorName: 'Sarah',
  modifiedAt: Date.now(),
  ...over,
});

describe('visibleNotes', () => {
  it('écarte les mots enterrés et ceux dont le papier a jauni', () => {
    const now = Date.now();
    const notes = [
      note({ id: 'vivant', createdAt: now - DAY }),
      note({ id: 'enterre', createdAt: now - DAY, deletedAt: now }),
      note({ id: 'perime', createdAt: now - (NOTE_TTL_DAYS + 1) * DAY }),
    ];
    expect(visibleNotes(notes, now).map((n) => n.id)).toEqual(['vivant']);
  });

  it('trie du plus récent au plus ancien', () => {
    const now = Date.now();
    const notes = [
      note({ id: 'hier', createdAt: now - DAY }),
      note({ id: 'maintenant', createdAt: now }),
      note({ id: 'avant-hier', createdAt: now - 2 * DAY }),
    ];
    expect(visibleNotes(notes, now).map((n) => n.id)).toEqual(['maintenant', 'hier', 'avant-hier']);
  });

  // Corriger une faute ne doit pas catapulter un vieux mot en haut du panneau :
  // le tri est sur `createdAt`, pas sur `modifiedAt`.
  it('ne remonte pas un vieux mot corrigé', () => {
    const now = Date.now();
    const notes = [
      note({ id: 'recent', createdAt: now - MIN, modifiedAt: now - MIN }),
      note({ id: 'vieux-corrige', createdAt: now - 5 * DAY, modifiedAt: now }),
    ];
    expect(visibleNotes(notes, now).map((n) => n.id)).toEqual(['recent', 'vieux-corrige']);
  });

  it('supporte un état d\'avant la fonctionnalité', () => {
    expect(visibleNotes(undefined)).toEqual([]);
    expect(expiredNoteIds(undefined)).toEqual([]);
    expect(lastNoteEmployeeId(undefined)).toBeUndefined();
  });
});

describe('péremption', () => {
  // La frontière est nette : un mot vit tout son TTL, pas une minute de moins.
  it('vit exactement NOTE_TTL_DAYS', () => {
    const now = Date.now();
    const veille = note({ id: 'veille', createdAt: now - NOTE_TTL_DAYS * DAY + MIN });
    const pile = note({ id: 'pile', createdAt: now - NOTE_TTL_DAYS * DAY });

    expect(visibleNotes([veille], now).map((n) => n.id)).toEqual(['veille']);
    expect(expiredNoteIds([veille], now)).toEqual([]);

    expect(visibleNotes([pile], now)).toEqual([]);
    expect(expiredNoteIds([pile], now)).toEqual(['pile']);
  });

  it('ne redésigne pas un mot déjà enterré', () => {
    const now = Date.now();
    const vieux = note({ id: 'vieux', createdAt: now - 90 * DAY, deletedAt: now - 60 * DAY });
    expect(expiredNoteIds([vieux], now)).toEqual([]);
  });
});

describe('noteTimeLabel', () => {
  it('reste grossier, comme sur un vrai panneau', () => {
    const now = new Date('2026-09-04T14:00:00').getTime();
    expect(noteTimeLabel(now - 10_000, now)).toBe("à l'instant");
    expect(noteTimeLabel(now - 5 * MIN, now)).toBe('il y a 5 min');
    expect(noteTimeLabel(now - 3 * 60 * MIN, now)).toBe('il y a 3 h');
  });

  // « hier » doit tomber sur le changement de jour, pas sur 24 h glissantes :
  // un mot laissé à 23 h se lit « hier » le lendemain matin, pas « il y a 9 h ».
  it('bascule sur « hier » au changement de jour', () => {
    const now = new Date('2026-09-04T08:00:00').getTime();
    expect(noteTimeLabel(new Date('2026-09-03T23:00:00').getTime(), now)).toBe('hier');
    expect(noteTimeLabel(new Date('2026-09-04T07:00:00').getTime(), now)).toBe('il y a 1 h');
    expect(noteTimeLabel(new Date('2026-09-01T12:00:00').getTime(), now)).toBe('il y a 3 jours');
  });
});

describe('store', () => {
  it('écrit un mot signé et refuse le vide', () => {
    useStore.getState().addNote({ text: '  Livraison à 9h  ', employeeId: 'e1', authorName: 'Sarah' });
    useStore.getState().addNote({ text: '   ', employeeId: 'e1', authorName: 'Sarah' });

    const notes = useStore.getState().notes;
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ text: 'Livraison à 9h', authorName: 'Sarah', employeeId: 'e1' });
  });

  it('enterre au lieu de retirer', () => {
    useStore.getState().addNote({ text: 'Un mot', authorName: 'Sarah' });
    const id = useStore.getState().notes[0].id;
    useStore.getState().deleteNote(id);

    // La ligne reste — c'est elle qui propagera l'effacement aux autres
    // appareils. La retirer la ferait ressusciter à la fusion suivante.
    expect(useStore.getState().notes).toHaveLength(1);
    expect(useStore.getState().notes[0].deletedAt).toBeGreaterThan(0);
    expect(visibleNotes(useStore.getState().notes)).toEqual([]);
  });

  it('corrige un mot sans lui racheter de la durée de vie', () => {
    useStore.getState().addNote({ text: 'Sopalin', authorName: 'Sarah' });
    const before = useStore.getState().notes[0];
    useStore.getState().updateNote(before.id, { text: 'Sopalin + film' });

    const after = useStore.getState().notes[0];
    expect(after.text).toBe('Sopalin + film');
    expect(after.createdAt).toBe(before.createdAt);
  });
});

describe('purgeExpiredNotes', () => {
  it('jette le texte et pose une tombstone', () => {
    const now = Date.now();
    useStore.setState({
      notes: [
        note({ id: 'vieux', text: 'Un long message oublié', createdAt: now - (NOTE_TTL_DAYS + 2) * DAY }),
        note({ id: 'frais', text: 'Encore utile', createdAt: now - DAY }),
      ],
    });

    expect(useStore.getState().purgeExpiredNotes()).toBe(1);

    const vieux = useStore.getState().notes.find((n) => n.id === 'vieux')!;
    // La tombstone reste (sinon résurrection à la fusion), mais elle ne pèse
    // plus rien : c'est le texte qui mangeait le budget du document.
    expect(vieux.deletedAt).toBeGreaterThan(0);
    expect(vieux.text).toBe('');
    expect(useStore.getState().notes.find((n) => n.id === 'frais')!.text).toBe('Encore utile');
  });

  // L'effet de _layout.tsx rejoue à chaque changement de `notes` : s'il écrivait
  // même quand il n'y a rien à faire, il déclencherait une synchro à chaque
  // ouverture et se rappellerait lui-même sans fin.
  it('ne touche à rien quand il n\'y a rien à enterrer', () => {
    useStore.setState({ notes: [note({ id: 'frais', createdAt: Date.now() })] });
    const before = useStore.getState().notes;

    expect(useStore.getState().purgeExpiredNotes()).toBe(0);
    expect(useStore.getState().notes).toBe(before);
  });
});

describe('fusion entre appareils', () => {
  // LA raison d'être de la forme choisie. Un mot est un enregistrement : deux
  // personnes qui écrivent en même temps gardent chacune le leur. Un panneau
  // stocké en bloc aurait fait gagner le dernier à pousser, et perdre l'autre.
  it('garde les deux mots quand deux téléphones écrivent en même temps', () => {
    const now = Date.now();
    useStore.setState({ notes: [note({ id: 'local', text: 'Mot du téléphone A', createdAt: now })] });

    useStore.getState().applyCloudState({
      notes: [note({ id: 'distant', text: 'Mot du téléphone B', createdAt: now })],
    } as any);

    expect(visibleNotes(useStore.getState().notes).map((n) => n.text).sort())
      .toEqual(['Mot du téléphone A', 'Mot du téléphone B']);
  });

  it('propage un effacement distant, et pas une résurrection locale', () => {
    const now = Date.now();
    useStore.setState({ notes: [note({ id: 'n1', createdAt: now, modifiedAt: now })] });

    useStore.getState().applyCloudState({
      notes: [note({ id: 'n1', createdAt: now, modifiedAt: now + 1000, deletedAt: now + 1000 })],
    } as any);

    expect(visibleNotes(useStore.getState().notes)).toEqual([]);
  });

  it('laisse les notes intactes quand le cloud est d\'avant la fonctionnalité', () => {
    useStore.getState().addNote({ text: 'Un mot', authorName: 'Sarah' });
    useStore.getState().applyCloudState({ products: [] } as any);
    expect(visibleNotes(useStore.getState().notes)).toHaveLength(1);
  });
});

describe('lastNoteEmployeeId', () => {
  it('rend le dernier à avoir écrit', () => {
    const now = Date.now();
    const notes = [
      note({ id: 'a', employeeId: 'e-sarah', createdAt: now - 2 * DAY }),
      note({ id: 'b', employeeId: 'e-karim', createdAt: now - MIN }),
      note({ id: 'c', employeeId: 'e-lea', createdAt: now - DAY }),
    ];
    expect(lastNoteEmployeeId(notes)).toBe('e-karim');
  });

  it('ignore les mots enterrés et non signés', () => {
    const now = Date.now();
    const notes = [
      note({ id: 'a', employeeId: 'e-sarah', createdAt: now - DAY }),
      note({ id: 'b', employeeId: 'e-karim', createdAt: now, deletedAt: now }),
      note({ id: 'c', createdAt: now }),
    ];
    expect(lastNoteEmployeeId(notes)).toBe('e-sarah');
  });
});
