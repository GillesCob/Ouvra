// 2D -> 3D, IA du plan (25/10) : description textuelle du plan (src/plan3d/ia/descriptionPlan.js) et registre de commandes (src/plan3d/ia/commandesPlan.js).
// Plan de test : deux pieces cote a cote (Sejour 4 x 3 m a l'ouest, Chambre 3 x 3 m a l'est), cloison au milieu, ouvertures connues.
import test from "node:test";
import assert from "node:assert/strict";
import { creerModeleVide, ajouterNoeud, ajouterMur, ajouterOuverture, ajouterPiece, modifierOuverture, ouvertureDe, murDe } from "../src/plan3d/modele.js";
import { decrirePlan, texteDuPlan, COTES } from "../src/plan3d/ia/descriptionPlan.js";
import { appliquerCommandes, validerCommande, REGISTRE_PLAN, COMMANDES_MAX } from "../src/plan3d/ia/commandesPlan.js";

function plan() {
  let m = creerModeleVide();
  const n = {};
  for (const [id, x, y] of [["A", 0, 0], ["B", 4, 0], ["C", 7, 0], ["D", 7, 3], ["E", 4, 3], ["F", 0, 3]]) { const r = ajouterNoeud(m, x, y); m = r.modele; n[id] = r.id; }
  const mur = {};
  for (const [nom, a, b, type] of [["AB", "A", "B", "exterieur"], ["BC", "B", "C", "exterieur"], ["CD", "C", "D", "exterieur"], ["DE", "D", "E", "exterieur"], ["EF", "E", "F", "exterieur"], ["FA", "F", "A", "exterieur"], ["BE", "B", "E", "interieur"]]) {
    const r = ajouterMur(m, n[a], n[b], { type });
    m = r.modele;
    mur[nom] = r.id;
  }
  const ouv = {};
  const poser = (cle, nomMur, genre, centre, largeur) => { const r = ajouterOuverture(m, mur[nomMur], genre, centre); m = modifierOuverture(r.modele, r.id, { largeur }); ouv[cle] = r.id; };
  poser("fen1", "AB", "fenetre", 1.0, 1.2); // nord du Sejour, x = 1,0
  poser("fen2", "AB", "fenetre", 2.8, 1.0); // nord du Sejour, x = 2,8
  poser("porteSud", "EF", "porte", 1.0, 0.9); // sud du Sejour : EF va de x=4 a x=0, 1,0 m depuis E donne x = 3,0
  poser("cloison", "BE", "porte", 1.5, 0.9); // cloison BE, y = 1,5 : est du Sejour et ouest de la Chambre
  poser("fenEst", "CD", "fenetre", 1.5, 1.0); // est de la Chambre
  m = ajouterPiece(m, "Séjour", [{ x: 0.15, y: 0.15 }, { x: 3.95, y: 0.15 }, { x: 3.95, y: 2.85 }, { x: 0.15, y: 2.85 }]).modele;
  m = ajouterPiece(m, "Chambre", [{ x: 4.05, y: 0.15 }, { x: 6.85, y: 0.15 }, { x: 6.85, y: 2.85 }, { x: 4.05, y: 2.85 }]).modele;
  return { m, mur, ouv };
}
const copie = (x) => JSON.parse(JSON.stringify(x));

test("decrirePlan : cotes, rangs de l'ouest vers l'est et du nord vers le sud, cloison vue des deux pieces", () => {
  const { m, ouv } = plan();
  const d = decrirePlan(m);
  const sejour = d.parLibelle.get("Séjour");
  const chambre = d.parLibelle.get("Chambre");
  assert.deepEqual(sejour.cotes.nord.ouvertures.map((o) => [o.id, o.rang]), [[ouv.fen1, 1], [ouv.fen2, 2]]);
  assert.deepEqual(sejour.cotes.sud.ouvertures.map((o) => o.id), [ouv.porteSud]);
  assert.deepEqual(sejour.cotes.est.ouvertures.map((o) => o.id), [ouv.cloison], "la cloison est l'est du Sejour");
  assert.deepEqual(chambre.cotes.ouest.ouvertures.map((o) => o.id), [ouv.cloison], "et l'ouest de la Chambre");
  assert.deepEqual(chambre.cotes.est.ouvertures.map((o) => o.id), [ouv.fenEst]);
  assert.equal(sejour.cotes.ouest.ouvertures.length, 0);
  assert.equal(sejour.cotes.ouest.murs.length, 1, "le mur ouest existe sans ouverture");
  for (const c of COTES) assert.ok(Array.isArray(sejour.cotes[c].ouvertures));
});

