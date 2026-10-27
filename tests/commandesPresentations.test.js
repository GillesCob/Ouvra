// Tests des couches selecteur et presentation du Viewer par commande (src/commandesSelecteurs.js, src/commandesPresentations.js) avec une FAUSSE scene
// (visibilite, opacite, x-ray, aretes, boites englobantes, materiau x-ray) : aucun navigateur, aucun xeokit.
import test from "node:test";
import assert from "node:assert/strict";
import { creerControleur, validerCommande } from "../src/commandesViewer.js";
import { creerFlux } from "../src/commandesFlux.js";
import { PRESENTATIONS, creerRegistrePresentations, OPACITE_CONTEXTE, OPACITE_TRANSPARENT, MATERIAU_FANTOME } from "../src/commandesPresentations.js";
import { SELECTEURS, creerRegistreSelecteurs, trouverElements } from "../src/commandesSelecteurs.js";
import { etatDrawerDepuisVisibles } from "../src/commandesDrawer.js";
import { creerZones } from "../src/commandesZones.js";

const maquettes = [{ id: "hosp-mep", label: "Mechanical (CVC)" }, { id: "hosp-arch", label: "Architecture" }];

// id -> [type, nom, niveau, maquette, boite]
const ELEMENTS = {
  "duct-n1": ["IfcDuctSegment", "Duct:100", "L1", "hosp-mep", [0, 0, 0, 1, 1, 1]],
  "duct-n2": ["IfcDuctSegment", "Duct:200", "L2", "hosp-mep", [0, 0, 3, 1, 1, 4]],
  "duct-far": ["IfcDuctSegment", "Duct:300", "L2", "hosp-mep", [10, 0, 3, 11, 1, 4]],
  "valve-n2": ["IfcValve", "M_Ball Valve:15 mm:1165462", "L2", "hosp-mep", [2, 0, 3, 2.5, 0.5, 3.5]],
  "wall-n2": ["IfcWallStandardCase", "Basic Wall:Generic:600", "L2", "hosp-arch", [-1, -1, 3, 12, 0, 6]],
  "ceil-n2": ["IfcCovering", "Compound Ceiling:700", "L2", "hosp-arch", [0, 0, 3.8, 3, 1, 4]],
  "wall-n1": ["IfcWallStandardCase", "Basic Wall:Generic:500", "L1", "hosp-arch", [20, 0, 0, 21, 5, 3]],
  "slab-n1": ["IfcSlab", "Floor:800", "L1", "hosp-arch", [30, 0, 0, 40, 5, 0.3]]
};
const ZONE = [-0.5, -0.5, 2.9, 3, 1.5, 4.1];

function fabrique() {
  const metaObjects = {};
  const ajouter = (id, type, name, parent, maquette) => {
    metaObjects[id] = { id, type, name, parent: parent ? metaObjects[parent] : null, metaModels: [{ id: maquette }] };
  };
  ["hosp-mep", "hosp-arch"].forEach((m) => { ajouter("L1-" + m, "IfcBuildingStorey", "Level 1", null, m); ajouter("L2-" + m, "IfcBuildingStorey", "Level 2", null, m); });
  const objects = {};
  for (const [id, [type, nom, niveau, maquette, aabb]] of Object.entries(ELEMENTS)) {
    ajouter(id, type, nom, niveau + "-" + maquette, maquette);
    objects[id] = { visible: true, opacity: 1, xrayed: false, edges: false, highlighted: false, aabb };
  }
  const dans = (ids) => (Array.isArray(ids) ? ids : [ids]).filter((id) => objects[id]);
  const regler = (propriete) => (ids, v) => dans(ids).forEach((id) => { objects[id][propriete] = v; });
  const scene = {
    objects,
    xrayMaterial: { fillAlpha: 0.5, edgeAlpha: 0.9, fillColor: [1, 0, 0], edgeColor: [0, 1, 0] },
    get visibleObjectIds() { return Object.keys(objects).filter((id) => objects[id].visible); },
    get highlightedObjectIds() { return Object.keys(objects).filter((id) => objects[id].highlighted); },
    get xrayedObjectIds() { return Object.keys(objects).filter((id) => objects[id].xrayed); },
    setObjectsVisible: regler("visible"),
    setObjectsOpacity: regler("opacity"),
    setObjectsXRayed: regler("xrayed"),
    setObjectsEdges: regler("edges"),
    setObjectsHighlighted: regler("highlighted"),
    getAABB: () => [0, 0, 0, 1, 1, 1]
  };
  const vols = [];
  const cameraFlight = { cancel() {}, flyTo: (o) => vols.push(o) };
  const zones = creerZones({ stockage: null });
  zones.ajouter("Bloc opératoire", ZONE);
  const moteur = creerControleur({ scene, metaScene: { metaObjects }, maquettes, cameraFlight, zones });
  return { scene, metaObjects, moteur, vols, zones, flux: creerFlux({ moteur }) };
}
const photo = (scene) => JSON.stringify(Object.entries(scene.objects).map(([id, o]) => [id, o.visible, o.opacity, o.xrayed, o.edges, o.highlighted]));
const commande = (parametres) => ({ action: "afficher", parametres });
const idsOu = (scene, propriete, valeur) => Object.keys(scene.objects).filter((id) => scene.objects[id][propriete] === valeur).sort();

