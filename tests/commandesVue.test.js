// Tests de la vue CUMULATIVE du Viewer par commande (src/commandesVue.js, src/commandesFlux.js) avec le vrai moteur et une FAUSSE scene : aucun navigateur.
// Scenario de reference de Gilles : niveaux 2 et 4, puis « uniquement la maquette structure », puis les cloisons en surbrillance, puis la zone ouest.
import test from "node:test";
import assert from "node:assert/strict";
import { creerControleur } from "../src/commandesViewer.js";
import { creerFlux } from "../src/commandesFlux.js";
import { reduire } from "../src/commandesVue.js";
import { creerZones } from "../src/commandesZones.js";
import { etatDrawerDepuisVisibles } from "../src/commandesDrawer.js";
import { OPACITE_CONTEXTE, OPACITE_TRANSPARENT } from "../src/commandesPresentations.js";

const maquettes = [{ id: "mep", label: "Mechanical (CVC)" }, { id: "arch", label: "Architecture" }, { id: "struct", label: "Structure" }];
const NIVEAUX = [1, 2, 3, 4];
// Un element par (maquette, type, niveau). x = 10 * niveau : les niveaux 1 et 2 sont a l'ouest (x < 25), 3 et 4 a l'est.
const MODELES = [
  ["mep", "duct", "IfcDuctSegment", "Duct"], ["mep", "pipe", "IfcPipeSegment", "Pipe"],
  ["arch", "wall", "IfcWallStandardCase", "Basic Wall:Interior - 123mm Partition"], ["arch", "ceil", "IfcCovering", "Compound Ceiling"],
  ["struct", "col", "IfcColumn", "Column"], ["struct", "swall", "IfcWallStandardCase", "Basic Wall:Foundation - 300mm"]
];
const ZONE_OUEST = [-5, -5, -5, 25, 5, 5];

function fabrique(extra = {}) {
  const metaObjects = {};
  const objects = {};
  const ajouter = (id, type, name, parent, maquette) => { metaObjects[id] = { id, type, name, parent: parent ? metaObjects[parent] : null, metaModels: [{ id: maquette }] }; };
  for (const m of maquettes) for (const n of NIVEAUX) ajouter(m.id + "-L" + n, "IfcBuildingStorey", "Level " + n, null, m.id);
  const parNiveau = {};
  for (const [maquette, court, type, nom] of MODELES) {
    for (const n of NIVEAUX) {
      const id = court + "-L" + n;
      ajouter(id, type, nom + ":" + id, maquette + "-L" + n, maquette);
      objects[id] = { visible: true, opacity: 1, xrayed: false, edges: false, highlighted: false, aabb: [10 * n, 0, 0, 10 * n + 1, 1, 1] };
      (parNiveau[n] = parNiveau[n] || {})[maquette] = [...((parNiveau[n] || {})[maquette] || []), id];
    }
  }
  const dans = (ids) => (Array.isArray(ids) ? ids : [ids]).filter((id) => objects[id]);
  const regler = (propriete) => (ids, v) => dans(ids).forEach((id) => { objects[id][propriete] = v; });
  const scene = {
    objects,
    xrayMaterial: { fillAlpha: 0.5, edgeAlpha: 0.9, fillColor: [1, 0, 0], edgeColor: [0, 1, 0] },
    get visibleObjectIds() { return Object.keys(objects).filter((id) => objects[id].visible); },
    get highlightedObjectIds() { return Object.keys(objects).filter((id) => objects[id].highlighted); },
    get xrayedObjectIds() { return Object.keys(objects).filter((id) => objects[id].xrayed); },
    setObjectsVisible: regler("visible"), setObjectsOpacity: regler("opacity"), setObjectsXRayed: regler("xrayed"),
    setObjectsEdges: regler("edges"), setObjectsHighlighted: regler("highlighted"),
    getAABB: () => [0, 0, 0, 1, 1, 1]
  };
  const vols = [];
  const zones = creerZones({ stockage: null });
  zones.ajouter("Zone ouest", ZONE_OUEST);
  const signaux = [];
  const moteur = creerControleur({
    scene, metaScene: { metaObjects }, maquettes, zones, ...extra,
    cameraFlight: { cancel() {}, flyTo: (o) => vols.push(o) },
    apres: (nom) => signaux.push(nom)
  });
  const niveaux = NIVEAUX.map((n) => ({ name: "Level " + n, objectsByMaquette: parNiveau[n] }));
  const idsParMaquette = Object.fromEntries(maquettes.map((m) => [m.id, Object.keys(objects).filter((id) => metaObjects[id].metaModels[0].id === m.id)]));
  const drawer = () => etatDrawerDepuisVisibles({ idsParMaquette, niveaux, visibles: new Set(scene.visibleObjectIds) });
  return { scene, moteur, flux: creerFlux({ moteur }), vols, signaux, drawer, metaObjects };
}
const afficher = (parametres, demande = "x") => ({ action: "afficher", parametres, demande });
const visibles = (f) => f.scene.visibleObjectIds.slice().sort();
const ids = (modeles, niveaux) => modeles.flatMap((m) => niveaux.map((n) => m + "-L" + n)).sort();
const TOUS = MODELES.map((m) => m[1]);
const photo = (scene) => JSON.stringify(Object.entries(scene.objects).map(([id, o]) => [id, o.visible, o.opacity, o.xrayed, o.edges, o.highlighted]));
const coches = (etat) => [[...etat.maquettes].filter(([, v]) => v).map(([k]) => k), [...etat.niveaux].filter(([, v]) => v).map(([k]) => k)];