test("decrirePlan : pieces de meme nom numerotees, libelles uniques", () => {
  let { m } = plan();
  m = ajouterPiece(m, "Chambre", [{ x: 0.2, y: 0.2 }, { x: 1.2, y: 0.2 }, { x: 1.2, y: 1.2 }, { x: 0.2, y: 1.2 }]).modele;
  const d = decrirePlan(m);
  const libelles = d.pieces.map((p) => p.libelle);
  assert.equal(new Set(libelles).size, libelles.length);
  assert.ok(libelles.includes("Séjour"));
  assert.ok(libelles.includes("Chambre 1") && libelles.includes("Chambre 2"));
});

test("texteDuPlan : que des mots et des nombres, une ligne par cote, aucun identifiant interne", () => {
  const { m } = plan();
  const t = texteDuPlan(decrirePlan(m));
  assert.match(t, /^Séjour \(10,3 m²\)/m);
  assert.match(t, /côté nord : 1\. fenêtre largeur 120 cm, hauteur 125 cm, allège 95 cm ; 2\. fenêtre largeur 100 cm/);
  assert.match(t, /côté sud : 1\. porte largeur 90 cm, hauteur 210 cm/);
  assert.ok(!/\bO\d+\b|\bM\d+\b|\bN\d+\b|\bP\d+\b/.test(t), "pas d'identifiant interne dans le texte envoye a l'IA");
});

test("decrirePlan : plan vide, piece sans mur, modele sans pieces", () => {
  assert.deepEqual(decrirePlan(creerModeleVide()).pieces, []);
  const m = ajouterPiece(creerModeleVide(), "Isolée", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]).modele;
  const p = decrirePlan(m).pieces[0];
  assert.ok(COTES.every((c) => p.cotes[c].murs.length === 0));
  assert.equal(texteDuPlan(decrirePlan(m)).startsWith("Isolée"), true);
});

test("validerCommande : action inconnue, piece inconnue, rang invalide, nombres, facultatifs mis a null", () => {
  const d = decrirePlan(plan().m);
  const ok = { action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 1, largeur_cm: 130 };
  const v = validerCommande(ok, d);
  assert.equal(v.ok, true);
  assert.equal(v.commande.hauteur_cm, null);
  assert.equal(v.commande.genre, null);
  assert.equal(validerCommande({ ...ok, action: "tout_casser" }, d).ok, false);
  assert.equal(validerCommande({ ...ok, piece: "Cuisine" }, d).ok, false);
  assert.equal(validerCommande({ ...ok, cote: "haut" }, d).ok, false);
  for (const rang of [0, -1, 1.5, "1", null, undefined]) assert.equal(validerCommande({ ...ok, rang }, d).ok, false, String(rang));
  for (const largeur_cm of [0, -5, NaN, Infinity, "130", 1e6]) assert.equal(validerCommande({ ...ok, largeur_cm }, d).ok, false, String(largeur_cm));
  assert.equal(validerCommande({ ...ok, genre: "baie" }, d).ok, false);
  assert.equal(validerCommande(null, d).ok, false);
  assert.equal(validerCommande([], d).ok, false);
  assert.equal(validerCommande({ action: "renommer_piece", piece: "Séjour", nouveau_nom: "   " }, d).ok, false);
  assert.equal(validerCommande({ action: "renommer_piece", piece: "Séjour", nouveau_nom: "  Salon  " }, d).commande.nouveau_nom, "Salon");
  assert.equal(validerCommande({ action: "renommer_piece", piece: "Séjour", nouveau_nom: "x".repeat(61) }, d).ok, false);
});

test("le registre expose toutes les actions avec leurs parametres decrits", () => {
  assert.deepEqual(REGISTRE_PLAN.noms(), ["modifier_ouverture", "ajouter_ouverture", "supprimer_ouverture", "renommer_piece", "modifier_mur"]);
  for (const a of REGISTRE_PLAN.toutes()) {
    assert.ok(a.description && a.libelle);
    for (const p of a.parametres) assert.ok(p.nom && p.genre && p.description, `${a.nom}.${p.nom}`);
  }
  assert.equal(REGISTRE_PLAN.parNom("inconnue"), null);
});

