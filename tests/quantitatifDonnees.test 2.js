// Tests des adaptateurs de donnees du quantitatif (src/quantitatifDonnees.js) sur les VRAIES metadonnees de l'hopital et sur une fausse scene xeokit.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { elementsDepuisJson, elementsDepuisScene, quantitesDe, sourcesJson, chargerElementsJson, valeursPourQuantitatif, familleDe } from "../src/quantitatifDonnees.js";
import { calculer, TYPES_SPATIAUX } from "../src/quantitatif.js";

const lire = (chemin) => JSON.parse(readFileSync(new URL("../public/models/hospital/" + chemin, import.meta.url), "utf8"));

test("JSON reel : portes de l'architecture, niveaux canoniques, objets spatiaux exclus du decompte", () => {
  const els = elementsDepuisJson(lire("legere/architectural.json"), { id: "hosp-arch", label: "Architecture" });
  assert.ok(els.length > 5000);
  assert.deepEqual(els.capacites, { boites: false, quantites: false });
  const portes = calculer(els, { mesure: "nombre", filtres: { typesIfc: ["IfcDoor"] }, regroupements: ["niveau"] });
  assert.equal(portes.totaux.valeur, 433);
  assert.ok(portes.lignes.every((l) => /^Level \d$/.test(l.cles[0])));
  assert.ok(portes.elementsExclus > 0);
  assert.equal(els.filter((e) => TYPES_SPATIAUX.has(e.typeIfc) && e.typeIfc !== "IfcBuildingStorey").length, 3);
});

test("JSON reel : « Level 2 Ceiling » est compte avec « Level 2 », comme dans le Viewer", () => {
  const els = elementsDepuisJson(lire("legere/mechanical.json"), { id: "hosp-mep", label: "Mechanical (CVC)" });
  const niveaux = new Set(els.filter((e) => !TYPES_SPATIAUX.has(e.typeIfc)).map((e) => e.niveau));
  assert.ok(!Array.from(niveaux).some((n) => /Ceiling|TOS/.test(n)));
  assert.ok(niveaux.has("Level 2"));
});

test("JSON : metadonnees absentes ou mal formees = aucun element, sans exception ; parente cyclique sans boucle infinie", () => {
  assert.equal(elementsDepuisJson(null, { id: "a", label: "A" }).length, 0);
  assert.equal(elementsDepuisJson({ metaObjects: "x" }, { id: "a", label: "A" }).length, 0);
  const cycle = elementsDepuisJson({ metaObjects: [{ id: 1, name: "a", type: "IfcWall", parent: 2 }, { id: 2, name: "b", type: "IfcWall", parent: 1 }] }, { id: "a", label: "A" });
  assert.equal(cycle.length, 2);
  assert.equal(cycle[0].niveau, "");
});

test("familleDe : retire le suffixe numerique de l'identifiant Revit", () => {
  assert.equal(familleDe("Basic Wall:Generic - 200mm:519932"), "Basic Wall:Generic - 200mm");
  assert.equal(familleDe(undefined), "");
});

// ---------- Scene xeokit simulee ----------
function fausseScene() {
  const maquette = { id: "m1" };
  const storey = { id: "s1", name: "Level 3 TOS", type: "IfcBuildingStorey", parent: null, metaModels: [maquette] };
  const mur = {
    id: "w1", name: "Mur:Generique:12", type: "IfcWallStandardCase", parent: storey, metaModels: [maquette],
    propertySets: [{ name: "Pset_WallCommon", properties: [{ name: "Length", value: 99 }] }, { name: "Qto_WallBaseQuantities", properties: [{ name: "Length", value: "4.5" }, { name: "Note", value: "texte" }, { name: "Vide", value: "" }] }]
  };
  const sans = { id: "w2", name: "Mur:Generique:13", type: "IfcWallStandardCase", parent: storey, metaModels: [maquette] };
  return {
    metaScene: { metaObjects: { s1: storey, w1: mur, w2: sans } },
    scene: { objects: { w1: { aabb: [0, 0, 0, 4, 0.2, 3] } } },
    maquettes: [{ id: "m1", label: "Architecture" }]
  };
}

test("scene : elements, niveau canonique, maquette par son libelle, boite a la demande", () => {
  const els = elementsDepuisScene(fausseScene());
  const mur = els.find((e) => e.id === "w1");
  assert.equal(mur.niveau, "Level 3");
  assert.equal(mur.maquette, "Architecture");
  assert.equal(typeof mur.boite, "function");
  assert.deepEqual(els.capacites, { boites: true, quantites: true });
  const r = calculer(els, { mesure: "surface_estimee", filtres: { typesIfc: ["IfcWallStandardCase"] }, regroupements: [] });
  assert.equal(r.totaux.valeur, 12);
  assert.equal(r.totaux.sansDonnee, 1); // w2 n'a pas d'entite dans la scene
});

