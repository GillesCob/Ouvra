// Tests du calcul des valeurs permises et de la recherche prealable des noms proches (src/reglesValeurs.js) : ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { valeursPourIA, nomsProches } from "../src/reglesValeurs.js";

function fabriquerScene(elements) {
  const metaObjects = {};
  elements.forEach((e, i) => {
    metaObjects[e.id || "o" + i] = { id: e.id || "o" + i, name: e.name, type: e.type, parent: e.parent || null, metaModels: [{ id: e.modele || "hosp-arch" }] };
  });
  return { metaObjects };
}
const maquettes = [{ id: "hosp-arch", label: "Architecture" }, { id: "hosp-mep", label: "Mechanical (CVC)" }, { id: "hosp-elec", label: "Electrique" }];
const action = { priorite: ["urgente", "haute", "normale", "basse"], statut: ["nouveau", "confirme", "ecarte"] };
const scene = fabriquerScene([
  { name: "Projet", type: "IfcProject" },
  { name: "Site", type: "IfcSite" },
  { name: "Level 1", type: "IfcBuildingStorey" },
  { name: "Level 2", type: "IfcBuildingStorey" },
  { name: "Basic Wall:Exterior - Limestone:186972", type: "IfcWallStandardCase" },
  { name: "Basic Wall:Exterior - Limestone:187165", type: "IfcWallStandardCase" },
  { name: "Diffuser:Supply Diffuser:555001", type: "IfcBuildingElementProxy", modele: "hosp-mep" },
  { name: "Diffuser:Supply Diffuser:555002", type: "IfcBuildingElementProxy", modele: "hosp-mep" },
  { name: "M_Round Duct:Standard:600100", type: "IfcDuctSegment", modele: "hosp-mep" },
  { name: "Compound Ceiling:Plafond acoustique:700200", type: "IfcCovering" }
]);

test("valeurs : types sans les types spatiaux, niveaux des etages, maquettes chargees seulement, actions telles quelles", () => {
  const v = valeursPourIA(scene, maquettes, "x", action);
  assert.deepEqual(v.typesIfc, ["IfcBuildingElementProxy", "IfcCovering", "IfcDuctSegment", "IfcWallStandardCase"]);
  assert.deepEqual(v.niveaux, ["Level 1", "Level 2"]);
  assert.deepEqual(v.maquettes, ["Architecture", "Mechanical (CVC)"]);
  assert.deepEqual(v.priorite, action.priorite);
  assert.deepEqual(v.statut, action.statut);
});

test("noms : suffixe numerique retire, doublons fusionnes, proches de la phrase seulement", () => {
  const n = nomsProches(scene, "Ecarte les collisions avec un diffuseur", 15);
  assert.ok(n.includes("Diffuser:Supply Diffuser"));
  assert.equal(n.filter((x) => x === "Diffuser:Supply Diffuser").length, 1);
  assert.equal(n.some((x) => /Wall|Duct|Ceiling/.test(x)), false);
});

test("noms : le MOT present dans les noms est propose en premier (le critere « nom » cherche une sous-chaine : « Diffuser » vise tous les diffuseurs)", () => {
  const variees = fabriquerScene([
    { name: "M_Supply Diffuser:600 x 600 Face:1", type: "IfcBuildingElementProxy" },
    { name: "M_Return Diffuser:300 x 300:2", type: "IfcBuildingElementProxy" },
    { name: "M_Exhaust Diffuser:Round:3", type: "IfcBuildingElementProxy" }
  ]);
  const n = nomsProches(variees, "ecarte les diffuseurs", 15);
  assert.equal(n[0], "Diffuser");
  assert.ok(n.includes("M_Return Diffuser:300 x 300"));
  assert.ok(n.length <= 15);
});

test("noms : un mot sans correspondance ne ramene rien", () => {
  assert.deepEqual(nomsProches(scene, "Passe en urgent les radiateurs", 15), []);
});

test("noms : phrase vide ou faite de mots vides", () => {
  assert.deepEqual(nomsProches(scene, "", 15), []);
  assert.deepEqual(nomsProches(scene, "les collisions des", 15), []);
});

test("noms : accents et casse sans effet", () => {
  assert.ok(nomsProches(scene, "PLAFOND acoustique", 15).includes("Compound Ceiling:Plafond acoustique"));
  assert.ok(nomsProches(scene, "plafónd", 15).includes("Compound Ceiling:Plafond acoustique"));
});

test("noms : types spatiaux jamais proposes comme noms", () => {
  assert.deepEqual(nomsProches(scene, "level site projet", 15), []);
});

test("noms : plafond du nombre de resultats, les mieux classes d'abord", () => {
  const beaucoup = fabriquerScene(Array.from({ length: 60 }, (_, i) => ({ name: "Famille gaine:Type " + i + ":" + (1000 + i), type: "IfcDuctSegment" })));
  assert.equal(nomsProches(beaucoup, "gaine", 15).length, 15);
  const classes = fabriquerScene([
    { name: "Gaine ronde:Standard:1", type: "IfcDuctSegment" },
    { name: "Gaine isolee rectangulaire:Standard:2", type: "IfcDuctSegment" }
  ]);
  assert.equal(nomsProches(classes, "gaine isolee", 1)[0], "Gaine isolee rectangulaire:Standard");
});