// ---------- Scenario de reference ----------
test("scenario de Gilles : niveaux 2 et 4, puis uniquement la structure, puis les cloisons en surbrillance, puis la zone ouest", () => {
  const f = fabrique();
  // 1) niveaux 2 et 4, toutes les maquettes
  assert.equal(f.flux.proposer(afficher({ niveaux: ["Level 2", "Level 4"] })).ok, true);
  f.flux.accepter();
  assert.deepEqual(visibles(f), ids(TOUS, [2, 4]));
  // 2) uniquement la maquette structure : la facette niveaux est CONSERVEE
  assert.equal(f.flux.proposer(afficher({ maquettes: ["Structure"] })).ok, true);
  f.flux.accepter();
  assert.deepEqual(visibles(f), ids(["col", "swall"], [2, 4]), "structure sur les niveaux 2 et 4 seulement");
  assert.deepEqual(coches(f.drawer()), [["struct"], ["Level 2", "Level 4"]]);
  // 3) les cloisons (murs) en surbrillance : une COUCHE, rien n'est masque de la vue courante
  const avant3 = visibles(f);
  const r3 = f.flux.proposer(afficher({ typesIfc: ["IfcWallStandardCase"], presentation: "evidence" }));
  assert.equal(r3.ok, true);
  f.flux.accepter();
  assert.deepEqual(visibles(f), avant3, "la mise en evidence ne restreint pas la vue");
  assert.deepEqual(f.scene.highlightedObjectIds.sort(), ids(["swall"], [2, 4]));
  // 4) centrer sur la zone ouest : facette zone + cadrage ; les couches restent actives
  const vols = f.vols.length;
  assert.equal(f.flux.proposer(afficher({ zones: ["Zone ouest"] })).ok, true);
  f.flux.accepter();
  assert.deepEqual(visibles(f), ids(["col", "swall"], [2]), "niveau 4 hors de la zone ouest");
  assert.deepEqual(f.scene.highlightedObjectIds.sort(), ids(["swall"], [2]), "la couche de surbrillance suit la vue");
  assert.equal(f.vols.length, vols + 1, "la camera se pose sur la selection");
  assert.deepEqual(coches(f.drawer()), [["struct"], ["Level 2"]]);
});

test("« Non » n'annule que la derniere etape : retour exact a la vue d'avant, cases du drawer comprises", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2", "Level 4"] })); f.flux.accepter();
  f.flux.proposer(afficher({ maquettes: ["Structure"] })); f.flux.accepter();
  const avant = photo(f.scene);
  const cochesAvant = coches(f.drawer());
  f.flux.proposer(afficher({ typesIfc: ["IfcColumn"], niveaux: ["Level 2"] }, "les poteaux du niveau 2"));
  assert.notEqual(photo(f.scene), avant);
  assert.deepEqual(f.flux.refuser(), { phrase: "les poteaux du niveau 2" });
  assert.equal(photo(f.scene), avant, "la vue des etapes validees est rendue a l'identique");
  assert.deepEqual(coches(f.drawer()), cochesAvant);
  assert.equal(f.flux.etapes(), 2);
  assert.deepEqual(visibles(f), ids(["col", "swall"], [2, 4]), "les etapes precedentes restent");
});

test("« Non » sur la premiere etape : retour a la maquette d'origine", () => {
  const f = fabrique();
  const origine = photo(f.scene);
  f.flux.proposer(afficher({ niveaux: ["Level 2"] }));
  f.flux.refuser();
  assert.equal(photo(f.scene), origine);
  assert.equal(f.moteur.active(), false);
});

