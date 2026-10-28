// Tests des phrases toutes faites du Viewer (src/commandesExemples.js) : format du moteur, reconnaissance locale sans IA, et SURTOUT existence
// reelle des types IFC, niveaux et maquettes dans les metadonnees des maquettes de l'hopital (chaque phrase doit trouver au moins un element).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EXEMPLES_COMMANDES, reconnaitreExemple } from "../src/commandesExemples.js";
import { validerCommande, creerControleur } from "../src/commandesViewer.js";

const MAQUETTES = [{ id: "hosp-arch", label: "Architecture" }, { id: "hosp-mep", label: "Mechanical (CVC)" }, { id: "hosp-struct", label: "Structure" }];
const SOURCES = [
  { id: "hosp-arch", chemin: new URL("../public/models/hospital/legere/architectural.json", import.meta.url) },
  { id: "hosp-mep", chemin: new URL("../public/models/hospital/legere/mechanical.json", import.meta.url) },
  { id: "hosp-struct", chemin: new URL("../public/models/hospital/structure.json", import.meta.url) }
];
const SPATIAUX = new Set(["IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey"]);

// Scene factice construite sur les VRAIES metadonnees des maquettes (ids prefixes par la maquette, comme deux fichiers distincts).
function sceneDeLHopital() {
  const metaObjects = {};
  const objects = {};
  for (const source of SOURCES) {
    const json = JSON.parse(fs.readFileSync(source.chemin, "utf8"));
    const locaux = {};
    json.metaObjects.forEach((m) => { locaux[m.id] = { id: source.id + ":" + m.id, type: m.type, name: m.name, parent: null, metaModels: [{ id: source.id }], _parent: m.parent }; });
    Object.values(locaux).forEach((m) => { m.parent = m._parent ? locaux[m._parent] || null : null; metaObjects[m.id] = m; if (!SPATIAUX.has(m.type)) objects[m.id] = { visible: true }; });
  }
  const scene = {
    objects,
    get visibleObjectIds() { return Object.keys(objects).filter((id) => objects[id].visible); },
    get highlightedObjectIds() { return []; },
    get xrayedObjectIds() { return []; },
    setObjectsVisible() {}, setObjectsHighlighted() {}, setObjectsXRayed() {}, getAABB: () => [0, 0, 0, 1, 1, 1]
  };
  return { scene, metaScene: { metaObjects } };
}

test("exemples : entre 6 et 15 phrases, toutes distinctes, sans tiret quadratin", () => {
  assert.ok(EXEMPLES_COMMANDES.length >= 6 && EXEMPLES_COMMANDES.length <= 15);
  assert.equal(new Set(EXEMPLES_COMMANDES.map((e) => e.demande)).size, EXEMPLES_COMMANDES.length);
  for (const e of EXEMPLES_COMMANDES) assert.equal((e.demande + e.relecture).includes(String.fromCharCode(0x2014)), false, e.demande);
});

test("exemples : chaque famille de presentation est couverte (zone exceptee, elle depend de l'utilisateur)", () => {
  const presentations = new Set(EXEMPLES_COMMANDES.map((e) => (e.commande.parametres || {}).presentation || (e.commande.action === "afficher" ? "isoler" : e.commande.action)));
  for (const nom of ["niveau_repere", "isoler", "focus", "transparence", "masquer", "tout_afficher"]) assert.ok(presentations.has(nom), nom);
});

test("exemples : la phrase de Gilles est la premiere", () => {
  assert.equal(EXEMPLES_COMMANDES[0].demande, "Affiche-moi les gaines au niveau 2");
});

test("exemples : chaque commande est valide pour le moteur", () => {
  for (const e of EXEMPLES_COMMANDES) {
    const verdict = validerCommande(e.commande, null);
    assert.equal(verdict.ok, true, e.demande + " : " + verdict.erreur);
    assert.ok(e.relecture && e.relecture.length > 10, e.demande);
  }
});

