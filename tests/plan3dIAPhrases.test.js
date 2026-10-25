// 2D -> 3D, IA du plan (25/10) : jeu de phrases traduites en commandes (traducteur simule, aucun reseau) et appliquees par le moteur.
// Chaque ligne = une phrase de l'utilisateur, les commandes que l'IA devrait en tirer, et le resultat attendu du moteur.
// Invariants controles sur TOUTES les lignes : un refus laisse le plan strictement identique ; un succes rend un modele valide.
import test from "node:test";
import assert from "node:assert/strict";
import { creerModeleVide, ajouterNoeud, ajouterMur, ajouterOuverture, ajouterPiece, modifierOuverture, validerModele } from "../src/plan3d/modele.js";
import { appliquerCommandes } from "../src/plan3d/ia/commandesPlan.js";

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

const S = "Séjour", C = "Chambre";
const mod = (extra, piece = S, cote = "nord", rang = 1) => ({ action: "modifier_ouverture", piece, cote, rang, ...extra });
const ajout = (extra, piece = S, cote = "nord") => ({ action: "ajouter_ouverture", piece, cote, genre: "fenetre", ...extra });
const sup = (piece, cote, rang) => ({ action: "supprimer_ouverture", piece, cote, rang });
const mur = (extra, piece = S, cote = "nord") => ({ action: "modifier_mur", piece, cote, ...extra });

