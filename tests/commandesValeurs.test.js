// Tests de ce qui part vers le relais /api/commande (src/commandesValeurs.js) : des mots seulement, niveaux regroupes comme dans le drawer.
import test from "node:test";
import assert from "node:assert/strict";
import { valeursPourCommande, niveauxCanoniques, retirerMotsDeCommande, nomsParNumero, borner } from "../src/commandesValeurs.js";

function metaSceneDe(objets) {
  const metaObjects = {};
  objets.forEach(([id, type, name, parent, maquette]) => { metaObjects[id] = { id, type, name, parent: parent ? metaObjects[parent] : null, metaModels: [{ id: maquette }] }; });
  return { metaObjects };
}
const maquettes = [{ id: "mep", label: "Mechanical (CVC)" }, { id: "arch", label: "Architecture" }];
const meta = metaSceneDe([
  ["s1", "IfcBuildingStorey", "Level 1", null, "mep"],
  ["s2", "IfcBuildingStorey", "Level 2", null, "mep"],
  ["s2c", "IfcBuildingStorey", "Level 2 Ceiling", null, "mep"],
  ["s2a", "IfcBuildingStorey", "Level 2", null, "arch"],
  ["g1", "IfcDuctSegment", "Rectangular Duct:Mitered Elbows:100", "s2", "mep"],
  ["m1", "IfcWallStandardCase", "Basic Wall:Generic 200mm:200", "s2a", "arch"],
  ["site", "IfcSite", "Site", null, "mep"]
]);

test("valeurs : types sans les types spatiaux, niveaux regroupes, maquettes presentes, aucune priorite ni statut", () => {
  const v = valeursPourCommande(meta, maquettes, "Affiche-moi les gaines au niveau 2");
  assert.deepEqual(v.typesIfc, ["IfcDuctSegment", "IfcWallStandardCase"]);
  assert.deepEqual(v.niveaux, ["Level 1", "Level 2"]);
  assert.deepEqual(v.maquettes, ["Architecture", "Mechanical (CVC)"]);
  assert.deepEqual(Object.keys(v).sort(), ["maquettes", "niveaux", "noms", "typesIfc", "zones"]);
});

test("valeurs : les zones nommees passent telles quelles (que des noms)", () => {
  assert.deepEqual(valeursPourCommande(meta, maquettes, "Affiche la zone Bloc", ["Bloc opératoire"]).zones, ["Bloc opératoire"]);
});

test("valeurs : les noms proches viennent des mots de la phrase, pas des mots d'ordre", () => {
  const v = valeursPourCommande(meta, maquettes, "Affiche uniquement duct");
  assert.ok(v.noms.some((n) => /Duct/i.test(n)));
  assert.deepEqual(valeursPourCommande(meta, maquettes, "Affiche-moi tout, montre").noms, []);
});

test("valeurs : scene absente ou vide = listes vides, sans exception", () => {
  for (const vide of [null, undefined, {}, { metaObjects: {} }]) {
    const v = valeursPourCommande(vide, maquettes, "gaines");
    assert.deepEqual(v, { typesIfc: [], niveaux: [], maquettes: [], noms: [], zones: [] });
  }
});

test("niveauxCanoniques : regroupement, doublons, ordre numerique, entrees vides", () => {
  assert.deepEqual(niveauxCanoniques(["Level 10", "Level 2 TOS", "Level 2", "Level 2 Ceiling", "Level 7A", "Level 7", ""]), ["Level 2", "Level 7", "Level 10"]);
  assert.deepEqual(niveauxCanoniques(null), []);
});

test("retirerMotsDeCommande : garde les mots de contenu, sans accents ni ponctuation", () => {
  assert.equal(retirerMotsDeCommande("Mets en évidence les faux plafonds du niveau 1"), "en faux plafonds du 1");
  assert.equal(retirerMotsDeCommande(""), "");
});

test("valeurs : un numero cite dans la phrase fait remonter le nom complet de l'element (avec son numero Revit)", () => {
  const metaScene = { metaObjects: {
    a: { id: "a", type: "IfcValve", name: "M_Ball Valve:15 mm:1165462", parent: null, metaModels: [{ id: "hosp-mep" }] },
    b: { id: "b", type: "IfcValve", name: "M_Ball Valve:15 mm:1165489", parent: null, metaModels: [{ id: "hosp-mep" }] }
  } };
  assert.deepEqual(nomsParNumero(metaScene, "Montre-moi la vanne 1165462"), ["M_Ball Valve:15 mm:1165462"]);
  assert.deepEqual(nomsParNumero(metaScene, "niveau 2"), [], "pas de numero de 4 chiffres : rien");
  assert.equal(valeursPourCommande(metaScene, maquettes, "Montre-moi la vanne 1165462").noms[0], "M_Ball Valve:15 mm:1165462");
});

test("valeurs : bornees comme le relais (listes plafonnees, valeur trop longue ecartee), jamais une requete entierement refusee", () => {
  const trop = (n) => Array.from({ length: n }, (_, i) => "v" + i);
  const b = borner({ typesIfc: trop(60), niveaux: [], maquettes: ["a".repeat(81), "ok"], noms: [...trop(30), "n".repeat(161)], zones: trop(40) });
  assert.equal(b.typesIfc.length, 40);
  assert.deepEqual(b.maquettes, ["ok"]);
  assert.equal(b.noms.length, 15);
  assert.equal(b.zones.length, 30);
  assert.deepEqual(borner({}), { typesIfc: [], niveaux: [], maquettes: [], noms: [], zones: [] });
});

test("valeurs : un nom de plus de 160 caracteres cite par son numero n'est pas envoye", () => {
  const long = "F".repeat(170) + ":1234567";
  const metaScene = { metaObjects: { a: { id: "a", type: "IfcValve", name: long, parent: null, metaModels: [] } } };
  assert.deepEqual(nomsParNumero(metaScene, "vanne 1234567"), []);
});