test("exemples : chaque phrase trouve au moins un element dans les maquettes de l'hopital", (t) => {
  if (SOURCES.some((s) => !fs.existsSync(s.chemin))) { t.skip("metadonnees de l'hopital absentes"); return; }
  const { scene, metaScene } = sceneDeLHopital();
  const controleur = creerControleur({ scene, metaScene, maquettes: MAQUETTES });
  for (const e of EXEMPLES_COMMANDES) {
    const plan = controleur.preparer(e.commande);
    assert.equal(plan.ok, true, e.demande);
    assert.ok(plan.compte > 0, e.demande + " : aucun element trouve");
    assert.equal(plan.vide, false, e.demande);
  }
});

test("exemples : « gaines au niveau 2 » ne prend que des gaines du niveau 2 (plenum compris), « niveau 3 seul » exclut les autres niveaux", (t) => {
  if (SOURCES.some((s) => !fs.existsSync(s.chemin))) { t.skip("metadonnees de l'hopital absentes"); return; }
  const { scene, metaScene } = sceneDeLHopital();
  const controleur = creerControleur({ scene, metaScene, maquettes: MAQUETTES });
  const gaines = controleur.preparer(EXEMPLES_COMMANDES[0].commande);
  assert.ok(gaines.ids.every((id) => /^IfcDuct(Segment|Fitting)$/.test(metaScene.metaObjects[id].type)));
  assert.ok(gaines.ids.every((id) => { let m = metaScene.metaObjects[id]; while (m && m.type !== "IfcBuildingStorey") m = m.parent; return /^Level 2( Ceiling)?$/.test(m.name); }));
  const niveau3 = controleur.preparer(EXEMPLES_COMMANDES[2].commande);
  assert.ok(niveau3.compte > gaines.compte);
});

test("reconnaissance locale : phrase exacte, a la casse, aux accents et a la ponctuation pres", () => {
  const r = reconnaitreExemple("  affiche-moi LES gaines, au niveau 2 !  ");
  assert.equal(r.action, "afficher");
  assert.deepEqual(r.parametres.niveaux, ["Level 2"]);
  assert.match(r.relecture, /gaines/);
  assert.equal(reconnaitreExemple("mets en evidence les faux plafonds du niveau 1").parametres.isoler, false);
  assert.equal(reconnaitreExemple("REAFFICHE TOUT").action, "tout_afficher");
});

test("reconnaissance locale : phrase vide, inconnue ou seulement proche = null (c'est l'IA qui repond)", () => {
  for (const phrase of ["", "   ", null, undefined, "Affiche les gaines", "Affiche-moi les gaines au niveau 5", "n'importe quoi"]) {
    assert.equal(reconnaitreExemple(phrase), null, String(phrase));
  }
});

test("exemples : le focus vise UNE vanne precise, le niveau_repere garde le niveau, la transparence et le masquage ne touchent que leur selection", (t) => {
  if (SOURCES.some((s) => !fs.existsSync(s.chemin))) { t.skip("metadonnees de l'hopital absentes"); return; }
  const { scene, metaScene } = sceneDeLHopital();
  const controleur = creerControleur({ scene, metaScene, maquettes: MAQUETTES });
  const par = (debut) => controleur.preparer(EXEMPLES_COMMANDES.find((e) => e.demande.startsWith(debut)).commande);
  const vanne = par("Montre-moi la vanne");
  assert.equal(vanne.compte, 1);
  assert.equal(metaScene.metaObjects[vanne.ids[0]].type, "IfcValve");
  assert.ok(par("Rends les murs").ids.every((id) => /^IfcWall/.test(metaScene.metaObjects[id].type)));
  assert.ok(par("Masque la structure").ids.every((id) => metaScene.metaObjects[id].metaModels[0].id === "hosp-struct"));
  assert.ok(par("Masque les faux plafonds").ids.every((id) => ["IfcCovering", "IfcFurniture"].includes(metaScene.metaObjects[id].type)));
  assert.equal(EXEMPLES_COMMANDES[0].commande.parametres.presentation, "niveau_repere");
});

test("exemples : la relecture de chaque phrase est exactement celle que le moteur construit (verbe et critere, aucun effet)", () => {
  for (const e of EXEMPLES_COMMANDES) {
    assert.equal(e.relecture, validerCommande(e.commande, null).commande.relecture, e.demande);
  }
});
