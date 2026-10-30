// Historique de demonstration du Quantitatif : deux rapports complets, amorces une seule fois.
import test from "node:test";
import { canoniqueNiveau } from "../src/commandesLibelles.js";
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

// « Voir » d'une ligne de la demonstration isole les elements du VRAI modele : une ligne dont (type, niveau) n'existe pas dans la maquette donnait
// « Rien à voir dans le Viewer » (29/10, IfcValve / Level 2 : la maquette CVC n'a aucune vanne au niveau 2). Chaque ligne doit viser des elements reels.
test("rapportsDemo : chaque ligne vise des elements qui existent dans la maquette (Voir ne tombe jamais sur « rien a voir »)", async () => {
  const { readFileSync } = await import("node:fs");
  const fichiers = { "hosp-mep": "mechanical.json", "hosp-arch": "architectural.json" };
  const comptes = {};
  for (const [id, f] of Object.entries(fichiers)) {
    const objets = JSON.parse(readFileSync(new URL("../public/models/hospital/legere/" + f, import.meta.url), "utf8")).metaObjects;
    const parId = new Map(objets.map((o) => [o.id, o]));
    const c = {};
    for (const o of objets) {
      let courant = o;
      while (courant && courant.type !== "IfcBuildingStorey") courant = parId.get(courant.parent);
      if (!courant) continue;
      const cle = o.type + "|" + canoniqueNiveau(courant.name); // apres regroupement des niveaux, comme « Voir »
      c[cle] = (c[cle] || 0) + 1;
    }
    comptes[id] = c;
  }
  for (const rapport of rapportsDemo({ maintenant })) {
    const maquetteId = rapport.maquettes[0].id;
    for (const ligne of rapport.resultat.lignes) {
      const { typesIfc, niveaux } = ligne.criteres;
      const reel = comptes[maquetteId][typesIfc[0] + "|" + niveaux[0]] || 0;
      assert.ok(reel > 0, "ligne sans element reel : " + typesIfc[0] + " " + niveaux[0] + " (" + maquetteId + ")");
      assert.equal(ligne.nombre, reel, "nombre different du modele : " + typesIfc[0] + " " + niveaux[0]);
    }
  }
});

// 30/10 : la maquette CVC a aussi des niveaux 6 et 7 ; le rapport de demonstration les porte (comptes apres regroupement), tries apres le niveau 5, totaux coherents.
test("rapportsDemo CVC : lignes Level 6 et Level 7 presentes, triees apres Level 5, total = somme des lignes", () => {
  const [cvc] = rapportsDemo({ maintenant });
  const lignes = cvc.resultat.lignes;
  const attendu = { "IfcDuctFitting|Level 6": 90, "IfcDuctSegment|Level 6": 65, "IfcPipeSegment|Level 6": 715, "IfcValve|Level 6": 163, "IfcDuctSegment|Level 7": 1, "IfcPipeSegment|Level 7": 50, "IfcValve|Level 7": 12 };
  for (const [cle, n] of Object.entries(attendu)) {
    const [type, niveau] = cle.split("|");
    const l = lignes.find((x) => x.criteres.typesIfc[0] === type && x.criteres.niveaux[0] === niveau);
    assert.ok(l, "ligne absente : " + cle);
    assert.equal(l.nombre, n);
  }
  assert.equal(lignes.length, 4 * 7 - 1 /* aucun raccord Level 7 */ - 1 /* aucune vanne Level 2 */ );
  const niveaux = tableauDe(cvc).lignes.map((l) => l[0]); // 1re colonne = niveau
  assert.deepEqual([...new Set(niveaux)], ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7"]);
  assert.equal(tableauDe(cvc).total.quantite, lignes.reduce((s, l) => s + l.nombre, 0));
});