test("noms : un nom de plus de 160 caracteres n'est pas envoye", () => {
  const long = fabriquerScene([{ name: "Gaine" + "x".repeat(200) + ":1", type: "IfcDuctSegment" }]);
  assert.deepEqual(nomsProches(long, "gaine", 15), []);
});

test("scene absente ou vide : listes vides, pas d'exception", () => {
  for (const s of [null, undefined, {}, { metaObjects: {} }]) {
    const v = valeursPourIA(s, maquettes, "gaine", action);
    assert.deepEqual([v.typesIfc, v.niveaux, v.maquettes, v.noms], [[], [], [], []]);
  }
});

test("aucune geometrie : seules des listes de textes sont produites", () => {
  const v = valeursPourIA(scene, maquettes, "gaine", action);
  for (const liste of Object.values(v)) assert.ok(liste.every((x) => typeof x === "string"));
});

test("performance : 30 000 elements, index reutilise a la 2e recherche", () => {
  const grosse = fabriquerScene(Array.from({ length: 30000 }, (_, i) => ({ name: "Fam" + (i % 400) + ":Type" + (i % 7) + ":" + i, type: "IfcPipeSegment" })));
  let t = performance.now();
  nomsProches(grosse, "fam12 type3", 15);
  const premiere = performance.now() - t;
  t = performance.now();
  nomsProches(grosse, "fam13", 15);
  const seconde = performance.now() - t;
  assert.ok(premiere < 1500, "1ere recherche " + premiere);
  assert.ok(seconde < 100, "2e recherche " + seconde);
});

// ---- Tolerance aux fautes de frappe (distance d'edition) ----
const sceneFautes = fabriquerScene([
  { name: "M_Supply Diffuser:600 x 600 Face:1", type: "IfcBuildingElementProxy" },
  { name: "M_Return Diffuser:300 x 300:2", type: "IfcBuildingElementProxy" },
  { name: "Mur de refend:Standard:3", type: "IfcWallStandardCase" },
  { name: "Compound Ceiling:Plafond acoustique:4", type: "IfcCovering" },
  { name: "Gaine ronde:Standard:5", type: "IfcDuctSegment" }
]);

test("faute simple : « difuseur » (une lettre manquante) retrouve Diffuser", () => {
  const n = nomsProches(sceneFautes, "ecarte les difuseurs", 15);
  assert.equal(n[0], "Diffuser");
  assert.ok(n.includes("M_Supply Diffuser:600 x 600 Face"));
});

test("faute double : « colisions avec les difuseurs » (mot de la phrase deux fautes, plus « collisions » mal ecrit) retrouve Diffuser", () => {
  const n = nomsProches(sceneFautes, "écarte les colisions avec les difuseurs", 15);
  assert.equal(n[0], "Diffuser");
  assert.equal(n.some((x) => /Mur|Gaine|Ceiling/.test(x)), false);
});

test("faute double dans un seul mot long : « plafoond acoustik »", () => {
  const n = nomsProches(sceneFautes, "plafoond acoustik", 15);
  assert.ok(n.includes("Compound Ceiling:Plafond acoustique"));
});

test("mot trop court : aucune tolerance (« mus » ne retrouve pas « Mur »)", () => {
  assert.deepEqual(nomsProches(sceneFautes, "mus", 15), []);
});

test("mot de 5 a 7 lettres : une faute tolerée, deux refusees", () => {
  assert.ok(nomsProches(sceneFautes, "gaina", 15).length >= 1); // 1 faute sur « gaine » (5 lettres)
  assert.deepEqual(nomsProches(sceneFautes, "gxixe", 15), []); // 3 fautes
});

test("pas de faux positif : des mots eloignes ne ramenent rien", () => {
  for (const phrase of ["radiateur", "ventilateur", "extincteur", "tableau electrique"]) assert.deepEqual(nomsProches(sceneFautes, phrase, 15), [], phrase);
});

test("phrase sans faute : resultat identique a celui sans tolerance (aucun ajout flou)", () => {
  const n = nomsProches(sceneFautes, "ecarte les diffuseurs", 15);
  assert.equal(n[0], "Diffuser");
  assert.equal(n.length, 3); // le mot + les deux noms Famille:Type, rien de plus
});

test("aucune valeur inventee : tout ce qui est renvoye est un mot ou un nom reel de la scene", () => {
  const reels = new Set();
  Object.values(sceneFautes.metaObjects).forEach((o) => {
    const nom = o.name.replace(/:\d+$/, "");
    reels.add(nom);
    nom.split(/[\s:_\-.,()/]+/).forEach((m) => reels.add(m));
  });
  for (const phrase of ["colisions difuseurs", "plafoond acoustik", "gaina ronde", "mur de refand"]) {
    for (const v of nomsProches(sceneFautes, phrase, 15)) assert.ok(reels.has(v), phrase + " -> " + v);
  }
});

test("mots vides mal ecrits ignores : « colisions » seul ne ramene rien", () => {
  assert.deepEqual(nomsProches(sceneFautes, "colisions", 15), []);
});
