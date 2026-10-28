// Tests du flux « appliquer tout de suite, puis confirmer ou annuler » (src/commandesFlux.js) avec le vrai moteur et une FAUSSE scene : aucun navigateur.
import test from "node:test";
import assert from "node:assert/strict";
import { creerControleur } from "../src/commandesViewer.js";
import { creerFlux } from "../src/commandesFlux.js";

function fabrique() {
  const metaObjects = {};
  const ajouter = (id, type, name, parent) => {
    metaObjects[id] = { id, type, name, parent: parent ? metaObjects[parent] : null, metaModels: [{ id: "hosp-mep" }] };
  };
  ajouter("L1", "IfcBuildingStorey", "Level 1", null);
  ajouter("L2", "IfcBuildingStorey", "Level 2", null);
  ajouter("duct-n1", "IfcDuctSegment", "Duct:100", "L1");
  ajouter("duct-n2", "IfcDuctSegment", "Duct:200", "L2");
  ajouter("pipe-n1", "IfcPipeSegment", "Pipe:300", "L1");
  ajouter("pipe-n2", "IfcPipeSegment", "Pipe:400", "L2");
  const objects = {};
  ["duct-n1", "duct-n2", "pipe-n1", "pipe-n2"].forEach((id) => { objects[id] = { visible: true, highlighted: false, xrayed: false }; });
  const dans = (ids) => (Array.isArray(ids) ? ids : [ids]).filter((id) => objects[id]);
  const scene = {
    objects,
    get visibleObjectIds() { return Object.keys(objects).filter((id) => objects[id].visible); },
    get highlightedObjectIds() { return Object.keys(objects).filter((id) => objects[id].highlighted); },
    get xrayedObjectIds() { return Object.keys(objects).filter((id) => objects[id].xrayed); },
    setObjectsVisible(ids, v) { dans(ids).forEach((id) => { objects[id].visible = v; }); },
    setObjectsHighlighted(ids, v) { dans(ids).forEach((id) => { objects[id].highlighted = v; }); },
    setObjectsXRayed(ids, v) { dans(ids).forEach((id) => { objects[id].xrayed = v; }); },
    getAABB() { return [0, 0, 0, 1, 1, 1]; }
  };
  const moteur = creerControleur({ scene, metaScene: { metaObjects }, maquettes: [], cameraFlight: { cancel() {}, flyTo() {} } });
  return { scene, moteur, flux: creerFlux({ moteur }) };
}
const visibles = (scene) => scene.visibleObjectIds.slice().sort();
const TOUS = ["duct-n1", "duct-n2", "pipe-n1", "pipe-n2"];
const gainesN2 = { action: "afficher", parametres: { typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"] }, demande: "gaines du niveau 2", relecture: "Afficher les gaines du niveau 2." };
const tuyauxN1 = { action: "afficher", parametres: { typesIfc: ["IfcPipeSegment"], niveaux: ["Level 1"] }, demande: "tuyaux du niveau 1" };

test("nominal : la commande est appliquee tout de suite et la question porte la relecture et le compte rendu", () => {
  const { scene, flux } = fabrique();
  const r = flux.proposer(gainesN2);
  assert.equal(r.ok, true);
  assert.deepEqual(visibles(scene), ["duct-n2"], "appliquee avant toute reponse");
  assert.equal(r.demande, "gaines du niveau 2");
  assert.equal(r.relecture, "Afficher les gaines du niveau 2", "relecture construite depuis la commande validee");
  assert.match(r.resume, /1 élément trouvé/);
  assert.equal(flux.enAttente(), true);
});

test("Oui : la commande reste appliquee, plus rien n'est en attente", () => {
  const { scene, moteur, flux } = fabrique();
  flux.proposer(gainesN2);
  assert.equal(flux.accepter(), true);
  assert.equal(flux.enAttente(), false);
  assert.deepEqual(visibles(scene), ["duct-n2"]);
  assert.equal(moteur.active(), true);
  assert.equal(flux.accepter(), false, "rien a accepter une seconde fois");
});

test("Non : la commande est annulee (retour a l'etat d'avant) et la phrase a reformuler est rendue", () => {
  const { scene, moteur, flux } = fabrique();
  flux.proposer(gainesN2);
  const retour = flux.refuser();
  assert.deepEqual(retour, { phrase: "gaines du niveau 2" });
  assert.deepEqual(visibles(scene), TOUS);
  assert.equal(moteur.active(), false);
  assert.equal(flux.enAttente(), false);
  assert.equal(flux.refuser(), null, "rien a refuser sans question posee");
});

test("Non apres une commande acceptee : on revient a cette commande, pas a la maquette d'origine", () => {
  const { scene, flux } = fabrique();
  flux.proposer(gainesN2);
  flux.accepter();
  flux.proposer(tuyauxN1);
  assert.deepEqual(visibles(scene), ["pipe-n1"]);
  flux.refuser();
  assert.deepEqual(visibles(scene), ["duct-n2"]);
});

test("zero element : rien n'est applique, pas de question", () => {
  const { scene, flux } = fabrique();
  const r = flux.proposer({ action: "afficher", parametres: { typesIfc: ["IfcDuctSegment"], niveaux: ["Level 1", "Level 9"], noms: ["inexistant"] } });
  assert.equal(r.ok, false);
  assert.match(r.message, /Aucun élément/);
  assert.deepEqual(visibles(scene), TOUS);
  assert.equal(flux.enAttente(), false);
});

test("commande invalide : message clair, rien n'est applique", () => {
  const { scene, flux } = fabrique();
  const r = flux.proposer({ action: "danser" });
  assert.equal(r.ok, false);
  assert.ok(r.message.length > 0);
  assert.deepEqual(visibles(scene), TOUS);
  assert.equal(flux.enAttente(), false);
});

test("une commande proposee pendant une question remplace l'ancienne sans empilement", () => {
  const { scene, flux } = fabrique();
  flux.proposer(gainesN2);
  const r = flux.proposer(tuyauxN1);
  assert.equal(r.ok, true);
  assert.deepEqual(visibles(scene), ["pipe-n1"], "la seconde a remplace la premiere");
  assert.deepEqual(flux.refuser(), { phrase: "tuyaux du niveau 1" });
  assert.deepEqual(visibles(scene), TOUS, "la premiere, jamais confirmee, n'est pas rejouee");
});

test("une proposition sans resultat laisse en place la commande en attente", () => {
  const { scene, flux } = fabrique();
  flux.proposer(gainesN2);
  assert.equal(flux.proposer({ action: "danser" }).ok, false);
  assert.deepEqual(visibles(scene), ["duct-n2"]);
  assert.equal(flux.enAttente(), true);
});

test("Tout reafficher : tout redevient visible, la question et le point de retour sont oublies", () => {
  const { scene, flux } = fabrique();
  flux.proposer(gainesN2);
  flux.accepter();
  flux.proposer(tuyauxN1);
  flux.toutReafficher();
  assert.deepEqual(visibles(scene), TOUS);
  assert.equal(flux.enAttente(), false);
  flux.proposer(gainesN2);
  flux.refuser();
  assert.deepEqual(visibles(scene), TOUS, "l'ancien point de retour n'est pas rejoue");
});

test("sortie du Viewer : la commande est defaite et plus rien n'est en attente", () => {
  const { scene, moteur, flux } = fabrique();
  flux.proposer(gainesN2);
  assert.equal(flux.abandonner(), true);
  assert.deepEqual(visibles(scene), TOUS);
  assert.equal(moteur.active(), false);
  assert.equal(flux.enAttente(), false);
  assert.equal(flux.abandonner(), false);
});

test("une phrase « tout reafficher » s'applique sans question (rien a annuler)", () => {
  const { scene, flux } = fabrique();
  flux.proposer(gainesN2);
  flux.accepter();
  const r = flux.proposer({ action: "tout_afficher", demande: "reaffiche tout", relecture: "Réafficher toute la maquette." });
  assert.equal(r.ok, true);
  assert.equal(r.confirmation, false);
  assert.deepEqual(visibles(scene), TOUS);
  assert.equal(flux.enAttente(), false);
});
