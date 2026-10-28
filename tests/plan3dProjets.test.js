// 2D -> 3D (28/10) : stockage des projets (src/plan3d/projets.js) : vide, corrompu, quota, suppression, renommage, limite.
import test from "node:test";
import assert from "node:assert/strict";
import { creerProjets, nettoyerNom, nomDepuisFichier, detailProjet, CLE_PROJETS, PROJETS_MAX } from "../src/plan3d/projets.js";
import { creerDepotLocal } from "../src/quantitatifHistorique.js";
import { creerModeleVide } from "../src/plan3d/modele.js";
import { creerDepotImagesIdb } from "../src/plan3d/projetsImages.js";

const stockageMemoire = (initial = {}, { plein = false } = {}) => {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (plein) throw new Error("QuotaExceededError"); m.set(k, String(v)); }, m };
};
const imagesMemoire = ({ echec = false } = {}) => {
  const m = new Map();
  return { m, lire: (id) => m.get(id) || null, ecrire: (id, b) => { if (echec) return false; m.set(id, b); return true; }, supprimer: (id) => { m.delete(id); return true; } };
};
const horloge = () => { let t = Date.parse("2026-10-28T10:00:00Z"); return () => new Date((t += 60000)); };
const fabrique = (stockage, images = imagesMemoire()) =>
  creerProjets({ depotMeta: creerDepotLocal(stockage, CLE_PROJETS), depotImages: images, maintenant: horloge() });
const modeleAvecMur = () => {
  const m = creerModeleVide();
  m.noeuds.push({ id: "n1", x: 0, y: 0 }, { id: "n2", x: 3, y: 0 });
  m.murs.push({ id: "m1", a: "n1", b: "n2", epaisseur: 0.1, type: "interieur" });
  return m;
};
const base = (extra = {}) => ({ nom: "Plan A", modele: creerModeleVide(), image: "BLOB-A", l: 1200, h: 800, ...extra });

test("stockage vide : liste vide, projet inconnu absent, rien ne leve", async () => {
  const p = fabrique(stockageMemoire());
  assert.deepEqual(await p.lister(), []);
  assert.equal(await p.obtenir("inconnu"), null);
  assert.equal(await p.supprimer("inconnu"), false);
  assert.equal(p.persistant(), true);
});

test("creation : le projet est liste avec son resume, rouvrable avec son etat et son image, et survit a un rechargement", async () => {
  const s = stockageMemoire();
  const img = imagesMemoire();
  const p = fabrique(s, img);
  const r = await p.creer(base({ modele: modeleAvecMur(), vignette: "data:image/jpeg;base64,AAAA" }));
  assert.equal(r.ok, true);
  assert.equal(r.persistant, true);
  const apres = fabrique(s, img); // autre instance, meme stockage = rechargement de la page
  const l = await apres.lister();
  assert.equal(l.length, 1);
  assert.deepEqual([l[0].nom, l[0].murs, l[0].pieces, l[0].vignette], ["Plan A", 1, 0, "data:image/jpeg;base64,AAAA"]);
  const o = await apres.obtenir(r.id);
  assert.equal(o.modele.murs.length, 1);
  assert.equal(o.image, "BLOB-A");
  assert.deepEqual([o.l, o.h], [1200, 800]);
});

test("tri : le projet modifie en dernier passe en tete ; l'enregistrement ecrase l'etat", async () => {
  const p = fabrique(stockageMemoire());
  const a = await p.creer(base({ nom: "A" }));
  const b = await p.creer(base({ nom: "B" }));
  assert.deepEqual((await p.lister()).map((x) => x.nom), ["B", "A"]);
  assert.equal((await p.enregistrer(a.id, modeleAvecMur())).ok, true);
  const l = await p.lister();
  assert.deepEqual([l[0].nom, l[0].murs], ["A", 1]);
  assert.ok(b.id);
});

test("enregistrement refuse : projet disparu ou modele invalide", async () => {
  const p = fabrique(stockageMemoire());
  const a = await p.creer(base());
  assert.equal((await p.enregistrer("autre", creerModeleVide())).ok, false);
  assert.equal((await p.enregistrer(a.id, { murs: 3 })).ok, false);
  assert.equal((await p.obtenir(a.id)).modele.murs.length, 0);
});

test("stockage corrompu : JSON illisible = liste vide, entrees abimees ecartees sans perdre les bonnes", async () => {
  assert.deepEqual(await fabrique(stockageMemoire({ [CLE_PROJETS]: "{pas du json" })).lister(), []);
  assert.deepEqual(await fabrique(stockageMemoire({ [CLE_PROJETS]: '{"a":1}' })).lister(), []);
  const bonne = { id: "p1", nom: "Bonne", creeLe: "2026-10-28T10:00:00Z", modifieLe: "2026-10-28T10:00:00Z", l: 10, h: 10, modele: creerModeleVide() };
  const brut = JSON.stringify([null, 5, { id: "x" }, { ...bonne, id: "p2", modele: { murs: "non" } }, { ...bonne, modifieLe: "hier" }, bonne]);
  const l = await fabrique(stockageMemoire({ [CLE_PROJETS]: brut })).lister();
  assert.deepEqual(l.map((x) => x.id), ["p1"]);
});

