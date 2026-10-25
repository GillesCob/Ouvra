// 2D -> 3D (25/10) : modele intermediaire (src/plan3d/modele.js) et volumes (src/plan3d/geometrie.js). Cas nominal, entrees vides, entrees invalides.
import test from "node:test";
import assert from "node:assert/strict";
import {
  creerModeleVide, validerModele, ajouterNoeud, ajouterMur, supprimerMur, definirLongueur, longueurMur, murDe, noeudDe,
  ajouterOuverture, modifierOuverture, supprimerOuverture, modifierMur, calibrer, contourExterieur, scinderMur, surfaceContour, ajouterPiece, modifierPiece, supprimerPiece, definirInfo, supprimerInfo, infosDe
} from "../src/plan3d/modele.js";

// Carre de 4 m x 3 m, murs exterieurs, plus une cloison au milieu.
function maison() {
  let m = creerModeleVide();
  const ids = [];
  for (const [x, y] of [[0, 0], [4, 0], [4, 3], [0, 3], [2, 0], [2, 3]]) {
    const r = ajouterNoeud(m, x, y);
    m = r.modele;
    ids.push(r.id);
  }
  const [n1, n2, n3, n4, n5, n6] = ids;
  for (const [a, b, type] of [[n1, n5, "exterieur"], [n5, n2, "exterieur"], [n2, n3, "exterieur"], [n3, n6, "exterieur"], [n6, n4, "exterieur"], [n4, n1, "exterieur"], [n5, n6, "interieur"]]) {
    m = ajouterMur(m, a, b, { type }).modele;
  }
  return m;
}

test("un modele vide est valide, sans mur ni ouverture ni piece", () => {
  const m = creerModeleVide();
  assert.equal(validerModele(m).valide, true);
  assert.deepEqual([m.noeuds, m.murs, m.ouvertures, m.pieces], [[], [], [], []]);
  assert.equal(contourExterieur(m), null);
});

test("validerModele refuse un modele casse", () => {
  assert.equal(validerModele(null).valide, false);
  assert.equal(validerModele({}).valide, false);
  const m = maison();
  const casse = { ...m, murs: [...m.murs, { id: "MX", a: "N1", b: "inconnu", epaisseur: 0.2, type: "interieur" }] };
  assert.equal(validerModele(casse).valide, false);
  const sansEpaisseur = { ...m, murs: m.murs.map((w, i) => (i === 0 ? { ...w, epaisseur: 0 } : w)) };
  assert.equal(validerModele(sansEpaisseur).valide, false);
  assert.equal(validerModele(maison()).valide, true);
});

test("validerModele refuse une ouverture qui depasse de son mur", () => {
  let m = maison();
  const mur = m.murs.find((w) => w.a === "N5" && w.b === "N2"); // 2 m
  m = ajouterOuverture(m, mur.id, "fenetre", 1).modele;
  assert.equal(validerModele(m).valide, true);
  const trop = { ...m, ouvertures: m.ouvertures.map((o) => ({ ...o, decalage: 1.5 })) };
  assert.match(validerModele(trop).erreurs[0], /hors du mur/);
});

test("ajouterMur refuse un doublon, un mur degenere et un noeud inconnu", () => {
  const m = maison();
  assert.equal(ajouterMur(m, "N1", "N1").id, null);
  assert.equal(ajouterMur(m, "N1", "N5").id, null);
  assert.equal(ajouterMur(m, "N5", "N1").id, null);
  assert.equal(ajouterMur(m, "N1", "inconnu").id, null);
});

test("definirLongueur deplace le noeud b et fait suivre les murs connectes", () => {
  const m = maison();
  const mur = m.murs.find((w) => w.a === "N1" && w.b === "N5"); // 2 m, de (0,0) a (2,0)
  const r = definirLongueur(m, mur.id, 3);
  assert.equal(longueurMur(r, murDe(r, mur.id)), 3);
  assert.deepEqual({ x: noeudDe(r, "N5").x, y: noeudDe(r, "N5").y }, { x: 3, y: 0 });
  // la cloison N5-N6 est connectee a N5 : son extremite a suivi
  const cloison = murDe(r, m.murs.find((w) => w.a === "N5" && w.b === "N6").id);
  assert.ok(Math.abs(longueurMur(r, cloison) - Math.hypot(1, 3)) < 1e-9);
  assert.equal(noeudDe(m, "N5").x, 2, "le modele d'origine n'est pas modifie");
});

test("definirLongueur ignore une longueur invalide", () => {
  const m = maison();
  const id = m.murs[0].id;
  for (const v of [0, -1, NaN, Infinity, "3", null, undefined, 0.01]) assert.strictEqual(definirLongueur(m, id, v), m);
  assert.strictEqual(definirLongueur(m, "inexistant", 3), m);
});

