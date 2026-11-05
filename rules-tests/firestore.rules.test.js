// Règles Firestore : qui peut écrire `users/{uid}`, et comment naît l'essai.
//
// C'est ici que se joue la vraie sécurité de l'abonnement — l'app ne fait
// qu'éviter d'envoyer ce que le serveur refuserait. Verrouillé : lecture
// toujours permise au propriétaire (registre HACCP consultable), écriture
// seulement en essai / abonné / offert, et un essai qui ne se crée qu'une
// fois, à la date du serveur, sans pouvoir être rallongé ni effacé.
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch } = require('firebase/firestore');

const DAY = 86_400_000;
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-netbac',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const seedSub = (uid, data) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'subscriptions', uid), data));
const seedDevice = (key, uid) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'trialDevices', key), { uid, createdAt: Timestamp.now() }));
// Ce que fait l'app (access.ts → createSubscription) : essai + téléphone en un lot.
const startTrial = (db, uid, key, { registerDevice = true } = {}) => {
  const b = writeBatch(db);
  if (registerDevice) b.set(doc(db, 'trialDevices', key), { uid, createdAt: serverTimestamp() });
  b.set(doc(db, 'subscriptions', uid), { trialStartedAt: serverTimestamp(), trialDevice: key });
  return b.commit();
};
const as = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const daysAgo = (n) => Timestamp.fromMillis(Date.now() - n * DAY);

describe('users/{uid}', () => {
  it('essai en cours : écriture permise', async () => {
    await seedSub('a', { trialStartedAt: daysAgo(29) });
    await assertSucceeds(setDoc(doc(as('a'), 'users', 'a'), { zones: [] }));
  });

  it('essai terminé : écriture refusée, lecture permise', async () => {
    await seedSub('a', { trialStartedAt: daysAgo(31) });
    await assertFails(setDoc(doc(as('a'), 'users', 'a'), { zones: [] }));
    await assertSucceeds(getDoc(doc(as('a'), 'users', 'a')));
  });

  it('compte offert : écriture permise même sans essai', async () => {
    await seedSub('a', { comp: true });
    await assertSucceeds(setDoc(doc(as('a'), 'users', 'a'), { zones: [] }));
  });

  it('abonné (claim RevenueCat) : écriture permise, même essai terminé ou sans document', async () => {
    await seedSub('a', { trialStartedAt: daysAgo(90) });
    await assertSucceeds(setDoc(doc(as('a', { revenueCatEntitlements: ['pro'] }), 'users', 'a'), { zones: [] }));
    await assertSucceeds(setDoc(doc(as('b', { revenueCatEntitlements: ['pro'] }), 'users', 'b'), { zones: [] }));
  });

  it('supprimer son compte : permis même essai terminé ; celui d’un autre : refusé', async () => {
    await seedSub('a', { trialStartedAt: daysAgo(90) });
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', 'a'), { zones: [] }));
    await assertFails(deleteDoc(doc(as('b'), 'users', 'a')));
    await assertSucceeds(deleteDoc(doc(as('a'), 'users', 'a')));
  });

  it('sans document d’abonnement : écriture refusée', async () => {
    await assertFails(setDoc(doc(as('a'), 'users', 'a'), { zones: [] }));
  });

  it('le compte d’un autre : ni lecture ni écriture, même abonné', async () => {
    await seedSub('b', { comp: true });
    const db = as('a', { revenueCatEntitlements: ['pro'] });
    await assertFails(getDoc(doc(db, 'users', 'b')));
    await assertFails(setDoc(doc(db, 'users', 'b'), { zones: [] }));
  });
});