test("modifier_ouverture : largeur et hauteur, autour du milieu, compte rendu ecrit par le moteur", () => {
  const { m, ouv } = plan();
  const avant = copie(m);
  const r = appliquerCommandes(m, [{ action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 1, largeur_cm: 130, hauteur_cm: 140 }]);
  assert.equal(r.ok, true);
  const o = ouvertureDe(r.modele, ouv.fen1);
  assert.equal(o.largeur, 1.3);
  assert.equal(o.hauteur, 1.4);
  assert.ok(Math.abs(o.decalage + o.largeur / 2 - (ouvertureDe(m, ouv.fen1).decalage + 0.6)) < 1e-9, "le milieu ne bouge pas");
  assert.match(r.comptesRendus[0], /Fenêtre n°1, côté nord de « Séjour » : largeur 120 → 130 cm, hauteur 125 → 140 cm\./);
  assert.deepEqual(m, avant, "le modele recu n'est pas modifie");
});

test("exemple de Gilles : la fenetre nord passe de 208 a 210 de large et 2,10 m de haut (elle descend au sol), sa voisine devient une porte", () => {
  let { m, ouv } = plan();
  m = modifierOuverture(m, ouv.fen2, { largeur: 2.08 }); // la fenetre n°2 mesure 208 cm
  const r = appliquerCommandes(m, [
    { action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 2, largeur_cm: 210, hauteur_cm: 210 },
    { action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 1, genre: "porte" }
  ]);
  assert.equal(r.ok, true, r.message);
  const grande = ouvertureDe(r.modele, ouv.fen2);
  assert.deepEqual([grande.largeur, grande.hauteur, grande.allege, grande.genre], [2.1, 2.1, 0, "fenetre"]);
  const voisine = ouvertureDe(r.modele, ouv.fen1);
  assert.deepEqual([voisine.genre, voisine.hauteur, voisine.allege, voisine.largeur], ["porte", 2.1, 0, 1.2]);
  assert.equal(r.comptesRendus.length, 2);
  assert.match(r.comptesRendus[0], /allège 95 → 0 cm/);
  assert.match(r.comptesRendus[1], /fenêtre devient porte/);
});

