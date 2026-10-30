// Tests du rapport (modele neutre), des empreintes de version, de l'obsolescence et de l'historique.
import test from "node:test";
import assert from "node:assert/strict";
import { calculer } from "../src/quantitatif.js";
import { construireRapport, tableauDe, informationsDe, resumeRapport } from "../src/quantitatifRapport.js";
import { empreinteDepuisEntetes, lireEmpreinte, lireEmpreintes, comparerVersions, libelleStatut } from "../src/quantitatifVersions.js";
import { creerHistorique, creerDepotLocal, HISTORIQUE_MAX_ENTREES } from "../src/quantitatifHistorique.js";
import { elementsDepuisScene } from "../src/quantitatifDonnees.js";

const el = (id, typeIfc, niveau, maquette, nom, boite = null) => ({ id, nom, famille: nom, typeIfc, niveau, maquette, maquetteId: maquette, boite, quantites: null });
const ELEMENTS = [el("a", "IfcDoor", "Level 1", "Architecture", "Porte"), el("b", "IfcDoor", "Level 2", "Architecture", "Porte"), el("c", "IfcDuctSegment", "Level 1", "Mechanical (CVC)", "Gaine", [0, 0, 0, 4, 1, 1])];
const filtres = (f = {}) => ({ typesIfc: [], niveaux: [], maquettes: [], noms: [], ...f });
const VERSIONS = [{ id: "arch", label: "Architecture", url: "/a.xkt", empreinte: "etag:A1" }, { id: "mep", label: "Mechanical (CVC)", url: "/m.xkt", empreinte: "etag:M1" }, { id: "str", label: "Structure", url: "/s.xkt", empreinte: "etag:S1" }];
const rapportPortes = (extra = {}) => construireRapport({ resultat: calculer(ELEMENTS, { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDoor"] }), regroupements: ["niveau"] }), phrase: "Combien de portes par niveau", versions: VERSIONS, calculeLe: new Date("2026-10-24T10:00:00Z"), ...extra });

// ---------- Rapport ----------
test("rapport : maquettes concernees = celles qui fournissent un element, empreintes enregistrees", () => {
  const r = rapportPortes();
  assert.deepEqual(r.maquettes.map((m) => m.label), ["Architecture"]);
  assert.equal(r.maquettes[0].empreinte, "etag:A1");
  assert.equal(r.relecture, "Compter les portes, par niveau.");
  assert.equal(r.calculeLe, "2026-10-24T10:00:00.000Z");
  assert.ok(r.id);
});

test("rapport : sans resultat, maquettes du filtre ; sans filtre, toutes ; maquette inconnue des versions = empreinte absente", () => {
  const vide = calculer(ELEMENTS, { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcWindow"], maquettes: ["Structure"] }), regroupements: [] });
  assert.deepEqual(construireRapport({ resultat: vide, phrase: "x", versions: VERSIONS }).maquettes.map((m) => m.label), ["Structure"]);
  const sansFiltre = calculer(ELEMENTS, { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcWindow"] }), regroupements: [] });
  assert.equal(construireRapport({ resultat: sansFiltre, phrase: "x", versions: VERSIONS }).maquettes.length, 2);
  const sansVersion = construireRapport({ resultat: calculer(ELEMENTS, { mesure: "nombre", filtres: filtres(), regroupements: [] }), phrase: "x", versions: [] });
  assert.ok(sansVersion.maquettes.every((m) => m.empreinte === null));
});

test("rapport : resultat invalide refuse", () => {
  assert.throws(() => construireRapport({ resultat: { ok: false }, phrase: "x" }), /résultat calculé/);
});

test("tableau : colonnes de metre (designation, unite, quantite, origine), un enregistrement par ligne, total separe", () => {
  const t = tableauDe(rapportPortes());
  assert.deepEqual(t.colonnes.map((c) => c.libelle), ["Niveau", "Unité", "Quantité (nombre)", "Origine"]);
  assert.deepEqual(t.lignes, [["Level 1", "u", 1, "compté"], ["Level 2", "u", 1, "compté"]]);
  assert.equal(t.total.quantite, 2);
  assert.match(t.metre.explication, /nombre exact/);
});

test("tableau : estime = unite explicite et avertissement de chiffrage ; sans regroupement une colonne Designation", () => {
  const r = construireRapport({ resultat: calculer(ELEMENTS, { mesure: "longueur_estimee", filtres: filtres({ typesIfc: ["IfcDuctSegment"] }), regroupements: [] }), phrase: "x", versions: VERSIONS });
  const t = tableauDe(r);
  assert.equal(t.colonnes[0].libelle, "Désignation");
  assert.deepEqual(t.lignes[0].slice(1, 4), ["m", 4, "estimé"]);
  assert.match(t.metre.explication, /ne pas utiliser pour un chiffrage ferme/);
  assert.ok(r.resultat.notes[0].includes("chiffrage ferme"));
});

test("informations : demande, requete, maquettes et version inconnue signalee, statut", () => {
  const r = rapportPortes({ versions: [] });
  const infos = informationsDe(r, "OBSOLÈTE : x");
  const dict = Object.fromEntries(infos);
  assert.equal(dict["Demande"], "Combien de portes par niveau");
  assert.match(dict["Maquettes concernées"], /Architecture \(version inconnue\)/);
  assert.equal(dict["État du rapport"], "OBSOLÈTE : x");
  assert.equal(informationsDe(rapportPortes()).some(([n]) => n === "État du rapport"), false);
});

test("resume : champs de la liste d'historique", () => {
  const s = resumeRapport(rapportPortes());
  assert.deepEqual([s.nombreLignes, s.maquettes, s.aucunResultat], [2, ["Architecture"], false]);
});

// ---------- Exclusions du Viewer ----------
test("scene : identifiants exclus non comptes, mention dans le resultat", () => {
  const maquette = { id: "m1" };
  const objets = { r1: { id: "r1", name: "Garde-corps", type: "IfcRailing", parent: null, metaModels: [maquette] }, r2: { id: "r2", name: "Garde-corps", type: "IfcRailing", parent: null, metaModels: [maquette] } };
  const els = elementsDepuisScene({ metaScene: { metaObjects: objets }, scene: { objects: {} }, maquettes: [{ id: "m1", label: "A" }], exclus: new Set(["r2"]) });
  const r = calculer(els, { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcRailing"] }), regroupements: [] });
  assert.equal(r.totaux.valeur, 1);
  assert.equal(r.horsPerimetre, 1);
  assert.ok(r.notes.some((n) => /exclu comme dans le Viewer/.test(n)));
});

// ---------- Empreintes ----------
const entetes = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });
test("empreinte : ETag prioritaire, sinon Last-Modified + taille ensemble, sinon absente", () => {
  assert.equal(empreinteDepuisEntetes(entetes({ etag: '"abc"', "last-modified": "x", "content-length": "5" })), 'etag:"abc"');
  assert.equal(empreinteDepuisEntetes(entetes({ "last-modified": "Mon, 20 Oct 2026", "content-length": "5" })), "lm:Mon, 20 Oct 2026|len:5");
  assert.equal(empreinteDepuisEntetes(entetes({ "content-length": "5" })), null);
  assert.equal(empreinteDepuisEntetes(null), null);
});

test("lireEmpreinte : HEAD sans cache, erreur reseau ou statut KO = null ; lireEmpreintes ne rejette jamais", async () => {
  let vu;
  const ok = async (url, init) => { vu = init; return { ok: true, headers: entetes({ etag: "W/1" }) }; };
  assert.equal(await lireEmpreinte("/a.xkt", { fetch: ok }), "etag:W/1");
  assert.deepEqual(vu, { method: "HEAD", cache: "no-cache" });
  assert.equal(await lireEmpreinte("/a.xkt", { fetch: async () => ({ ok: false, headers: entetes({ etag: "x" }) }) }), null);
  assert.equal(await lireEmpreinte("/a.xkt", { fetch: async () => { throw new Error("reseau"); } }), null);
  const tout = await lireEmpreintes([{ id: "a", label: "A", src: "/a.xkt" }, { id: "b", label: "B" }], { fetch: ok });
  assert.deepEqual(tout.map((m) => [m.id, m.empreinte]), [["a", "etag:W/1"], ["b", null]]);
});

// ---------- Obsolescence ----------
const enr = [{ id: "arch", label: "Architecture", empreinte: "etag:A1" }];
test("obsolescence : aucune maquette changee = a jour", () => {
  assert.deepEqual(comparerVersions(enr, VERSIONS), { etat: "a_jour", changees: [], inconnues: [] });
});
test("obsolescence : une maquette concernee changee = obsolete, nommee", () => {
  const maintenant = VERSIONS.map((v) => (v.id === "arch" ? { ...v, empreinte: "etag:A2" } : v));
  const s = comparerVersions(enr, maintenant);
  assert.deepEqual([s.etat, s.changees], ["obsolete", ["Architecture"]]);
  assert.match(libelleStatut(s), /^OBSOLÈTE : la maquette Architecture a été mise à jour/);
});
test("obsolescence : une maquette NON concernee changee ne rend pas le rapport obsolete", () => {
  const maintenant = VERSIONS.map((v) => (v.id === "mep" ? { ...v, empreinte: "etag:M2" } : v));
  assert.equal(comparerVersions(enr, maintenant).etat, "a_jour");
});
test("obsolescence : empreinte absente (au calcul ou maintenant) ou maquette disparue = version inconnue, jamais a jour", () => {
  assert.equal(comparerVersions([{ id: "arch", label: "Architecture", empreinte: null }], VERSIONS).etat, "inconnue");
  assert.equal(comparerVersions(enr, [{ id: "arch", label: "Architecture", empreinte: null }]).etat, "inconnue");
  const s = comparerVersions(enr, []);
  assert.deepEqual([s.etat, s.inconnues], ["inconnue", ["Architecture"]]);
  assert.match(libelleStatut(s), /Version des maquettes inconnue \(Architecture\)/);
  assert.equal(comparerVersions([], VERSIONS).etat, "inconnue");
});
test("obsolescence : un changement certain l'emporte sur une inconnue", () => {
  const e = [...enr, { id: "mep", label: "Mechanical (CVC)", empreinte: null }];
  const maintenant = VERSIONS.map((v) => (v.id === "arch" ? { ...v, empreinte: "etag:A2" } : v));
  assert.equal(comparerVersions(e, maintenant).etat, "obsolete");
  assert.match(libelleStatut(comparerVersions(enr, VERSIONS)), /^À jour/);
});

// ---------- Historique ----------
function depotMemoire() { let donnees = []; return { lire: () => donnees, ecrire: (e) => { donnees = e; return true; }, donnees: () => donnees }; }
const rapportN = (n) => rapportPortes({ id: "r" + n, calculeLe: new Date(2026, 9, 1, 8, n) });

test("historique : ajout, liste recente d'abord, obtention sans IA, remplacement par meme id", async () => {
  const h = creerHistorique({ depot: depotMemoire() });
  await h.ajouter(rapportN(1));
  await h.ajouter(rapportN(2));
  assert.deepEqual((await h.lister()).map((e) => e.id), ["r2", "r1"]);
  assert.equal((await h.obtenir("r1")).rapport.phrase, "Combien de portes par niveau");
  assert.equal(await h.obtenir("zz"), null);
  await h.ajouter({ ...rapportN(1), phrase: "recalcule" });
  assert.equal((await h.lister()).length, 2);
  assert.equal((await h.obtenir("r1")).rapport.phrase, "recalcule");
});

test("historique : régénérer = nouvelle entrée, l'ancien rapport reste (nouvel id, nouvelle date)", async () => {
  const h = creerHistorique({ depot: depotMemoire() });
  await h.ajouter(rapportN(1));
  await h.ajouter({ ...rapportN(1), id: "r1-regenere", calculeLe: "2026-10-31T10:00:00.000Z" });
  assert.deepEqual((await h.lister()).map((e) => e.id), ["r1-regenere", "r1"]);
});

test("historique : nombre d'entrees borne, la plus ancienne purgee", async () => {
  const depot = depotMemoire();
  const h = creerHistorique({ depot, maximum: 3 });
  for (let i = 1; i <= 5; i += 1) await h.ajouter(rapportN(i));
  assert.deepEqual((await h.lister()).map((e) => e.id), ["r5", "r4", "r3"]);
  assert.equal(HISTORIQUE_MAX_ENTREES, 30);
});

test("historique : taille bornee (purge) et entree seule trop grosse refusee", async () => {
  const taille = JSON.stringify({ id: "r1", creeLe: "x", rapport: rapportN(1) }).length;
  const h = creerHistorique({ depot: depotMemoire(), maxOctets: Math.round(taille * 2.5) });
  for (let i = 1; i <= 4; i += 1) await h.ajouter(rapportN(i));
  assert.deepEqual((await h.lister()).map((e) => e.id), ["r4", "r3"]);
  const petit = creerHistorique({ depot: depotMemoire(), maxOctets: 100 });
  assert.deepEqual(await petit.ajouter(rapportN(1)), { ok: false, raison: "trop_volumineux" });
});

test("historique : suppression d'une entree, vider, suppression d'une entree inconnue", async () => {
  const h = creerHistorique({ depot: depotMemoire() });
  await h.ajouter(rapportN(1));
  await h.ajouter(rapportN(2));
  assert.equal(await h.supprimer("r1"), true);
  assert.equal(await h.supprimer("r1"), false);
  assert.equal((await h.lister()).length, 1);
  await h.vider();
  assert.deepEqual(await h.lister(), []);
});

test("historique : depot asynchrone accepte, ecriture refusee = stockage_indisponible", async () => {
  let donnees = [];
  const asynchrone = { lire: async () => donnees, ecrire: async (e) => { donnees = e; return true; } };
  assert.equal((await creerHistorique({ depot: asynchrone }).ajouter(rapportN(1))).ok, true);
  assert.equal(donnees.length, 1);
  const plein = { lire: () => [], ecrire: () => false };
  assert.deepEqual(await creerHistorique({ depot: plein }).ajouter(rapportN(1)), { ok: false, raison: "stockage_indisponible" });
});

test("depot local : fonctionne sur un Storage, sans stockage, JSON corrompu, quota depasse, acces qui leve", () => {
  const magasin = new Map();
  const stockage = { getItem: (k) => (magasin.has(k) ? magasin.get(k) : null), setItem: (k, v) => magasin.set(k, v) };
  const d = creerDepotLocal(stockage, "cle");
  assert.deepEqual(d.lire(), []);
  assert.equal(d.ecrire([{ id: "a" }]), true);
  assert.deepEqual(d.lire(), [{ id: "a" }]);
  magasin.set("cle", "{pas du json");
  assert.deepEqual(d.lire(), []);
  magasin.set("cle", '{"x":1}');
  assert.deepEqual(d.lire(), []);
  const plein = creerDepotLocal({ getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } }, "c");
  assert.equal(plein.ecrire([]), false);
  const absent = creerDepotLocal(null, "c");
  assert.deepEqual(absent.lire(), []);
  const bloque = creerDepotLocal({ getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } }, "c");
  assert.deepEqual(bloque.lire(), []);
  assert.equal(bloque.ecrire([]), false);
});