test("quota depasse : le projet reste disponible en memoire, persistant() passe a false, aucune exception", async () => {
  const p = fabrique(stockageMemoire({}, { plein: true }));
  const r = await p.creer(base());
  assert.equal(r.ok, true);
  assert.equal(r.persistant, false);
  assert.equal(p.persistant(), false);
  assert.equal((await p.lister()).length, 1);
  assert.equal((await p.obtenir(r.id)).image, "BLOB-A");
});

test("images indisponibles : persistant() false, l'image reste lue depuis la memoire de la session", async () => {
  const p = fabrique(stockageMemoire(), imagesMemoire({ echec: true }));
  const r = await p.creer(base());
  assert.equal(r.persistant, false);
  assert.equal((await p.obtenir(r.id)).image, "BLOB-A");
});

test("image absente apres rechargement : le projet s'ouvre quand meme, image null", async () => {
  const s = stockageMemoire();
  const r = await fabrique(s).creer(base());
  const o = await fabrique(s, imagesMemoire()).obtenir(r.id);
  assert.equal(o.image, null);
  assert.equal(o.modele.murs.length, 0);
});

test("depots qui levent : traites comme vides ou en echec, jamais propages", async () => {
  const p = creerProjets({
    depotMeta: { lire: () => { throw new Error("x"); }, ecrire: () => { throw new Error("x"); } },
    depotImages: { lire: () => { throw new Error("x"); }, ecrire: () => { throw new Error("x"); }, supprimer: () => { throw new Error("x"); } }
  });
  assert.deepEqual(await p.lister(), []);
  const r = await p.creer(base());
  assert.deepEqual([r.ok, r.persistant], [true, false]);
  assert.equal(await p.supprimer(r.id), true);
});

test("suppression : le projet et son image disparaissent, les autres restent", async () => {
  const s = stockageMemoire();
  const img = imagesMemoire();
  const p = fabrique(s, img);
  const a = await p.creer(base({ nom: "A" }));
  const b = await p.creer(base({ nom: "B" }));
  assert.equal(await p.supprimer(a.id), true);
  assert.equal(img.m.has(a.id), false);
  assert.equal(img.m.has(b.id), true);
  assert.deepEqual((await fabrique(s, img).lister()).map((x) => x.nom), ["B"]);
  assert.equal(await p.obtenir(a.id), null);
});

test("renommage : espaces compactes, nom borne, nom vide refuse", async () => {
  const p = fabrique(stockageMemoire());
  const a = await p.creer(base());
  assert.equal(await p.renommer(a.id, "  Villa   Salomé "), "Villa Salomé");
  assert.equal((await p.renommer(a.id, "x".repeat(200))).length, 60);
  assert.equal(await p.renommer(a.id, "   "), null);
  assert.equal(await p.renommer("inconnu", "Nom"), null);
  assert.equal((await p.obtenir(a.id)).nom.length, 60);
});

test("creation refusee : nom vide, modele invalide, limite atteinte (aucune purge silencieuse)", async () => {
  const p = fabrique(stockageMemoire());
  assert.equal((await p.creer(base({ nom: " " }))).raison, "nom_invalide");
  assert.equal((await p.creer(base({ modele: {} }))).raison, "modele_invalide");
  assert.equal((await p.creer(base({ l: 0 }))).raison, "modele_invalide");
  for (let i = 0; i < PROJETS_MAX; i++) assert.equal((await p.creer(base({ nom: "P" + i }))).ok, true);
  assert.equal((await p.creer(base())).raison, "limite");
  assert.equal((await p.lister()).length, PROJETS_MAX);
});

test("remplacerImage : nouvelle image et nouvelles dimensions, etat conserve", async () => {
  const p = fabrique(stockageMemoire());
  const a = await p.creer(base({ modele: modeleAvecMur() }));
  assert.equal((await p.remplacerImage(a.id, { image: "BLOB-B", l: 500, h: 400 })).ok, true);
  const o = await p.obtenir(a.id);
  assert.deepEqual([o.image, o.l, o.h, o.modele.murs.length], ["BLOB-B", 500, 400, 1]);
});

test("vignette trop lourde ignoree, projet cree quand meme", async () => {
  const p = fabrique(stockageMemoire());
  const r = await p.creer(base({ vignette: "x".repeat(50000) }));
  assert.equal(r.ok, true);
  assert.equal((await p.lister())[0].vignette, null);
});

test("noms : nettoyage et nom depuis un fichier", () => {
  assert.equal(nettoyerNom(null), null);
  assert.equal(nomDepuisFichier("plan RDC.v2.pdf"), "plan RDC.v2");
  assert.equal(nomDepuisFichier(".pdf"), null);
  assert.equal(nomDepuisFichier(""), null);
});

test("depot IndexedDB absent : lire null, ecrire et supprimer false, sans exception", async () => {
  const d = creerDepotImagesIdb(null);
  assert.equal(await d.lire("a"), null);
  assert.equal(await d.ecrire("a", "b"), false);
  assert.equal(await d.supprimer("a"), false);
});

test("detail d'une carte : pieces seulement, jamais de murs", () => {
  assert.equal(detailProjet({ pieces: 0, murs: 12 }), "Aucune pièce");
  assert.equal(detailProjet({ pieces: 1 }), "1 pièce");
  assert.equal(detailProjet({ pieces: 7, murs: 41 }), "7 pièces");
});
