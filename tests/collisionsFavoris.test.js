// Favoris et filtres de la liste des collisions (src/collisionsFavoris.js) : predicats purs, persistance protegee.
import test from "node:test";
import assert from "node:assert/strict";
import { creerDepotLocal } from "../src/quantitatifHistorique.js";
import {
  CLE_FAVORIS, FAVORIS_PAR_DEFAUT, FILTRES_COLLISIONS, estNouvelle, estEnCours, estUrgente, estResolue, estFavori, filtreValide,
  filtrerCollisions, compterSuivies, resoudreFavoris, basculerFavori
} from "../src/collisionsFavoris.js";

const c = (id, statut, priorite) => ({ id, statut, priorite });
const stockageMemoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

test("cle propre, distincte de l'etat des collisions", () => {
  assert.equal(CLE_FAVORIS, "ouvra-collisions-favoris");
});

test("les 4 favoris par defaut illustrent la demo : Nouveau n° 1 et 9, En cours n° 2 et 10 (les 11 autres collisions ne sont pas suivies)", () => {
  assert.deepEqual(FAVORIS_PAR_DEFAUT, [1, 9, 2, 10].map((n) => "hosp-clash-" + n));
});

test("predicats : nouvelle = nouveau, en cours = confirme, resolue = resolu, urgente = priorite urgente", () => {
  assert.equal(estNouvelle(c("a", "nouveau", "haute")), true);
  assert.equal(estNouvelle(c("a", "confirme", "haute")), false);
  assert.equal(estEnCours(c("a", "confirme", "basse")), true);
  assert.equal(estEnCours(c("a", "nouveau", "basse")), false);
  assert.equal(estResolue(c("a", "resolu", "basse")), true);
  assert.equal(estResolue(c("a", "ecarte", "basse")), false);
  assert.equal(estUrgente(c("a", "nouveau", "urgente")), true);
  assert.equal(estUrgente(c("a", "nouveau", "haute")), false);
});

test("predicats : entree vide ou invalide ne plante pas et renvoie faux", () => {
  [null, undefined, {}, "x", 3].forEach((v) => {
    assert.equal(estNouvelle(v), false);
    assert.equal(estEnCours(v), false);
    assert.equal(estUrgente(v), false);
    assert.equal(estResolue(v), false);
    assert.equal(estFavori(v, new Set(["a"])), false);
  });
  assert.equal(estFavori(c("a"), null), false);
});

test("favori : appartenance de l'identifiant a l'ensemble", () => {
  assert.equal(estFavori(c("a"), new Set(["a"])), true);
  assert.equal(estFavori(c("b"), new Set(["a"])), false);
});

test("filtres : cinq puces dans l'ordre Nouvelles, En cours, Urgentes, Resolues, Favoris", () => {
  assert.deepEqual(FILTRES_COLLISIONS.map((f) => f.id), ["nouvelles", "en-cours", "urgentes", "resolues", "favoris"]);
  assert.deepEqual(FILTRES_COLLISIONS.map((f) => f.libelle), ["Nouvelles", "En cours", "Urgentes", "Résolues", "Favoris"]);
  assert.equal(filtreValide("favoris"), true);
  assert.equal(filtreValide("toutes"), false);
  assert.equal(filtreValide(null), false);
});

test("filtrerCollisions : chaque filtre, sans filtre tout, filtre inconnu tout, liste vide", () => {
  const liste = [c("1", "nouveau", "urgente"), c("2", "confirme", "haute"), c("3", "resolu", "basse"), c("4", "ecarte", "normale")];
  const favoris = new Set(["2", "3"]);
  const ids = (f) => filtrerCollisions(liste, f, favoris).map((x) => x.id);
  // Un filtre de statut ou de priorite ne garde que les collisions suivies : la 1 (nouvelle, urgente) n'est pas favorite, elle n'apparait pas.
  assert.deepEqual(ids("nouvelles"), []);
  assert.deepEqual(ids("en-cours"), ["2"]);
  assert.deepEqual(ids("urgentes"), []);
  assert.deepEqual(ids("resolues"), ["3"]);
  assert.deepEqual(ids("favoris"), ["2", "3"]);
  assert.deepEqual(ids(null), ["1", "2", "3", "4"]);
  assert.deepEqual(ids("inconnu"), ["1", "2", "3", "4"]);
  assert.deepEqual(filtrerCollisions([], "favoris", favoris), []);
  assert.deepEqual(filtrerCollisions(null, "favoris", favoris), []);
});

test("resoudreFavoris : sans rien d'enregistre, les favoris par defaut", () => {
  assert.deepEqual([...resoudreFavoris([])], FAVORIS_PAR_DEFAUT);
  assert.deepEqual([...resoudreFavoris(null)], FAVORIS_PAR_DEFAUT);
});