// ---------- Modes ----------
test("modes : remplacer (defaut) garde les autres criteres, ajouter fait l'union, retirer enleve la valeur", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  f.flux.proposer(afficher({ niveaux: ["Level 3"], modeNiveaux: "ajouter" })); f.flux.accepter();
  assert.deepEqual(visibles(f), ids(TOUS, [2, 3]), "ajoute le niveau 3");
  f.flux.proposer(afficher({ niveaux: ["Level 2"], modeNiveaux: "retirer" })); f.flux.accepter();
  assert.deepEqual(visibles(f), ids(TOUS, [3]), "enleve le niveau 2");
  f.flux.proposer(afficher({ niveaux: ["Level 1"] })); f.flux.accepter();
  assert.deepEqual(visibles(f), ids(TOUS, [1]), "remplacer");
});

test("retirer sur un critere inactif = exclusion (« tout sauf le niveau 2 »), ajouter sur un critere inactif est refuse (rien a ajouter)", () => {
  const f = fabrique();
  const r = f.flux.proposer(afficher({ niveaux: ["Level 3"], modeNiveaux: "ajouter" }));
  assert.equal(r.ok, false);
  assert.match(r.message, /ne change rien/);
  assert.equal(f.flux.etapes(), 0);
  f.flux.proposer(afficher({ niveaux: ["Level 2"], modeNiveaux: "retirer" })); f.flux.accepter();
  assert.deepEqual(visibles(f), ids(TOUS, [1, 3, 4]));
  f.flux.proposer(afficher({ maquettes: ["Architecture"], modeMaquettes: "retirer" })); f.flux.accepter();
  assert.deepEqual(visibles(f), ids(["duct", "pipe", "col", "swall"], [1, 3, 4]), "les exclusions se cumulent");
});

test("retirer la derniere valeur d'un critere le rend inactif ; ajouter reintegre une valeur exclue", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  f.flux.proposer(afficher({ maquettes: ["Structure"] })); f.flux.accepter();
  f.flux.proposer(afficher({ niveaux: ["Level 2"], modeNiveaux: "retirer" })); f.flux.accepter();
  assert.deepEqual(visibles(f), ids(["col", "swall"], NIVEAUX), "plus de critere niveau : tous les niveaux de la structure");
  const exclu = fabrique();
  exclu.flux.proposer(afficher({ niveaux: ["Level 2"], modeNiveaux: "retirer" })); exclu.flux.accepter();
  exclu.flux.proposer(afficher({ niveaux: ["Level 2"], modeNiveaux: "ajouter" })); exclu.flux.accepter();
  assert.deepEqual(visibles(exclu), ids(TOUS, NIVEAUX), "le niveau 2 est de nouveau la");
});

test("repartir de zero : criteres, couches et focus effaces avant la commande", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  f.flux.proposer(afficher({ typesIfc: ["IfcColumn"], presentation: "evidence" })); f.flux.accepter();
  f.flux.proposer(afficher({ maquettes: ["Mechanical (CVC)"], repartir: true })); f.flux.accepter();
  assert.deepEqual(visibles(f), ids(["duct", "pipe"], NIVEAUX), "le niveau 2 a ete oublie");
  assert.deepEqual(f.scene.highlightedObjectIds, [], "la couche aussi");
});

// ---------- Couches et focus ----------
test("couches : transparence puis surbrillance s'empilent, masquer agit sur la vue courante, tout est defait par Non", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ typesIfc: ["IfcWallStandardCase"], presentation: "transparence", cadrer: false })); f.flux.accepter();
  f.flux.proposer(afficher({ maquettes: ["Architecture"], presentation: "evidence", cadrer: false })); f.flux.accepter();
  const murs = ids(["wall", "swall"], NIVEAUX);
  assert.ok(murs.every((id) => f.scene.objects[id].opacity === OPACITE_TRANSPARENT), "la transparence reste active");
  assert.deepEqual(f.scene.highlightedObjectIds.sort(), ids(["wall", "ceil"], NIVEAUX));
  const avant = photo(f.scene);
  f.flux.proposer(afficher({ typesIfc: ["IfcCovering"], presentation: "masquer", cadrer: false }));
  assert.deepEqual(f.scene.objects["ceil-L2"].visible, false);
  f.flux.refuser();
  assert.equal(photo(f.scene), avant);
});

test("une couche ne s'applique qu'a ce qui est visible ; si rien n'est visible, elle est refusee sans rien empiler", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ maquettes: ["Structure"] })); f.flux.accepter();
  const r = f.flux.proposer(afficher({ maquettes: ["Mechanical (CVC)"], presentation: "evidence" }));
  assert.equal(r.ok, false);
  assert.match(r.message, /Aucun élément/);
  assert.equal(f.flux.etapes(), 1);
});

