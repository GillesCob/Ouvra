// Historique de demonstration du Quantitatif : deux rapports complets, amorces une seule fois.
import test from "node:test";
import assert from "node:assert/strict";
import { rapportsDemo, amorcerHistoriqueDemo, CLE_DRAPEAU_DEMO } from "../src/quantitatifHistoriqueDemo.js";
import { creerHistorique } from "../src/quantitatifHistorique.js";
import { tableauDe } from "../src/quantitatifRapport.js";
import { statutRapport, empreinteDepuisEntetes } from "../src/quantitatifVersions.js";

const maintenant = new Date("2026-10-29T12:00:00");
const versions = [
  { id: "hosp-arch", label: "Architecture", url: "/a.xkt", empreinte: "etag:a" },
  { id: "hosp-mep", label: "Mechanical (CVC)", url: "/m.xkt", empreinte: "etag:m" }
];
const memoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const depotMemoire = () => { let l = []; return { lire: () => l, ecrire: (e) => { l = e; return true; } }; };

test("rapportsDemo : deux rapports complets, intitule, date, tableau fourni, maquettes avec empreinte", () => {
  const r = rapportsDemo({ maintenant });
  assert.equal(r.length, 2);
  assert.notEqual(r[0].id, r[1].id);
  for (const rapport of r) {
    assert.ok(rapport.phrase && rapport.relecture);
    assert.ok(new Date(rapport.calculeLe) < maintenant);
    const t = tableauDe(rapport);
    assert.ok(t.lignes.length >= 12, "tableau fourni : " + t.lignes.length);
    assert.ok(t.total.quantite > 0);
  }
});

const etats = (rapports, actuelles) => rapports.map((x) => statutRapport(x, actuelles).etat);

test("rapportsDemo : statuts deterministes (a jour puis obsolete) avec des empreintes courantes, absentes, ou aucune version (HEAD sans en-tete)", () => {
  const r = rapportsDemo({ maintenant });
  const sansEmpreinte = versions.map((v) => ({ ...v, empreinte: null }));
  const autres = versions.map((v) => ({ ...v, empreinte: "etag:apres-deploiement" }));
  for (const actuelles of [versions, sansEmpreinte, autres, []]) assert.deepEqual(etats(r, actuelles), ["a_jour", "obsolete"]);
  assert.equal(empreinteDepuisEntetes({ get: () => null }), null, "serveur sans ETag ni Last-Modified : aucune empreinte");
});

test("rapportsDemo : identifiants de maquette reels (pas de version inconnue si la liste des versions etait vide a l'amorcage)", () => {
  const ids = rapportsDemo({ maintenant }).map((x) => x.maquettes.map((m) => m.id));
  assert.deepEqual(ids, [["hosp-mep"], ["hosp-arch"]]);
});

test("statutRapport : un rapport reel garde la regle normale (inconnue sans empreinte, obsolete si elle change) ; une demo recalculee aussi", () => {
  const reel = { id: "r1", maquettes: [{ id: "hosp-arch", label: "Architecture", url: "", empreinte: "etag:a" }] };
  assert.equal(statutRapport(reel, [{ id: "hosp-arch", label: "Architecture", empreinte: null }]).etat, "inconnue");
  assert.equal(statutRapport(reel, [{ id: "hosp-arch", label: "Architecture", empreinte: "etag:b" }]).etat, "obsolete");
  assert.equal(statutRapport(reel, versions).etat, "a_jour");
  const recalculee = { ...reel, id: "demo-quantitatif-cvc" };
  assert.equal(statutRapport(recalculee, [{ id: "hosp-arch", label: "Architecture", empreinte: null }]).etat, "inconnue");
  assert.equal(statutRapport({ id: "x", maquettes: [] }, versions).etat, "inconnue");
});

test("amorcerHistoriqueDemo : amorce une fois, puis plus jamais (meme apres suppression)", async () => {
  const stockage = memoire();
  const historique = creerHistorique({ depot: depotMemoire() });
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage, maintenant }), true);
  const liste = await historique.lister();
  assert.equal(liste.length, 2);
  assert.ok(liste[0].creeLe > liste[1].creeLe);
  assert.deepEqual(etats(liste.map((e) => e.rapport), []), ["a_jour", "obsolete"]);
  await historique.vider();
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage, maintenant }), false);
  assert.equal((await historique.lister()).length, 0);
});

test("amorcerHistoriqueDemo : ancien drapeau « 2 » : les demos sont reecrites, le rapport de l'utilisateur est intact", async () => {
  const stockage = memoire();
  stockage.setItem(CLE_DRAPEAU_DEMO, "2");
  const historique = creerHistorique({ depot: depotMemoire() });
  const [demo] = rapportsDemo({ maintenant });
  await historique.ajouter({ ...demo, id: "perso-2", phrase: "Mon calcul" });
  await historique.ajouter({ ...rapportsDemo({ maintenant })[1], maquettes: [{ id: "hosp-arch", label: "Architecture", url: "", empreinte: "etag:a" }] });
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage, maintenant }), true);
  assert.equal((await historique.lister()).length, 3);
  assert.equal((await historique.obtenir("perso-2")).rapport.phrase, "Mon calcul");
  assert.deepEqual(etats((await historique.lister()).map((e) => e.rapport).filter((x) => x.id.startsWith("demo-")), []), ["a_jour", "obsolete"]);
});

test("amorcerHistoriqueDemo : navigateur avec une entree utilisateur et sans demos : les 2 demos s'ajoutent, une seule fois, sans ecraser", async () => {
  const [demo] = rapportsDemo({ maintenant });
  const perso = { ...demo, id: "perso-1", phrase: "Combien de portes au niveau 2", calculeLe: "2026-10-28T09:00:00.000Z" };
  const historique = creerHistorique({ depot: depotMemoire() });
  await historique.ajouter(perso);
  const stockage = memoire();
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage, maintenant }), true);
  assert.equal((await historique.lister()).length, 3);
  assert.equal((await historique.obtenir("perso-1")).rapport.phrase, perso.phrase);
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage, maintenant }), false);
  assert.equal((await historique.lister()).length, 3);
});

test("amorcerHistoriqueDemo : ancien drapeau « 1 » sans demos : reamorce une fois ; une demo deja presente n'est pas dupliquee", async () => {
  const stockage = memoire();
  stockage.setItem(CLE_DRAPEAU_DEMO, "1");
  const historique = creerHistorique({ depot: depotMemoire() });
  await historique.ajouter(rapportsDemo({ maintenant })[0]);
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage, maintenant }), true);
  assert.equal((await historique.lister()).length, 2);
});

test("amorcerHistoriqueDemo : ne leve pas sans stockage", async () => {
  const historique = creerHistorique({ depot: depotMemoire() });
  const sans = { getItem() { throw new Error("bloque"); }, setItem() { throw new Error("bloque"); } };
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage: sans, maintenant }), false);
});