test("resoudreFavoris : un choix enregistre l'emporte sur le defaut, les entrees invalides sont ignorees", () => {
  const set = resoudreFavoris([{ id: "hosp-clash-1", favori: false }, { id: "hosp-clash-7", favori: true }, null, { id: 5, favori: true }, { favori: true }, "x"]);
  assert.equal(set.has("hosp-clash-1"), false);
  assert.equal(set.has("hosp-clash-7"), true);
  assert.equal(set.has("hosp-clash-2"), true);
  assert.equal(set.size, FAVORIS_PAR_DEFAUT.length);
});

test("basculerFavori : ajoute, retire, ne mute pas, garde un choix explicite pour un favori par defaut retire", () => {
  const vide = [];
  const apres = basculerFavori(vide, "hosp-clash-7");
  assert.deepEqual(vide, []);
  assert.equal(resoudreFavoris(apres).has("hosp-clash-7"), true);
  const retire = basculerFavori(apres, "hosp-clash-1");
  assert.equal(resoudreFavoris(retire).has("hosp-clash-1"), false);
  const remis = basculerFavori(retire, "hosp-clash-1");
  assert.equal(resoudreFavoris(remis).has("hosp-clash-1"), true);
  assert.equal(remis.filter((e) => e.id === "hosp-clash-1").length, 1);
  assert.deepEqual(basculerFavori(null, "x"), [{ id: "x", favori: true }]);
  assert.deepEqual(basculerFavori([], ""), []);
});

test("persistance sur le depot local : aller-retour, JSON corrompu et stockage absent", () => {
  const s = stockageMemoire();
  const depot = creerDepotLocal(s, CLE_FAVORIS);
  assert.deepEqual([...resoudreFavoris(depot.lire())], FAVORIS_PAR_DEFAUT);
  assert.equal(depot.ecrire(basculerFavori(depot.lire(), "hosp-clash-1")), true);
  assert.equal(resoudreFavoris(depot.lire()).has("hosp-clash-1"), false);
  s.setItem(CLE_FAVORIS, "{pas du json");
  assert.deepEqual([...resoudreFavoris(depot.lire())], FAVORIS_PAR_DEFAUT);
  const sansStockage = creerDepotLocal({ getItem() { throw new Error("bloque"); }, setItem() { throw new Error("plein"); } }, CLE_FAVORIS);
  assert.deepEqual([...resoudreFavoris(sansStockage.lire())], FAVORIS_PAR_DEFAUT);
  assert.equal(sansStockage.ecrire([]), false);
});

test("compteurs de Mon espace : sur les 15 collisions de l'hopital et les favoris par defaut, 2 Nouvelles, 2 En cours, 1 Urgente, 0 Resolue ; l'etoile ajoutee ou retiree change le compteur, et le clic liste exactement ces collisions", async () => {
  const { HOSPITAL_CLASHES } = await import("../src/clashesHospital.js");
  const depot = creerDepotLocal(stockageMemoire(), CLE_FAVORIS);
  const effectifs = () => compterSuivies(HOSPITAL_CLASHES, resoudreFavoris(depot.lire()));
  assert.deepEqual(effectifs(), { nouvelles: 2, "en-cours": 2, urgentes: 1, resolues: 0 });
  // Retrait d'une etoile « Nouveau » (n° 1) : 1 Nouvelle, et la liste filtree ne contient plus la collision.
  depot.ecrire(basculerFavori(depot.lire(), "hosp-clash-1"));
  assert.equal(effectifs().nouvelles, 1);
  const liste = (f) => filtrerCollisions(HOSPITAL_CLASHES, f, resoudreFavoris(depot.lire())).map((x) => x.id);
  assert.equal(liste("nouvelles").length, 1);
  assert.equal(liste("nouvelles").includes("hosp-clash-1"), false);
  // Retrait de l'etoile de la n° 10 (seule Urgente, En cours) : 0 Urgente, 1 En cours.
  depot.ecrire(basculerFavori(depot.lire(), "hosp-clash-10"));
  assert.deepEqual([effectifs().urgentes, effectifs()["en-cours"]], [0, 1]);
  // Etoile ajoutee sur une ecartee (n° 7) : aucun compteur ne bouge (ni Nouveau, ni En cours, ni Resolu).
  const avant = effectifs();
  depot.ecrire(basculerFavori(depot.lire(), "hosp-clash-7"));
  assert.deepEqual(effectifs(), avant);
  // Chaque effectif est exactement la longueur de la liste ouverte par le compteur correspondant.
  for (const id of ["nouvelles", "en-cours", "urgentes", "resolues"]) assert.equal(liste(id).length, effectifs()[id], id);
});