test("focus : vue rapprochee temporaire, remplacee par un autre focus, tombee des qu'une autre commande est acceptee, annulable", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  const vueSansFocus = photo(f.scene);
  assert.equal(f.flux.proposer(afficher({ elements: ["duct-L2"], presentation: "focus" })).ok, true);
  assert.equal(f.scene.objects["pipe-L2"].opacity, OPACITE_CONTEXTE + 0, "contexte proche de l'element");
  f.flux.refuser();
  assert.equal(photo(f.scene), vueSansFocus, "Non rend la vue d'avant");
  f.flux.proposer(afficher({ elements: ["duct-L2"], presentation: "focus" })); f.flux.accepter();
  f.flux.proposer(afficher({ niveaux: ["Level 3"], modeNiveaux: "ajouter" })); f.flux.accepter();
  assert.deepEqual(f.scene.xrayedObjectIds, [], "le focus est tombe");
  assert.deepEqual(visibles(f), ids(TOUS, [2, 3]));
});

// ---------- Cas limites ----------
test("zero element : rien n'est empile, la vue ne bouge pas ; une demande sans effet est refusee", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  const avant = photo(f.scene);
  const r = f.flux.proposer(afficher({ niveaux: ["Level 9"], typesIfc: ["IfcColumn"], maquettes: ["Mechanical (CVC)"] }));
  assert.equal(r.ok, false);
  assert.match(r.message, /Aucun élément/);
  assert.equal(photo(f.scene), avant);
  assert.equal(f.flux.etapes(), 1);
  assert.equal(f.flux.proposer(afficher({ niveaux: ["Level 2"] })).ok, false, "meme critere : rien ne change");
  assert.equal(f.flux.proposer({ action: "danser" }).ok, false);
});

test("elements exclus du Viewer : jamais touches, ni rendus visibles par une vue sans filtre", () => {
  const f = fabrique({ exclus: new Set(["col-L2"]) });
  f.scene.objects["col-L2"].visible = false;
  f.flux.proposer(afficher({ niveaux: ["Level 2"], typesIfc: ["IfcColumn"], modeTypesIfc: "retirer" })); f.flux.accepter();
  assert.equal(f.scene.objects["col-L2"].visible, false);
});

test("tout reafficher vide la pile ; une phrase « tout reafficher » aussi, sans question", () => {
  const f = fabrique();
  const origine = photo(f.scene);
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  f.flux.proposer(afficher({ typesIfc: ["IfcColumn"], presentation: "evidence" })); f.flux.accepter();
  f.flux.toutReafficher();
  assert.equal(f.flux.etapes(), 0);
  assert.equal(photo(f.scene), origine);
  f.flux.proposer(afficher({ niveaux: ["Level 3"] })); f.flux.accepter();
  const r = f.flux.proposer({ action: "tout_afficher" });
  assert.deepEqual([r.ok, r.confirmation], [true, false]);
  assert.equal(f.flux.etapes(), 0);
  assert.equal(photo(f.scene), origine);
});

test("sortie du Viewer : la pile est videe et la scene d'origine restauree", () => {
  const f = fabrique();
  const origine = photo(f.scene);
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  f.flux.proposer(afficher({ maquettes: ["Structure"] }));
  assert.equal(f.flux.abandonner(), true);
  assert.equal(photo(f.scene), origine);
  assert.equal(f.flux.etapes(), 0);
});

test("une proposition pendant une question remplace l'etape en attente ; si elle echoue, l'etape en attente reste", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2"] }));
  f.flux.proposer(afficher({ niveaux: ["Level 3"] }));
  assert.equal(f.flux.etapes(), 1, "pas d'empilement");
  assert.deepEqual(visibles(f), ids(TOUS, [3]));
  assert.equal(f.flux.proposer(afficher({ niveaux: ["Level 9"] })).ok, false);
  assert.deepEqual(visibles(f), ids(TOUS, [3]), "l'etape en attente est restee");
  assert.equal(f.flux.enAttente(), true);
});

test("le drawer est signale une fois par rendu, pas une fois par couche", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2"] })); f.flux.accepter();
  const avant = f.signaux.length;
  f.flux.proposer(afficher({ typesIfc: ["IfcColumn"], presentation: "evidence" }));
  assert.equal(f.signaux.length - avant, 1);
});

