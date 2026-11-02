// Favoris et filtres de la liste des collisions (src/collisionsFavoris.js) : predicats purs, persistance protegee.
import test from "node:test";
import assert from "node:assert/strict";
import { creerDepotLocal } from "../src/quantitatifHistorique.js";
import {
  CLE_FAVORIS, FAVORIS_PAR_DEFAUT, FILTRES_COLLISIONS, estNouvelle, estEnCours, estUrgente, estResolue, estFavori, filtreValide,
  filtrerCollisions, resoudreFavoris, basculerFavori
} from "../src/collisionsFavoris.js";

const c = (id, statut, priorite) => ({ id, statut, priorite });
const stockageMemoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

test("cle propre, distincte de l'etat des collisions", () => {
  assert.equal(CLE_FAVORIS, "ouvra-collisions-favoris");
});

test("les 9 favoris par defaut sont les collisions Nouveau n° 1, 3, 4, 6, 9, 11, 12, 13, 14", () => {
  assert.deepEqual(FAVORIS_PAR_DEFAUT, [1, 3, 4, 6, 9, 11, 12, 13, 14].map((n) => "hosp-clash-" + n));
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
  assert.deepEqual(ids("nouvelles"), ["1"]);
  assert.deepEqual(ids("en-cours"), ["2"]);
  assert.deepEqual(ids("urgentes"), ["1"]);
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
  const set = resoudreFavoris([{ id: "hosp-clash-1", favori: false }, { id: "hosp-clash-2", favori: true }, null, { id: 5, favori: true }, { favori: true }, "x"]);
  assert.equal(set.has("hosp-clash-1"), false);
  assert.equal(set.has("hosp-clash-2"), true);
  assert.equal(set.has("hosp-clash-3"), true);
  assert.equal(set.size, FAVORIS_PAR_DEFAUT.length);
});

test("basculerFavori : ajoute, retire, ne mute pas, garde un choix explicite pour un favori par defaut retire", () => {
  const vide = [];
  const apres = basculerFavori(vide, "hosp-clash-2");
  assert.deepEqual(vide, []);
  assert.equal(resoudreFavoris(apres).has("hosp-clash-2"), true);
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