test("supprimerMur retire ses ouvertures et les noeuds orphelins", () => {
  let m = maison();
  const cloison = m.murs.find((w) => w.type === "interieur");
  m = ajouterOuverture(m, cloison.id, "porte", 1.5).modele;
  const apres = supprimerMur(m, cloison.id);
  assert.equal(apres.ouvertures.length, 0);
  assert.equal(apres.murs.length, 6);
  assert.equal(apres.noeuds.length, 6, "N5 et N6 servent encore aux murs exterieurs");
  const seul = supprimerMur(supprimerMur(creerModeleVide(), "x"), "y");
  assert.equal(seul.murs.length, 0);
});

test("ajouterOuverture centre l'ouverture et la rabote pour qu'elle tienne dans le mur", () => {
  const m = maison();
  const mur = m.murs.find((w) => w.a === "N5" && w.b === "N2"); // 2 m
  const { modele, id } = ajouterOuverture(m, mur.id, "fenetre", 1);
  const o = modele.ouvertures.find((x) => x.id === id);
  assert.equal(o.largeur, 1.2);
  assert.ok(Math.abs(o.decalage - 0.4) < 1e-9);
  const bord = ajouterOuverture(m, mur.id, "porte", 100);
  const p = bord.modele.ouvertures[0];
  assert.ok(p.decalage + p.largeur <= 2 + 1e-9);
  assert.equal(ajouterOuverture(m, "inexistant", "porte", 1).id, null);
  assert.equal(ajouterOuverture(m, mur.id, "baie", 1).id, null);
});

test("modifierOuverture et modifierMur ignorent les valeurs invalides", () => {
  let m = maison();
  const mur = m.murs[0];
  const r = ajouterOuverture(m, mur.id, "porte", 1);
  m = r.modele;
  const apres = modifierOuverture(m, r.id, { largeur: -2, hauteur: NaN, decalage: 0.2, genre: "fenetre" });
  const o = apres.ouvertures[0];
  assert.equal(o.largeur, 0.9);
  assert.equal(o.hauteur, 2.1);
  assert.equal(o.decalage, 0.2);
  assert.equal(o.genre, "fenetre");
  assert.equal(modifierMur(m, mur.id, { epaisseur: -1, type: "autre" }).murs[0].epaisseur, mur.epaisseur);
  assert.equal(modifierMur(m, mur.id, { epaisseur: 0.4, type: "interieur" }).murs[0].type, "interieur");
  assert.equal(supprimerOuverture(m, r.id).ouvertures.length, 0);
});

test("calibrer met le plan a l'echelle sans toucher aux hauteurs ni aux epaisseurs", () => {
  let m = maison();
  const mur = m.murs[0];
  m = ajouterOuverture(m, mur.id, "fenetre", 1).modele;
  m = { ...m, fond: { echelle: 0.01, x: 0, y: 0 } };
  const r = calibrer(m, { x: 0, y: 0 }, { x: 4, y: 0 }, 8); // le plan etait 2 fois trop petit
  assert.equal(noeudDe(r, "N2").x, 8);
  assert.equal(r.fond.echelle, 0.02);
  assert.equal(r.ouvertures[0].largeur, 2.4);
  assert.equal(r.ouvertures[0].hauteur, 1.25);
  assert.equal(r.murs[0].epaisseur, m.murs[0].epaisseur);
  for (const d of [0, -3, NaN]) assert.strictEqual(calibrer(m, { x: 0, y: 0 }, { x: 4, y: 0 }, d), m);
  assert.strictEqual(calibrer(m, { x: 1, y: 1 }, { x: 1, y: 1 }, 5), m);
});

test("contourExterieur chaine les murs exterieurs en une boucle, sinon null", () => {
  const m = maison();
  const ordre = contourExterieur(m);
  assert.equal(ordre.length, 6);
  assert.equal(new Set(ordre).size, 6);
  assert.equal(contourExterieur(creerModeleVide()), null);
  assert.equal(contourExterieur(supprimerMur(m, m.murs[0].id)), null, "boucle ouverte");
});

test("scinderMur coupe un mur en deux, repartit les ouvertures et rend le noeud cree", () => {
  let m = maison();
  const mur = m.murs.find((w) => w.a === "N5" && w.b === "N2"); // 2 m, de (2,0) a (4,0)
  m = ajouterOuverture(m, mur.id, "porte", 0.5).modele; // 0.05 a 0.95
  m = ajouterOuverture(m, mur.id, "fenetre", 1.6).modele; // 1.0 a 2.0 (rognee a 1.4 + 0.6 selon le mur)
  const { modele, id } = scinderMur(m, mur.id, 3, 0.4); // projete en (3, 0)
  assert.equal(noeudDe(modele, id).x, 3);
  assert.equal(noeudDe(modele, id).y, 0);
  assert.equal(modele.murs.length, m.murs.length + 1);
  assert.equal(validerModele(modele).valide, true);
  assert.equal(murDe(modele, mur.id).b, id);
  const suite = modele.murs.find((w) => w.a === id);
  assert.equal(suite.b, "N2");
  assert.equal(modele.ouvertures.find((o) => o.genre === "porte").mur, mur.id);
  const fenetre = modele.ouvertures.find((o) => o.genre === "fenetre");
  assert.ok(fenetre.decalage + fenetre.largeur <= 1 + 1e-9 || fenetre.mur === suite.id);
  assert.equal(m.murs.length, 7, "le modele d'origine n'est pas modifie");
});