// ---------- Registres ----------
test("registre de presentations : les sept presentations de la v1, nom unique, description obligatoire", () => {
  assert.deepEqual(PRESENTATIONS.noms().sort(), ["evidence", "focus", "isoler", "masquer", "niveau_repere", "transparence", "zone"]);
  const r = creerRegistrePresentations();
  const def = { nom: "x", description: "d", appliquer: () => null, libelle: () => [] };
  r.enregistrer(def);
  assert.throws(() => r.enregistrer(def), /déjà/);
  assert.throws(() => r.enregistrer({ nom: "y", appliquer: () => null, libelle: () => [] }), /description/);
  assert.throws(() => r.enregistrer({ nom: "z", description: "d", libelle: () => [] }), /appliquer/);
});

test("registre de selecteurs : six selecteurs, ajout d'un critere = un enregistrement", () => {
  assert.deepEqual(SELECTEURS.noms(), ["typesIfc", "niveaux", "maquettes", "noms", "elements", "zones"]);
  const f = fabrique();
  const registre = creerRegistreSelecteurs();
  SELECTEURS.toutes().forEach((s) => registre.enregistrer(s));
  registre.enregistrer({
    nom: "epais", description: "d", parametres: [], decrire: () => null,
    fabriquer: (p) => (p.epais ? (e) => e.typeIfc === "ifcslab" : null)
  });
  const contexte = { scene: f.scene, metaScene: { metaObjects: f.metaObjects }, maquettes, zones: f.zones };
  assert.deepEqual(trouverElements({ epais: true }, contexte, registre), ["slab-n1"]);
  assert.throws(() => registre.enregistrer(SELECTEURS.trouver("zones")), /déjà/);
});

// ---------- Selecteurs ----------
test("selecteur element precis : nom complet, numero final ou identifiant, sans toucher aux autres", () => {
  const f = fabrique();
  for (const valeur of ["M_Ball Valve:15 mm:1165462", "1165462", "valve-n2"]) {
    const plan = f.moteur.preparer(commande({ elements: [valeur], presentation: "focus" }));
    assert.deepEqual(plan.ids, ["valve-n2"], valeur);
  }
});

test("selecteur zone : les elements dont le centre est dans la boite ; zone inconnue = rien", () => {
  const f = fabrique();
  assert.deepEqual(f.moteur.preparer(commande({ zones: ["Bloc opératoire"], presentation: "zone" })).ids.sort(), ["ceil-n2", "duct-n2", "valve-n2"]);
  assert.deepEqual(f.moteur.preparer(commande({ zones: ["Bloc opératoire"], typesIfc: ["IfcValve"] })).ids, ["valve-n2"], "ET avec un type");
  assert.equal(f.moteur.preparer(commande({ zones: ["Absente"], presentation: "zone" })).vide, true);
});

// ---------- Validation ----------
test("validation : presentation inconnue, rayon invalide, exigences du focus et de la zone", () => {
  assert.match(validerCommande(commande({ typesIfc: ["IfcValve"], presentation: "danser" }), null).erreur, /inconnue/);
  assert.equal(validerCommande(commande({ typesIfc: ["IfcValve"], rayonMetres: -1 }), null).ok, false);
  assert.equal(validerCommande(commande({ typesIfc: ["IfcValve"], rayonMetres: "5" }), null).ok, false);
  assert.match(validerCommande(commande({ typesIfc: ["IfcValve"], presentation: "focus" }), null).erreur, /élément à montrer/);
  assert.match(validerCommande(commande({ typesIfc: ["IfcValve"], presentation: "zone" }), null).erreur, /zone/);
  const ok = validerCommande(commande({ typesIfc: ["IfcValve"] }), null);
  assert.equal(ok.commande.parametres.presentation, "isoler");
  assert.equal(ok.commande.parametres.rayonMetres, 0);
});

