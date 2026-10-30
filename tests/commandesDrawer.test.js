// Tests du calcul des cases du drawer apres une commande (src/commandesDrawer.js) : fonctions pures.
import test from "node:test";
import assert from "node:assert/strict";
import { etatDrawerDepuisVisibles, capturerEtatDrawer } from "../src/commandesDrawer.js";
import { readFileSync } from "node:fs";

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

// « Recentrer » apres une commande IA (30/10) : avec une partie seulement des maquettes cochees, il cadrait la boite des FICHIERS cochees (batiment entier) et non celle des
// elements visibles : le niveau 2, cadre a ~90 % de la largeur par l'IA, reculait a ~40 % au clic.
import { boiteARecentrer } from "../src/commandesDrawer.js";
import { cadrerCentre, mesurerCadrage } from "../src/cadrageCentre.js";

const HOPITAL_VUE = { eye: [-2.8, 213.7, -18.2], look: [16.4, 190.6, -48.7], up: [0.287, 0.842, -0.457] };
const BOITE_MAQUETTES = [-12, 159, -163, 90, 204, 0]; // batiment entier (maquettes cochees)
const BOITE_NIVEAU_2 = [-12, 170, -140, 87, 172, -45]; // elements visibles du niveau 2

const part = (m, l, h) => Math.max(1 - (m.margeGauche + m.margeDroite) / l, 1 - (m.margeHaut + m.margeBas) / h);

test("boiteARecentrer : un niveau affiche -> boite des elements visibles, pas celle des fichiers cochees", () => {
  assert.deepEqual(boiteARecentrer(BOITE_MAQUETTES, ["n2a", "n2b"], () => BOITE_NIVEAU_2), BOITE_NIVEAU_2);
});

test("boiteARecentrer : rien de visible ou boite invalide -> boite des maquettes (comportement d'avant)", () => {
  assert.deepEqual(boiteARecentrer(BOITE_MAQUETTES, [], () => BOITE_NIVEAU_2), BOITE_MAQUETTES);
  assert.deepEqual(boiteARecentrer(BOITE_MAQUETTES, ["a"], () => [0, 0, 0, Infinity, 1, 1]), BOITE_MAQUETTES);
});

for (const [largeur, hauteur] of [[1440, 800], [390, 748]]) {
  test("boiteARecentrer : le niveau reste serre au clic sur Recentrer (plus de 80 % contre ~40 % avant), " + largeur + "x" + hauteur, () => {
    const boite = boiteARecentrer(BOITE_MAQUETTES, ["n2a"], () => BOITE_NIVEAU_2);
    const m = mesurerCadrage({ aabb: BOITE_NIVEAU_2, ...cadrerCentre({ aabb: boite, ...HOPITAL_VUE, largeur, hauteur }), largeur, hauteur });
    assert.ok(part(m, largeur, hauteur) > 0.8, "part " + part(m, largeur, hauteur));
  });
}

test("main.js : « Recentrer » sur des maquettes cochees cadre les elements visibles avec l'affinage de la commande IA", () => {
  const js = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const corps = js.slice(js.indexOf("function recentrerSurMaquettes"), js.indexOf("recenterBtn.addEventListener"));
  assert.match(corps, /boiteARecentrer\(/);
  assert.match(corps, /poseIACadree\(/);
});