test("scene : quantites lues seulement dans Qto_* / BaseQuantities, valeurs non numeriques ignorees", () => {
  const { metaScene } = fausseScene();
  assert.deepEqual(quantitesDe(metaScene.metaObjects.w1), { Length: 4.5 });
  assert.equal(quantitesDe(metaScene.metaObjects.w2), null);
  const els = elementsDepuisScene(fausseScene());
  const r = calculer(els, { mesure: "qto_longueur", filtres: { typesIfc: [] }, regroupements: [] });
  assert.equal(r.totaux.valeur, 4.5);
  assert.equal(r.mesure.origine, "lu");
});

test("scene : sans geometrie ni metadonnees, aucune exception", () => {
  const vide = elementsDepuisScene({ metaScene: null, scene: null, maquettes: [] });
  assert.equal(vide.length, 0);
  const sansGeometrie = elementsDepuisScene({ ...fausseScene(), scene: { objects: {} } });
  assert.equal(sansGeometrie.capacites.boites, false);
});

test("sourcesJson : metaSrc propre, version allegee en remplacement, maquette sans metadonnees signalee", () => {
  const { sources, sansMetadonnees } = sourcesJson([
    { id: "hosp-struct", label: "Structure", metaSrc: "/models/hospital/structure.json" },
    { id: "hosp-arch", label: "Architecture" },
    { id: "cea", label: "Maquette CEA" }
  ]);
  assert.deepEqual(sources.map((s) => [s.maquette.id, s.remplace]), [["hosp-struct", false], ["hosp-arch", true]]);
  assert.deepEqual(sansMetadonnees, ["Maquette CEA"]);
});

test("chargerElementsJson : lecture par fetch injecte, echec d'une maquette signale sans bloquer les autres", async () => {
  const appel = async (url) => (url.endsWith("structure.json") ? { ok: true, json: async () => lire("structure.json") } : { ok: false, status: 404, json: async () => ({}) });
  const { elements, notes } = await chargerElementsJson([{ id: "hosp-struct", label: "Structure", metaSrc: "/models/hospital/structure.json" }, { id: "hosp-arch", label: "Architecture" }, { id: "cea", label: "CEA" }], { fetch: appel });
  assert.ok(elements.length > 2000);
  assert.deepEqual(elements.capacites, { boites: false, quantites: false });
  assert.ok(notes.some((n) => /Sans métadonnées chargeables.*CEA/.test(n)));
  assert.ok(notes.some((n) => /« Architecture » illisibles/.test(n)));
  const rejet = await chargerElementsJson([{ id: "hosp-struct", label: "S", metaSrc: "/x.json" }], { fetch: async () => { throw new Error("reseau"); } });
  assert.equal(rejet.elements.length, 0);
});

test("valeursPourQuantitatif : mots seulement, niveaux canoniques, mesures disponibles selon les donnees", () => {
  const els = elementsDepuisJson(lire("legere/architectural.json"), { id: "hosp-arch", label: "Architecture" });
  const v = valeursPourQuantitatif(els, "combien de portes au niveau 2");
  assert.ok(v.typesIfc.includes("IfcDoor"));
  assert.ok(!v.typesIfc.includes("IfcBuildingStorey"));
  assert.ok(v.niveaux.includes("Level 2"));
  assert.deepEqual(v.maquettes, ["Architecture"]);
  assert.deepEqual(v.mesures, ["nombre"]); // JSON seul : pas de geometrie, pas de Qto
  assert.ok(v.noms.length <= 15);
  assert.ok(JSON.stringify(v).length < 6000);
  assert.deepEqual(valeursPourQuantitatif(elementsDepuisScene(fausseScene()), "mur").mesures.sort(), ["longueur_estimee", "nombre", "qto_longueur", "qto_surface", "qto_volume", "surface_estimee", "volume_estime"].sort());
});

test("valeursPourQuantitatif : listes plafonnees comme le serveur (40), valeur trop longue ecartee, noms tronques a 160", () => {
  const maquette = { id: "m", label: "M" };
  const metaObjects = [];
  for (let i = 0; i < 60; i += 1) metaObjects.push({ id: "t" + i, name: "Objet " + i, type: "IfcType" + String(i).padStart(2, "0"), parent: null });
  metaObjects.push({ id: "long", name: "x", type: "IfcTypeTresLong" + "x".repeat(80), parent: null });
  const els = elementsDepuisJson({ metaObjects }, maquette);
  const v = valeursPourQuantitatif(els, "objet");
  assert.equal(v.typesIfc.length, 40);
  assert.ok(v.typesIfc.every((t) => t.length <= 80));
  assert.ok(v.noms.every((n) => n.length <= 160));
});