test("modifier_ouverture : refus clairs (rang absent, rien a changer, trop large, plafond, chevauchement) et plan intact", () => {
  const { m, ouv } = plan();
  const tenter = (extra) => appliquerCommandes(m, [{ action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 1, ...extra }]);
  assert.match(tenter({ rang: 9, largeur_cm: 100 }).message, /pas d'ouverture n°9 .* \(il y en a 2\)/);
  assert.match(tenter({ largeur_cm: 120 }).message, /déjà ces mesures/);
  assert.match(tenter({ largeur_cm: 900 }).message, /ne fait que 400 cm/);
  assert.match(tenter({ hauteur_cm: 200, allege_cm: 95 }).message, /dépassent la hauteur du niveau/);
  assert.match(tenter({ largeur_cm: 10 }).message, /trop petite/);
  const chevauche = tenter({ largeur_cm: 250 });
  assert.equal(chevauche.ok, false);
  assert.match(chevauche.message, /chevaucherait la fenêtre voisine/);
  assert.equal(appliquerCommandes(m, [{ action: "modifier_ouverture", piece: "Séjour", cote: "ouest", rang: 1, largeur_cm: 100 }]).ok, false);
  assert.ok(ouv.fen1);
});

test("une largeur qui deborde du mur est decalee pour rester dans le mur", () => {
  const { m, ouv } = plan();
  // fenetre n°1 : de 0,4 a 1,6 m sur un mur de 4 m ; 3,6 m de large depuis le milieu 1,0 deborderait a gauche : decalee a 0
  const r = appliquerCommandes(m, [{ action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 2, largeur_cm: 130 }]);
  assert.equal(r.ok, true);
  assert.ok(ouvertureDe(r.modele, ouv.fen2).decalage + 1.3 <= 4 + 1e-9);
});

test("ajouter_ouverture : depuis le debut, depuis la fin, au centre, emplacement hors mur ou occupe", () => {
  const { m } = plan();
  const ajout = (extra) => appliquerCommandes(m, [{ action: "ajouter_ouverture", piece: "Chambre", cote: "nord", genre: "fenetre", ...extra }]);
  const debut = ajout({ ancrage: "debut", distance_cm: 50, largeur_cm: 100 });
  assert.equal(debut.ok, true, debut.message);
  const f = debut.modele.ouvertures.find((o) => !m.ouvertures.some((x) => x.id === o.id));
  const mur = murDe(debut.modele, f.mur);
  assert.equal(mur.id, murDe(m, "M2").id, "pose sur le mur nord de la Chambre (BC)");
  assert.ok(Math.abs(f.decalage - (4.05 + 0.5 - 4)) < 1e-9, "bord de la piece (x = 4,05) + 50 cm, depuis B (x = 4)");
  assert.match(debut.comptesRendus[0], /Fenêtre de 100 cm ajoutée, côté nord de « Chambre », à 50 cm du début du côté\./);
  const fin = ajout({ genre: "porte", ancrage: "fin", distance_cm: 20 });
  assert.equal(fin.ok, true);
  const centre = ajout({ ancrage: "centre", largeur_cm: 100 });
  assert.equal(centre.ok, true);
  assert.match(centre.comptesRendus[0], /au centre/);
  assert.match(ajout({ ancrage: "debut", distance_cm: 900 }).message, /ne tombe pas sur un seul mur/);
  assert.equal(appliquerCommandes(m, [{ action: "ajouter_ouverture", piece: "Séjour", cote: "nord", genre: "porte", ancrage: "debut", distance_cm: 30, largeur_cm: 100 }]).ok, false, "chevauche la fenetre n°1");
});

test("supprimer_ouverture, renommer_piece, modifier_mur", () => {
  const { m, ouv } = plan();
  const sup = appliquerCommandes(m, [{ action: "supprimer_ouverture", piece: "Séjour", cote: "sud", rang: 1 }]);
  assert.equal(sup.ok, true);
  assert.equal(ouvertureDe(sup.modele, ouv.porteSud), null);
  assert.match(sup.comptesRendus[0], /Porte n°1 supprimée, côté sud de « Séjour »/);
  const ren = appliquerCommandes(m, [{ action: "renommer_piece", piece: "Séjour", nouveau_nom: "Salon" }]);
  assert.equal(ren.modele.pieces.find((p) => p.id === m.pieces[0].id).nom, "Salon");
  assert.equal(appliquerCommandes(m, [{ action: "renommer_piece", piece: "Séjour", nouveau_nom: "Séjour" }]).ok, false);
  const mur = appliquerCommandes(m, [{ action: "modifier_mur", piece: "Séjour", cote: "nord", epaisseur_cm: 25 }]);
  assert.equal(mur.ok, true);
  assert.equal(murDe(mur.modele, "M1").epaisseur, 0.25);
  assert.equal(appliquerCommandes(m, [{ action: "modifier_mur", piece: "Séjour", cote: "nord", epaisseur_cm: 300 }]).ok, false);
  assert.match(appliquerCommandes(m, [{ action: "modifier_mur", piece: "Séjour", cote: "nord" }]).message, /Aucun changement/);
});

test("tout ou rien : si la 2e commande echoue, le plan est exactement celui d'avant ; trop de commandes et liste vide refusees", () => {
  const { m } = plan();
  const avant = copie(m);
  const r = appliquerCommandes(m, [
    { action: "renommer_piece", piece: "Séjour", nouveau_nom: "Salon" },
    { action: "supprimer_ouverture", piece: "Séjour", cote: "nord", rang: 9 }
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.index, 1);
  assert.deepEqual(m, avant);
  const trop = Array.from({ length: COMMANDES_MAX + 1 }, () => ({ action: "renommer_piece", piece: "Séjour", nouveau_nom: "X" }));
  assert.equal(appliquerCommandes(m, trop).ok, false);
  assert.equal(appliquerCommandes(m, []).ok, false);
  assert.equal(appliquerCommandes(m, null).ok, false);
});

test("les rangs ecrits par l'IA restent ceux du plan d'origine meme si une commande precedente retire une ouverture", () => {
  const { m, ouv } = plan();
  const r = appliquerCommandes(m, [
    { action: "supprimer_ouverture", piece: "Séjour", cote: "nord", rang: 1 },
    { action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 2, largeur_cm: 90 }
  ]);
  assert.equal(r.ok, true);
  assert.equal(ouvertureDe(r.modele, ouv.fen1), null);
  assert.equal(ouvertureDe(r.modele, ouv.fen2).largeur, 0.9, "la fenetre n°2 d'origine, pas la nouvelle n°2");
});