describe('subscriptions/{uid}', () => {
  it('essai + inscription du téléphone, date du serveur : permis', async () => {
    await assertSucceeds(startTrial(as('a'), 'a', 'a_dev1'));
  });

  it('essai sans inscrire le téléphone : refusé', async () => {
    await assertFails(setDoc(doc(as('a'), 'subscriptions', 'a'), { trialStartedAt: serverTimestamp(), trialDevice: 'a_dev1' }));
    await assertFails(setDoc(doc(as('a'), 'subscriptions', 'a'), { trialStartedAt: serverTimestamp() }));
  });

  it('téléphone déjà inscrit à un autre compte : essai refusé, noTrial permis', async () => {
    await seedDevice('a_dev1', 'a');
    const db = as('b');
    await assertFails(startTrial(db, 'b', 'a_dev1', { registerDevice: false }));
    await assertFails(startTrial(db, 'b', 'a_dev1'));
    await assertSucceeds(setDoc(doc(db, 'subscriptions', 'b'), { noTrial: true }));
  });

  it('téléphone déjà inscrit à CE compte (document d’abonnement perdu) : essai permis', async () => {
    await seedDevice('a_dev1', 'a');
    await assertSucceeds(startTrial(as('a'), 'a', 'a_dev1', { registerDevice: false }));
  });

  it('noTrial ne donne aucun droit d’écriture', async () => {
    await seedSub('b', { noTrial: true });
    await assertFails(setDoc(doc(as('b'), 'users', 'b'), { zones: [] }));
    await assertSucceeds(getDoc(doc(as('b'), 'users', 'b')));
  });

  it('date choisie par le téléphone : refusée', async () => {
    const db = as('a');
    const b = writeBatch(db);
    b.set(doc(db, 'trialDevices', 'a_dev1'), { uid: 'a', createdAt: serverTimestamp() });
    b.set(doc(db, 'subscriptions', 'a'), { trialStartedAt: Timestamp.fromMillis(Date.now() + 365 * DAY), trialDevice: 'a_dev1' });
    await assertFails(b.commit());
  });

  it('se donner `comp` : refusé', async () => {
    await assertFails(setDoc(doc(as('a'), 'subscriptions', 'a'), { noTrial: true, comp: true }));
  });

  it('relancer, modifier ou effacer un essai existant : refusé', async () => {
    await seedSub('a', { trialStartedAt: daysAgo(40) });
    const db = as('a');
    await assertFails(setDoc(doc(db, 'subscriptions', 'a'), { trialStartedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'subscriptions', 'a'), { comp: true }));
    await assertFails(deleteDoc(doc(db, 'subscriptions', 'a')));
  });

  it('lecture : le propriétaire seulement', async () => {
    await seedSub('a', { comp: true });
    await assertSucceeds(getDoc(doc(as('a'), 'subscriptions', 'a')));
    await assertFails(getDoc(doc(as('b'), 'subscriptions', 'a')));
  });
});

describe('trialDevices/{key}', () => {
  it('inscrire un téléphone hors de la création d’un essai : refusé', async () => {
    await assertFails(setDoc(doc(as('a'), 'trialDevices', 'a_dev1'), { uid: 'a', createdAt: serverTimestamp() }));
  });

  it('inscrire un téléphone au nom d’un autre compte : refusé', async () => {
    const db = as('a');
    const b = writeBatch(db);
    b.set(doc(db, 'trialDevices', 'a_dev1'), { uid: 'b', createdAt: serverTimestamp() });
    b.set(doc(db, 'subscriptions', 'a'), { trialStartedAt: serverTimestamp(), trialDevice: 'a_dev1' });
    await assertFails(b.commit());
  });

  it('compte qui a déjà son abonnement : ne peut plus inscrire de téléphone', async () => {
    await seedSub('a', { noTrial: true });
    await assertFails(setDoc(doc(as('a'), 'trialDevices', 'a_dev2'), { uid: 'a', createdAt: serverTimestamp() }));
  });

  it('libérer ou réattribuer un téléphone : refusé', async () => {
    await seedDevice('a_dev1', 'a');
    const db = as('a');
    await assertFails(updateDoc(doc(db, 'trialDevices', 'a_dev1'), { uid: 'b' }));
    await assertFails(deleteDoc(doc(db, 'trialDevices', 'a_dev1')));
  });

  it('lecture d’un document : tout compte connecté ; non connecté : refusé', async () => {
    await seedDevice('a_dev1', 'a');
    await assertSucceeds(getDoc(doc(as('b'), 'trialDevices', 'a_dev1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'trialDevices', 'a_dev1')));
  });
});