test("scinderMur pres d'une extremite rend le noeud existant, un mur inconnu ne change rien", () => {
  const m = maison();
  const mur = m.murs.find((w) => w.a === "N5" && w.b === "N2");
  const proche = scinderMur(m, mur.id, 2.01, 0);
  assert.equal(proche.id, "N5");
  assert.strictEqual(proche.modele, m);
  assert.equal(scinderMur(m, mur.id, 99, 5).id, "N2");
  const inconnu = scinderMur(m, "inexistant", 1, 1);
  assert.equal(inconnu.id, null);
  assert.strictEqual(inconnu.modele, m);
});

test("surfaceContour : rectangle, L, orientation inverse, contour trop court", () => {
  assert.equal(surfaceContour([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }]), 12);
  assert.equal(surfaceContour([{ x: 0, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 0 }, { x: 0, y: 0 }]), 12);
  assert.equal(surfaceContour([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 }]), 6);
  assert.equal(surfaceContour([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0);
  assert.equal(surfaceContour(null), 0);
});

test("pieces : ajout, modification, suppression, validation et calibration", () => {
  const rect = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
  let m = maison();
  const r = ajouterPiece(m, "  Séjour ", rect, 4);
  m = r.modele;
  assert.equal(m.pieces[0].nom, "Séjour");
  assert.equal(m.pieces[0].surfacePlan, 4);
  assert.equal(validerModele(m).valide, true);
  assert.equal(ajouterPiece(m, "x", rect.slice(0, 2)).id, null);
  assert.equal(ajouterPiece(m, "x", [{ x: 0, y: 0 }, { x: 1, y: NaN }, { x: 2, y: 2 }]).id, null);
  assert.equal(ajouterPiece(m, "", rect, -3).modele.pieces[1].nom, "Pièce");
  assert.equal(ajouterPiece(m, "", rect, -3).modele.pieces[1].surfacePlan, null);
  assert.equal(modifierPiece(m, r.id, { nom: "Salon" }).pieces[0].nom, "Salon");
  assert.equal(modifierPiece(m, r.id, { nom: 12 }).pieces[0].nom, "Séjour");
  assert.equal(modifierPiece(m, "inconnue", { nom: "x" }).pieces.length, 1);
  assert.equal(calibrer(m, { x: 0, y: 0 }, { x: 4, y: 0 }, 8).pieces[0].contour[1].x, 4);
  assert.equal(supprimerPiece(m, r.id).pieces.length, 0);
  const casse = { ...m, pieces: [{ id: "P1", nom: "a", contour: [{ x: 0, y: 0 }] }] };
  assert.equal(validerModele(casse).valide, false);
  const sansPieces = { ...maison() };
  delete sansPieces.pieces;
  assert.equal(validerModele(sansPieces).valide, true, "un ancien modele sans pieces reste valide");
});

test("infos libres : ajout, remplacement, suppression, cles et valeurs invalides", () => {
  let m = maison();
  const mur = m.murs[0].id;
  m = definirInfo(m, "mur", mur, " Matériau ", "Béton");
  assert.deepEqual(infosDe(m, "mur", mur), [{ cle: "Matériau", valeur: "Béton" }]);
  m = definirInfo(m, "mur", mur, "Matériau", "Brique");
  m = definirInfo(m, "mur", mur, "Isolant", "");
  assert.deepEqual(infosDe(m, "mur", mur), [{ cle: "Matériau", valeur: "Brique" }, { cle: "Isolant", valeur: "" }]);
  assert.equal(validerModele(m).valide, true);
  assert.deepEqual(infosDe(supprimerInfo(m, "mur", mur, "Matériau"), "mur", mur), [{ cle: "Isolant", valeur: "" }]);
  assert.strictEqual(definirInfo(m, "mur", mur, "   ", "x"), m);
  assert.strictEqual(definirInfo(m, "mur", mur, "k", 12), m);
  assert.strictEqual(definirInfo(m, "mur", "inconnu", "k", "v"), m);
  assert.strictEqual(definirInfo(m, "sol", mur, "k", "v"), m);
  assert.equal(infosDe(m, "mur", "inconnu").length, 0);
  assert.equal(definirInfo(m, "mur", mur, "k".repeat(200), "v".repeat(900)).murs[0].infos[2].cle.length, 60);
  assert.equal(definirInfo(m, "mur", mur, "k", "v".repeat(900)).murs[0].infos[2].valeur.length, 500);
  const o = ajouterOuverture(m, mur, "fenetre", 1);
  assert.equal(infosDe(definirInfo(o.modele, "ouverture", o.id, "Vitrage", "Double"), "ouverture", o.id)[0].valeur, "Double");
  const casse = { ...m, murs: m.murs.map((w, i) => (i === 0 ? { ...w, infos: [{ cle: "", valeur: "x" }] } : w)) };
  assert.equal(validerModele(casse).valide, false);
});

