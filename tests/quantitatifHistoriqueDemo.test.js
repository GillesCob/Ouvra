// Historique de demonstration du Quantitatif : deux rapports complets, amorces une seule fois.
import test from "node:test";
import assert from "node:assert/strict";
import { rapportsDemo, amorcerHistoriqueDemo, CLE_DRAPEAU_DEMO } from "../src/quantitatifHistoriqueDemo.js";
import { creerHistorique } from "../src/quantitatifHistorique.js";
import { tableauDe } from "../src/quantitatifRapport.js";
import { comparerVersions } from "../src/quantitatifVersions.js";

const maintenant = new Date("2026-10-29T12:00:00");
const versions = [
  { id: "hosp-arch", label: "Architecture", url: "/a.xkt", empreinte: "etag:a" },
  { id: "hosp-mep", label: "Mechanical (CVC)", url: "/m.xkt", empreinte: "etag:m" }
];
const memoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const depotMemoire = () => { let l = []; return { lire: () => l, ecrire: (e) => { l = e; return true; } }; };

test("rapportsDemo : deux rapports complets, intitule, date, tableau fourni, maquettes avec empreinte", () => {
  const r = rapportsDemo({ maintenant, versions });
  assert.equal(r.length, 2);
  assert.notEqual(r[0].id, r[1].id);
  for (const rapport of r) {
    assert.ok(rapport.phrase && rapport.relecture);
    assert.ok(new Date(rapport.calculeLe) < maintenant);
    const t = tableauDe(rapport);
    assert.ok(t.lignes.length >= 12, "tableau fourni : " + t.lignes.length);
    assert.ok(t.total.quantite > 0);
    assert.equal(comparerVersions(rapport.maquettes, versions).etat, "a_jour");
  }
});

test("rapportsDemo : sans versions, la version est dite inconnue (jamais « a jour » sans preuve)", () => {
  const [r] = rapportsDemo({ maintenant, versions: [] });
  assert.equal(comparerVersions(r.maquettes, versions).etat, "inconnue");
});

test("amorcerHistoriqueDemo : amorce une fois, puis plus jamais (meme apres suppression)", async () => {
  const stockage = memoire();
  const historique = creerHistorique({ depot: depotMemoire() });
  assert.equal(await amorcerHistoriqueDemo({ historique, versions: async () => versions, stockage, maintenant }), true);
  const liste = await historique.lister();
  assert.equal(liste.length, 2);
  assert.ok(liste[0].creeLe > liste[1].creeLe);
  assert.ok(stockage.getItem(CLE_DRAPEAU_DEMO));
  await historique.vider();
  assert.equal(await amorcerHistoriqueDemo({ historique, versions: async () => versions, stockage, maintenant }), false);
  assert.equal((await historique.lister()).length, 0);
});

test("amorcerHistoriqueDemo : navigateur avec une entree utilisateur et sans demos : les 2 demos s'ajoutent, une seule fois, sans ecraser", async () => {
  const [demo] = rapportsDemo({ maintenant });
  const perso = { ...demo, id: "perso-1", phrase: "Combien de portes au niveau 2", calculeLe: "2026-10-28T09:00:00.000Z" };
  const historique = creerHistorique({ depot: depotMemoire() });
  await historique.ajouter(perso);
  const stockage = memoire();
  assert.equal(await amorcerHistoriqueDemo({ historique, versions: async () => versions, stockage, maintenant }), true);
  assert.equal((await historique.lister()).length, 3);
  assert.equal((await historique.obtenir("perso-1")).rapport.phrase, perso.phrase);
  assert.equal(await amorcerHistoriqueDemo({ historique, versions: async () => versions, stockage, maintenant }), false);
  assert.equal((await historique.lister()).length, 3);
});

test("amorcerHistoriqueDemo : ancien drapeau « 1 » sans demos : reamorce une fois ; une demo deja presente n'est pas dupliquee", async () => {
  const stockage = memoire();
  stockage.setItem(CLE_DRAPEAU_DEMO, "1");
  const historique = creerHistorique({ depot: depotMemoire() });
  await historique.ajouter(rapportsDemo({ maintenant })[0]);
  assert.equal(await amorcerHistoriqueDemo({ historique, versions: async () => versions, stockage, maintenant }), true);
  assert.equal((await historique.lister()).length, 2);
});

test("amorcerHistoriqueDemo : ne leve pas sans stockage", async () => {
  const historique = creerHistorique({ depot: depotMemoire() });
  const sans = { getItem() { throw new Error("bloque"); }, setItem() { throw new Error("bloque"); } };
  assert.equal(await amorcerHistoriqueDemo({ historique, stockage: sans, maintenant }), false);
});