test("validation : zones inconnues refusees quand les valeurs de la maquette sont fournies", () => {
  const valeurs = { typesIfc: [], niveaux: [], maquettes: [], noms: [], zones: ["Bloc opératoire"] };
  assert.equal(validerCommande(commande({ zones: ["bloc operatoire"], presentation: "zone" }), valeurs).commande.parametres.zones[0], "Bloc opératoire");
  assert.equal(validerCommande(commande({ zones: ["Cuisine"], presentation: "zone" }), valeurs).ok, false);
});

// ---------- niveau_repere ----------
test("niveau_repere : le niveau reste visible, selection pleine, reste du niveau transparent, autres niveaux masques ; annulation exacte", () => {
  const f = fabrique();
  const avant = photo(f.scene);
  const c = commande({ typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"], presentation: "niveau_repere" });
  const r = f.moteur.appliquer(f.moteur.preparer(c));
  assert.equal(r.ok, true);
  assert.match(r.message, /2 éléments trouvés/);
  const o = f.scene.objects;
  assert.equal(o["duct-n2"].opacity, 1);
  assert.equal(o["duct-far"].opacity, 1);
  for (const id of ["valve-n2", "wall-n2", "ceil-n2"]) assert.deepEqual([o[id].visible, o[id].opacity], [true, OPACITE_CONTEXTE], id);
  for (const id of ["duct-n1", "wall-n1", "slab-n1"]) assert.equal(o[id].visible, false, id);
  assert.equal(idsOu(f.scene, "highlighted", true).length, 0, "aucune surbrillance xeokit");
  assert.equal(f.vols.length, 1, "camera cadree");
  f.moteur.reinitialiser();
  assert.equal(photo(f.scene), avant);
});

// ---------- focus ----------
test("focus : modele fantome, elements dans le rayon transparents, element plein ; materiau x-ray et etats rendus a l'annulation", () => {
  const f = fabrique();
  const avant = photo(f.scene);
  const materiauAvant = JSON.stringify(f.scene.xrayMaterial);
  f.moteur.appliquer(f.moteur.preparer(commande({ elements: ["1165462"], presentation: "focus", rayonMetres: 3 })));
  const o = f.scene.objects;
  assert.deepEqual([o["valve-n2"].visible, o["valve-n2"].opacity, o["valve-n2"].xrayed], [true, 1, false]);
  assert.deepEqual([o["duct-n2"].opacity, o["duct-n2"].xrayed], [OPACITE_CONTEXTE, false], "a 1 m de la vanne");
  assert.deepEqual(idsOu(f.scene, "xrayed", true), ["duct-far", "slab-n1", "wall-n1"], "hors rayon : fantome (duct-n1 est a 2,2 m, donc dans le contexte)");
  assert.equal(f.scene.xrayMaterial.fillAlpha, MATERIAU_FANTOME.fillAlpha);
  assert.equal(f.vols.length, 1);
  f.moteur.reinitialiser();
  assert.equal(photo(f.scene), avant);
  assert.equal(JSON.stringify(f.scene.xrayMaterial), materiauAvant);
});

test("focus : le rayon est parametrable (0 = valeur par defaut de 3 m), un grand rayon englobe plus d'elements", () => {
  const f = fabrique();
  f.moteur.appliquer(f.moteur.preparer(commande({ elements: ["valve-n2"], presentation: "focus", rayonMetres: 0.5 })));
  assert.equal(f.scene.objects["duct-n2"].opacity, 1, "a 1 m, hors du rayon de 0,5 m : pas dans le contexte proche");
  assert.equal(f.scene.objects["duct-n2"].xrayed, true, "donc fantome");
  f.moteur.reinitialiser();
  f.moteur.appliquer(f.moteur.preparer(commande({ elements: ["valve-n2"], presentation: "focus", rayonMetres: 12 })));
  assert.equal(f.scene.objects["duct-far"].opacity, OPACITE_CONTEXTE, "a 7,5 m, dans un rayon de 12 m");
});

// ---------- transparence, masquer ----------
test("transparence par type : seuls les murs deviennent transparents, la camera ne bouge pas ; annulation exacte", () => {
  const f = fabrique();
  const avant = photo(f.scene);
  const r = f.moteur.appliquer(f.moteur.preparer(commande({ typesIfc: ["IfcWallStandardCase", "IfcWall"], presentation: "transparence", cadrer: true })));
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(f.scene.objects).filter((id) => f.scene.objects[id].opacity === OPACITE_TRANSPARENT).sort(), ["wall-n1", "wall-n2"]);
  assert.equal(f.vols.length, 0);
  f.moteur.reinitialiser();
  assert.equal(photo(f.scene), avant);
});

test("masquer : faux plafonds et dalles masques, le reste ne change pas ; annulation exacte", () => {
  const f = fabrique();
  const avant = photo(f.scene);
  f.moteur.appliquer(f.moteur.preparer(commande({ typesIfc: ["IfcCovering", "IfcSlab"], presentation: "masquer" })));
  assert.deepEqual(idsOu(f.scene, "visible", false), ["ceil-n2", "slab-n1"]);
  f.moteur.reinitialiser();
  assert.equal(photo(f.scene), avant);
});

test("masquer une maquette entiere : le drawer decoche cette maquette, l'autre reste cochee", () => {
  const f = fabrique();
  f.moteur.appliquer(f.moteur.preparer(commande({ maquettes: ["Mechanical (CVC)"], presentation: "masquer" })));
  const idsParMaquette = { "hosp-mep": ["duct-n1", "duct-n2", "duct-far", "valve-n2"], "hosp-arch": ["wall-n2", "ceil-n2", "wall-n1", "slab-n1"] };
  const etat = etatDrawerDepuisVisibles({ idsParMaquette, niveaux: [], visibles: new Set(f.scene.visibleObjectIds) });
  assert.deepEqual([...etat.maquettes], [["hosp-mep", false], ["hosp-arch", true]]);
});

test("isoler plusieurs maquettes : « seulement l'architecture et la mecanique » masque le reste", () => {
  const f = fabrique();
  f.scene.objects["slab-n1"].visible = true;
  f.moteur.appliquer(f.moteur.preparer(commande({ maquettes: ["Architecture"], presentation: "isoler" })));
  assert.deepEqual(idsOu(f.scene, "visible", false), ["duct-far", "duct-n1", "duct-n2", "valve-n2"]);
});

// ---------- zone ----------
test("zone : contenu plein, murs et plafonds qui l'entourent transparents, tout le reste masque ; annulation exacte", () => {
  const f = fabrique();
  const avant = photo(f.scene);
  const r = f.moteur.appliquer(f.moteur.preparer(commande({ zones: ["Bloc opératoire"], presentation: "zone" })));
  assert.equal(r.ok, true);
  const o = f.scene.objects;
  for (const id of ["duct-n2", "valve-n2"]) assert.deepEqual([o[id].visible, o[id].opacity], [true, 1], id);
  for (const id of ["wall-n2", "ceil-n2"]) assert.deepEqual([o[id].visible, o[id].opacity], [true, OPACITE_TRANSPARENT], id);
  assert.deepEqual(idsOu(f.scene, "visible", false), ["duct-far", "duct-n1", "slab-n1", "wall-n1"]);
  assert.deepEqual(f.vols[0].aabb, ZONE, "camera sur la zone");
  f.moteur.reinitialiser();
  assert.equal(photo(f.scene), avant);
});

// ---------- flux : Non = annulation exacte ----------
test("flux : « Non » apres un focus rend la scene exactement comme avant, une autre presentation remplace la precedente", () => {
  const f = fabrique();
  const avant = photo(f.scene);
  assert.equal(f.flux.proposer(commande({ elements: ["valve-n2"], presentation: "focus" })).ok, true);
  assert.equal(f.flux.proposer(commande({ typesIfc: ["IfcSlab"], presentation: "masquer", cadrer: false })).ok, true);
  assert.equal(f.scene.objects["valve-n2"].xrayed, false, "le focus precedent est defait");
  assert.equal(f.scene.objects["slab-n1"].visible, false);
  f.flux.refuser();
  assert.equal(photo(f.scene), avant);
});

test("compte rendu : decrit la presentation et la selection", () => {
  const f = fabrique();
  const plan = f.moteur.preparer(commande({ typesIfc: ["IfcValve"], niveaux: ["Level 2"], presentation: "niveau_repere" }));
  assert.match(plan.resume, /1 élément trouvé \(vannes, niveau 2\) : .*transparence légère/);
});

// ---------- Relecture construite depuis la commande validee ----------
test("relecture : un verbe et la selection seulement, jamais les effets, pour chaque presentation et jamais le texte du modele", () => {
  const relire = (parametres) => validerCommande({ ...commande(parametres), relecture: "TEXTE LIBRE DU MODELE" }, null).commande.relecture;
  assert.equal(relire({ typesIfc: ["IfcDuctSegment", "IfcDuctFitting"], niveaux: ["Level 2"], presentation: "niveau_repere" }), "Afficher les gaines et raccords de gaine du niveau 2");
  assert.equal(relire({ niveaux: ["Level 2"], maquettes: ["Architecture"] }), "Afficher les éléments du niveau 2 de la maquette Architecture");
  assert.equal(relire({ typesIfc: ["IfcValve"] }), "Afficher les vannes");
  assert.equal(relire({ typesIfc: ["IfcCovering"], niveaux: ["Level 1"], isoler: false, surbrillance: true }), "Mettre en évidence les faux plafonds et revêtements du niveau 1");
  assert.equal(relire({ elements: ["M_Ball Valve:15 mm:1165462"], presentation: "focus", rayonMetres: 5 }), "Montrer l'élément « M_Ball Valve:15 mm:1165462 »");
  assert.equal(relire({ typesIfc: ["IfcWall"], presentation: "transparence" }), "Rendre les murs transparents");
  assert.equal(relire({ typesIfc: ["IfcCovering", "IfcFurniture", "IfcSlab"], presentation: "masquer" }), "Masquer les faux plafonds et revêtements, mobilier et dalles");
  assert.equal(relire({ zones: ["Bloc opératoire"], presentation: "zone" }), "Afficher la zone « Bloc opératoire »");
  assert.equal(validerCommande({ action: "tout_afficher", relecture: "x" }, null).commande.relecture, "Tout réafficher");
  for (const interdit of ["masquer le reste", "cadrer", "transparence légère", "autres niveaux", "rayon", "surbrillance"]) {
    assert.equal(relire({ typesIfc: ["IfcValve"], niveaux: ["Level 2"], presentation: "focus", elements: ["x"], surbrillance: true, rayonMetres: 4 }).includes(interdit), false, interdit);
  }
});

test("interface : plus de compte rendu a l'ecran (ni #commandesLigne, ni resume dans le bandeau)", async () => {
  const fs = await import("node:fs");
  const lire = (chemin) => fs.readFileSync(new URL(chemin, import.meta.url), "utf8");
  assert.equal(/commandesLigne|commandesCompte|majBarreCommandes|compteRenduAccepte/.test(lire("../index.html") + lire("../src/main.js") + lire("../src/commandesIA.css")), false);
  assert.equal(/resume/.test(lire("../src/commandesBandeau.js").replace(/\/\/.*$/gm, "")), false, "le bandeau n'affiche pas de resume");
  assert.match(lire("../src/commandesBandeau.js"), /Est-ce bien votre demande \?/);
});

// ---------- Annulation exacte de l'isolement avec surbrillance ----------
test("isoler avec surbrillance : l'annulation rend l'etat d'origine, y compris une surbrillance deja posee ailleurs", () => {
  const f = fabrique();
  f.scene.objects["duct-n1"].highlighted = true; // pose avant la commande, sur un element qui sera masque puis rendu
  f.scene.objects["valve-n2"].highlighted = true; // deja en surbrillance ET trouve par la commande
  const avant = photo(f.scene);
  f.moteur.appliquer(f.moteur.preparer(commande({ typesIfc: ["IfcValve", "IfcDuctSegment"], isoler: true, surbrillance: true })));
  f.moteur.reinitialiser();
  assert.equal(photo(f.scene), avant);
});

test("tout_afficher : ne touche pas la surbrillance des elements exclus", () => {
  const f = fabrique();
  const moteur = creerControleur({ scene: f.scene, metaScene: { metaObjects: f.metaObjects }, maquettes, exclus: new Set(["wall-n1"]) });
  f.scene.objects["wall-n1"].highlighted = true;
  f.scene.objects["wall-n2"].highlighted = true;
  moteur.appliquer(moteur.preparer({ action: "tout_afficher" }));
  assert.equal(f.scene.objects["wall-n1"].highlighted, true);
  assert.equal(f.scene.objects["wall-n2"].highlighted, false);
});