// ---------- Contexte ----------
test("contexte : « les gaines du niveau 2 avec comme maquette de contexte uniquement la structure » (retour de Gilles) et cases du drawer", () => {
  const f = fabrique();
  const r = f.flux.proposer(afficher({ typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"], presentation: "niveau_repere", contexteMaquettes: ["Structure"] }));
  assert.equal(r.ok, true);
  assert.equal(r.relecture, "Afficher les gaines du niveau 2 avec la maquette Structure en contexte");
  const o = f.scene.objects;
  assert.deepEqual([o["duct-L2"].visible, o["duct-L2"].opacity], [true, 1], "la selection n'est jamais filtree par le contexte (maquette mecanique)");
  for (const id of ["col-L2", "swall-L2"]) assert.deepEqual([o[id].visible, o[id].opacity], [true, OPACITE_CONTEXTE], id + " : structure en transparence legere");
  for (const id of ids(["wall", "ceil"], NIVEAUX)) assert.equal(o[id].visible, false, id + " : l'architecture est masquee, pas seulement transparente");
  assert.equal(o["pipe-L2"].visible, false, "la mecanique hors selection est du contexte hors filtre : masquee");
  assert.equal(o["duct-L3"].visible, false, "autres niveaux masques");
  // Cases du drawer : Architecture decochee, Mecanique et Structure cochees, niveau 2 seul coche.
  assert.deepEqual(coches(f.drawer()), [["mep", "struct"], ["Level 2"]]);
});

test("contexte dans la vue cumulative : ajouter l'architecture, retirer la structure, sans contexte", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"], presentation: "niveau_repere", contexteMaquettes: ["Structure"] })); f.flux.accepter();
  f.flux.proposer(afficher({ contexteMaquettes: ["Architecture"], modeContexteMaquettes: "ajouter" })); f.flux.accepter();
  assert.deepEqual(coches(f.drawer())[0], ["mep", "arch", "struct"], "l'architecture est ajoutee au contexte");
  assert.equal(f.scene.objects["wall-L2"].opacity, OPACITE_CONTEXTE);
  f.flux.proposer(afficher({ contexteMaquettes: ["Structure"], modeContexteMaquettes: "retirer" })); f.flux.accepter();
  assert.equal(f.scene.objects["col-L2"].visible, false, "la structure n'est plus dans le contexte");
  assert.equal(f.scene.objects["wall-L2"].visible, true);
  f.flux.proposer(afficher({ sansContexte: true })); f.flux.accepter();
  assert.deepEqual(visibles(f), ["duct-L2"], "seule la selection reste visible");
  assert.deepEqual(coches(f.drawer()), [["mep"], ["Level 2"]]);
  // un contexte redefini apres « sans contexte » revient
  f.flux.proposer(afficher({ contexteMaquettes: ["Architecture"], modeContexteMaquettes: "ajouter" })); f.flux.accepter();
  assert.ok(f.scene.objects["wall-L2"].visible);
  assert.equal(f.scene.objects["col-L2"].visible, false);
});

test("contexte : un « Non » rend le contexte d'avant ; la relecture reste courte", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"], presentation: "niveau_repere" })); f.flux.accepter();
  const avant = photo(f.scene);
  const r = f.flux.proposer(afficher({ sansContexte: true }));
  assert.equal(r.relecture, "Retirer le contexte");
  f.flux.refuser();
  assert.equal(photo(f.scene), avant);
});

// ---------- Etat envoye a l'IA ----------
test("etat pour l'IA : criteres, exclusions, couches, nombre d'etapes, rien d'autre que des mots", () => {
  const f = fabrique();
  f.flux.proposer(afficher({ niveaux: ["Level 2", "Level 4"] })); f.flux.accepter();
  f.flux.proposer(afficher({ maquettes: ["Architecture"], modeMaquettes: "retirer" })); f.flux.accepter();
  f.flux.proposer(afficher({ typesIfc: ["IfcColumn"], presentation: "evidence" }));
  const etat = f.flux.etatPourIA();
  assert.equal(etat.etapes, 3);
  assert.deepEqual(etat.facettes.niveaux, ["Level 2", "Level 4"]);
  assert.deepEqual(etat.exclues.maquettes, ["Architecture"]);
  assert.deepEqual(etat.couches, ["Mettre en évidence les poteaux"]);
  assert.equal(JSON.stringify(etat).includes("["), true);
  assert.ok(JSON.stringify(etat).length < 2000);
});

test("reduire : pile vide = vue sans filtre ; etat toujours rendu", () => {
  const v = reduire([]);
  assert.equal(v.ok, true);
  assert.ok(Object.values(v.etat.facettes).every((x) => !x.valeurs.length && !x.exclues.length));
});
