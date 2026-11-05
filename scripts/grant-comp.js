// Accès offert (`comp: true`) pour des comptes existants.
//
// Sans argument : DRY-RUN — liste les comptes et leur état d'abonnement, ne
// touche à rien. `--apply` écrit. `--uid <uid>` limite à un compte.
//
//   node scripts/grant-comp.js                # voir
//   node scripts/grant-comp.js --apply        # offrir l'accès à TOUS les comptes existants
//   node scripts/grant-comp.js --uid X --apply
//
// N'écrit QUE dans `subscriptions/{uid}`, en fusion — `users/{uid}` (les
// données du restaurant) n'est jamais lu ni modifié. Clé admin : le fichier
// netbac-*-firebase-adminsdk-*.json à la racine (non versionné).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const keyFile = fs.readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) { console.error('Clé admin introuvable à la racine du projet.'); process.exit(1); }
initializeApp({ credential: cert(require(path.join(root, keyFile))) });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const uidIdx = args.indexOf('--uid');
const onlyUid = uidIdx >= 0 ? args[uidIdx + 1] : null;

(async () => {
  const users = [];
  let page;
  do {
    page = await getAuth().listUsers(1000, page?.pageToken);
    users.push(...page.users);
  } while (page.pageToken);

  const targets = onlyUid ? users.filter((u) => u.uid === onlyUid) : users;
  if (onlyUid && !targets.length) { console.error(`Aucun compte ${onlyUid}.`); process.exit(1); }

  const db = getFirestore();
  for (const u of targets) {
    const ref = db.collection('subscriptions').doc(u.uid);
    const snap = await ref.get();
    const cur = snap.exists ? snap.data() : null;
    const state = !cur ? 'aucun' : cur.comp ? 'offert' : cur.trialStartedAt ? `essai depuis ${cur.trialStartedAt.toDate().toISOString().slice(0, 10)}` : '?';
    console.log(`${u.uid}  ${(u.email ?? '(sans email)').padEnd(34)}  créé ${u.metadata.creationTime}  abonnement: ${state}`);
    if (apply && !cur?.comp) {
      await ref.set({ comp: true, compGrantedAt: new Date() }, { merge: true });
      console.log('   → comp: true');
    }
  }
  if (!apply) console.log('\nDry-run : rien écrit. Relancer avec --apply pour offrir l’accès.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