// [phrase, commandes, ok attendu]
const PHRASES = [
  ["La première fenêtre nord du séjour fait 130 de large", [mod({ largeur_cm: 130 })], true],
  ["Elle fait 1,40 m de haut", [mod({ hauteur_cm: 140 })], true],
  ["Mets l'allège à 80", [mod({ allege_cm: 80 })], true],
  ["La fenêtre nord 1 est en fait une porte", [mod({ genre: "porte" })], true],
  ["La fenêtre nord 1 est une baie coulissante", [mod({ genre: "coulissante", largeur_cm: 200 })], true],
  ["Descends la fenêtre jusqu'au sol", [mod({ allege_cm: 1, hauteur_cm: 210 })], true],
  ["La deuxième fenêtre du nord passe à 110", [mod({ largeur_cm: 110 }, S, "nord", 2)], true],
  ["La fenêtre fait moins 50", [mod({ largeur_cm: -50 })], false],
  ["La fenêtre fait zéro de large", [mod({ largeur_cm: 0 })], false],
  ["Fais-la plus large (sans valeur)", [mod({})], false],
  ["La fenêtre fait 10 mètres", [mod({ largeur_cm: 1000 })], false],
  ["Elle fait 5 m de haut", [mod({ hauteur_cm: 500 })], false],
  ["La troisième fenêtre du nord du séjour", [mod({ largeur_cm: 100 }, S, "nord", 3)], false],
  ["La fenêtre ouest du séjour (il n'y en a pas)", [mod({ largeur_cm: 100 }, S, "ouest", 1)], false],
  ["La fenêtre du salon (pièce qui n'existe pas)", [mod({ largeur_cm: 100 }, "Salon")], false],
  ["La fenêtre du côté nord-est", [mod({ largeur_cm: 100 }, S, "nord-est")], false],
  ["Ajoute une fenêtre au nord de la chambre", [ajout({ ancrage: "centre" }, C)], true],
  ["Ajoute une fenêtre de 80 au nord de la chambre, à 50 du début", [ajout({ largeur_cm: 80, ancrage: "debut", distance_cm: 50 }, C)], true],
  ["Ajoute une porte au sud de la chambre, à 40 de la fin", [ajout({ genre: "porte", ancrage: "fin", distance_cm: 40 }, C, "sud")], true],
  ["Ajoute une porte coulissante au sud de la chambre", [ajout({ genre: "coulissante", largeur_cm: 160, ancrage: "centre" }, C, "sud")], true],
  ["Ajoute une baie coulissante de 160 là où est la fenêtre est", [ajout({ genre: "coulissante", largeur_cm: 160, ancrage: "centre" }, C, "est")], false],
  ["Ajoute une porte tout au bout du mur (distance nulle donnée comme absente)", [ajout({ genre: "porte", ancrage: "debut", distance_cm: null }, C)], true],
  ["Ajoute une porte à 0 cm du bord (zéro refusé : la distance absente le dit)", [ajout({ genre: "porte", ancrage: "debut", distance_cm: 0 }, C)], false],
  ["Ajoute une fenêtre là où il y en a déjà une", [ajout({ largeur_cm: 100, ancrage: "debut", distance_cm: 30 })], false],
  ["Ajoute une fenêtre de 20 mètres", [ajout({ largeur_cm: 2000, ancrage: "centre" }, C)], false],
  ["Ajoute une fenêtre à 10 mètres du début", [ajout({ ancrage: "debut", distance_cm: 1000 }, C)], false],
  ["Ajoute un portail (genre inconnu)", [ajout({ genre: "portail", ancrage: "centre" }, C)], false],
  ["Supprime la fenêtre sud 1 du séjour (c'est une porte)", [sup(S, "sud", 1)], true],
  ["Supprime la première fenêtre nord", [sup(S, "nord", 1)], true],
  ["Supprime la fenêtre est de la chambre", [sup(C, "est", 1)], true],
  ["Supprime la quatrième fenêtre du nord", [sup(S, "nord", 4)], false],
  ["Supprime la porte du côté ouest du séjour (aucune ouverture)", [sup(S, "ouest", 1)], false],
  ["Renomme le séjour en salon", [{ action: "renommer_piece", piece: S, nouveau_nom: "Salon" }], true],
  ["Renomme le séjour en séjour", [{ action: "renommer_piece", piece: S, nouveau_nom: "Séjour" }], false],
  ["Renomme la chambre avec un nom vide", [{ action: "renommer_piece", piece: C, nouveau_nom: "   " }], false],
  ["Renomme la chambre avec un nom de 80 caractères", [{ action: "renommer_piece", piece: C, nouveau_nom: "x".repeat(80) }], false],
  ["Renomme la cuisine (n'existe pas)", [{ action: "renommer_piece", piece: "Cuisine", nouveau_nom: "Cuisinette" }], false],
  ["Le mur nord du séjour fait 25 d'épaisseur", [mur({ epaisseur_cm: 25 })], true],
  ["Le mur de la cloison est intérieur", [mur({ type: "interieur" }, S, "est")], true],
  ["Le mur nord devient extérieur, 30 cm", [mur({ epaisseur_cm: 30, type: "exterieur" })], true],
  ["Le mur nord fait 2 cm", [mur({ epaisseur_cm: 2 })], false],
  ["Le mur nord fait 1 mètre", [mur({ epaisseur_cm: 100 })], false],
  ["Change le mur nord (sans dire comment)", [mur({})], false],
  ["Fenêtre nord à 130 puis renomme en salon", [mod({ largeur_cm: 130 }), { action: "renommer_piece", piece: S, nouveau_nom: "Salon" }], true],
  ["Trois changements dans une phrase", [mod({ largeur_cm: 125 }), mur({ epaisseur_cm: 22 }), ajout({ ancrage: "centre" }, C)], true],
  ["Deuxième commande impossible : rien ne change", [mod({ largeur_cm: 130 }), mod({ largeur_cm: 130 }, S, "ouest", 1)], false],
  ["Sept modifications d'un coup", Array.from({ length: 7 }, () => mur({ epaisseur_cm: 22 })), false],
  ["Aucune commande", [], false],
  ["Action inconnue", [{ action: "deplacer_mur", piece: S, cote: "nord" }], false],
  ["Commande mal formée", ["n'importe quoi"], false]
];

for (const [phrase, commandes, attendu] of PHRASES) {
  test(`phrase : ${phrase}`, () => {
    const { m } = plan();
    const avant = copie(m);
    const r = appliquerCommandes(m, commandes);
    assert.equal(r.ok, attendu, r.message || (r.comptesRendus || []).join(" "));
    assert.deepEqual(m, avant, "le modèle reçu n'est jamais modifié");
    if (attendu) {
      assert.equal(validerModele(r.modele).valide, true, JSON.stringify(validerModele(r.modele).erreurs));
      assert.equal(r.comptesRendus.length, commandes.length);
    } else {
      assert.equal(typeof r.message, "string");
      assert.ok(r.message.length > 0);
    }
  });
}

test("le jeu de phrases couvre au moins 40 cas", () => {
  assert.ok(PHRASES.length >= 40, `${PHRASES.length} phrases`);
});
