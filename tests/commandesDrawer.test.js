// Tests du calcul des cases du drawer apres une commande (src/commandesDrawer.js) : fonctions pures.
import test from "node:test";
import assert from "node:assert/strict";
import { etatDrawerDepuisVisibles, capturerEtatDrawer } from "../src/commandesDrawer.js";

const idsParMaquette = { mep: ["m1", "m2", "m3"], arch: ["a1", "a2", "a3"] };
const niveaux = [
  { name: "Level 1", objectsByMaquette: { mep: ["m1"], arch: ["a1"] } },
  { name: "Level 2", objectsByMaquette: { mep: ["m2"], arch: ["a2"] } },
  { name: "Level 3", objectsByMaquette: { mep: ["m3"], arch: ["a3"] } }
];

test("gaines du niveau 2 : seule la maquette qui garde un element visible et le niveau 2 restent coches", () => {
  const r = etatDrawerDepuisVisibles({ idsParMaquette, niveaux, visibles: new Set(["m2"]) });
  assert.deepEqual([...r.maquettes], [["mep", true], ["arch", false]]);
  assert.deepEqual([...r.niveaux], [["Level 1", false], ["Level 2", true], ["Level 3", false]]);
});

test("niveau 3 seul : les deux maquettes restent cochees, un seul niveau", () => {
  const r = etatDrawerDepuisVisibles({ idsParMaquette, niveaux, visibles: ["m3", "a3"] });
  assert.deepEqual([...r.maquettes], [["mep", true], ["arch", true]]);
  assert.deepEqual([...r.niveaux], [["Level 1", false], ["Level 2", false], ["Level 3", true]]);
});

test("maquette Mecanique seule : tous ses niveaux sont coches, ceux de l'autre maquette n'ajoutent rien", () => {
  const r = etatDrawerDepuisVisibles({ idsParMaquette, niveaux, visibles: new Set(["m1", "m2", "m3"]) });
  assert.deepEqual([...r.maquettes], [["mep", true], ["arch", false]]);
  assert.deepEqual([...r.niveaux.values()], [true, true, true]);
});

test("rien de visible : tout est decoche ; tout visible : tout est coche", () => {
  const rien = etatDrawerDepuisVisibles({ idsParMaquette, niveaux, visibles: new Set() });
  assert.deepEqual([...rien.maquettes.values(), ...rien.niveaux.values()], [false, false, false, false, false]);
  const tout = etatDrawerDepuisVisibles({ idsParMaquette, niveaux, visibles: new Set([...idsParMaquette.mep, ...idsParMaquette.arch]) });
  assert.deepEqual([...tout.maquettes.values(), ...tout.niveaux.values()], [true, true, true, true, true]);
});

test("entrees incompletes : pas d'erreur (Map, niveau sans objets, aucun niveau)", () => {
  const r = etatDrawerDepuisVisibles({ idsParMaquette: new Map([["mep", ["m1"]]]), niveaux: [{ name: "Toiture" }], visibles: ["m1"] });
  assert.equal(r.maquettes.get("mep"), true);
  assert.equal(r.niveaux.get("Toiture"), false);
  assert.equal(etatDrawerDepuisVisibles({ visibles: [] }).maquettes.size, 0);
});

test("capturerEtatDrawer : photo des cases, independante des objets d'origine", () => {
  const maquettes = [{ id: "mep", shown: true }, { id: "arch", shown: false }];
  const niv = [{ name: "Level 1", checked: false }];
  const photo = capturerEtatDrawer({ maquettes, niveaux: niv });
  maquettes[0].shown = false;
  niv[0].checked = true;
  assert.deepEqual([...photo.maquettes], [["mep", true], ["arch", false]]);
  assert.deepEqual([...photo.niveaux], [["Level 1", false]]);
});

// Cadrage de la camera apres une commande IA : boite des seuls elements visibles.
import { boiteDesVisibles } from "../src/commandesDrawer.js";

test("boiteDesVisibles : niveau 3 seul sur la maquette Structure -> boite des seuls elements visibles", () => {
  const appels = [];
  const getAABB = (ids) => { appels.push(ids); return [0, 6, 0, 10, 9, 10]; };
  assert.deepEqual(boiteDesVisibles(["s3a", "s3b"], getAABB), [0, 6, 0, 10, 9, 10]);
  assert.deepEqual(appels, [["s3a", "s3b"]]);
});

test("boiteDesVisibles : rien de visible -> null, sans interroger la scene", () => {
  const getAABB = () => { throw new Error("ne doit pas etre appele"); };
  assert.equal(boiteDesVisibles([], getAABB), null);
  assert.equal(boiteDesVisibles(undefined, getAABB), null);
});

test("boiteDesVisibles : boite non finie, incomplete ou inversee -> null", () => {
  assert.equal(boiteDesVisibles(["a"], () => [0, 0, 0, Infinity, 1, 1]), null);
  assert.equal(boiteDesVisibles(["a"], () => [0, 0, NaN, 1, 1, 1]), null);
  assert.equal(boiteDesVisibles(["a"], () => [0, 0, 0, 1, 1]), null);
  assert.equal(boiteDesVisibles(["a"], () => null), null);
  assert.equal(boiteDesVisibles(["a"], () => [5, 0, 0, 1, 1, 1]), null);
});

test("boiteDesVisibles : accepte le Float64Array rendu par xeokit (sinon le cadrage tombait sur « Recentrer », retour 9)", () => {
  assert.deepEqual(boiteDesVisibles(["a"], () => new Float64Array([0, 1, 2, 3, 4, 5])), [0, 1, 2, 3, 4, 5]);
  assert.equal(boiteDesVisibles(["a"], () => new Float64Array([0, 1, 2, NaN, 4, 5])), null);
});
