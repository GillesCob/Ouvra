// Tests du moteur de commandes du Viewer (src/commandesViewer.js) avec une FAUSSE scene et de FAUSSES metadonnees : aucun navigateur, aucun xeokit.
import test from "node:test";
import assert from "node:assert/strict";
import {
  REGISTRE, creerRegistre, validerCommande, creerControleur, canoniqueNiveau, libelleTypeIfc
} from "../src/commandesViewer.js";

const maquettes = [{ id: "hosp-mep", label: "Mechanical (CVC)" }, { id: "hosp-arch", label: "Architecture" }];

// Maquette factice a l'image de l'hopital : etages Level 1, Level 2 et Level 2 Ceiling (plenum du niveau 2), gaines, raccords, tuyau, murs.
function fabrique() {
  const metaObjects = {};
  const ajouter = (id, type, name, parent, maquette) => {
    metaObjects[id] = { id, type, name, parent: parent ? metaObjects[parent] : null, metaModels: [{ id: maquette }] };
  };
  ajouter("L1", "IfcBuildingStorey", "Level 1", null, "hosp-mep");
  ajouter("L2", "IfcBuildingStorey", "Level 2", null, "hosp-mep");
  ajouter("L2c", "IfcBuildingStorey", "Level 2 Ceiling", null, "hosp-mep");
  ajouter("A1", "IfcBuildingStorey", "Level 1", null, "hosp-arch");
  ajouter("A2", "IfcBuildingStorey", "Level 2", null, "hosp-arch");
  ajouter("duct-n1", "IfcDuctSegment", "Rectangular Duct:Mitered Elbows:100", "L1", "hosp-mep");
  ajouter("duct-n2", "IfcDuctSegment", "Rectangular Duct:Mitered Elbows:200", "L2", "hosp-mep");
  ajouter("fit-n2", "IfcDuctFitting", "Rectangular Elbow:Mitered:300", "L2c", "hosp-mep");
  ajouter("pipe-n2", "IfcPipeSegment", "Pipe Types:Standard:400", "L2", "hosp-mep");
  ajouter("diff-n2", "IfcAirTerminal", "Diffuseur Épuré:Plafond:450", "L2", "hosp-mep");
  ajouter("mur-n1", "IfcWallStandardCase", "Basic Wall:Generic 200mm:500", "A1", "hosp-arch");
  ajouter("mur-n2", "IfcWallStandardCase", "Basic Wall:Generic 200mm:600", "A2", "hosp-arch");
  ajouter("rail", "IfcRailing", "Railing:Garde-corps:700", "A1", "hosp-arch");
  const idsEntites = Object.keys(metaObjects).filter((id) => !["L1", "L2", "L2c", "A1", "A2"].includes(id));
  const objects = {};
  idsEntites.forEach((id) => { objects[id] = { visible: true, highlighted: false, xrayed: false }; });
  const appels = [];
  const dans = (ids) => (Array.isArray(ids) ? ids : [ids]).filter((id) => objects[id]);
  const scene = {
    objects,
    get visibleObjectIds() { return Object.keys(objects).filter((id) => objects[id].visible); },
    get highlightedObjectIds() { return Object.keys(objects).filter((id) => objects[id].highlighted); },
    get xrayedObjectIds() { return Object.keys(objects).filter((id) => objects[id].xrayed); },
    setObjectsVisible(ids, v) { appels.push(["visible", v, ids.length]); dans(ids).forEach((id) => { objects[id].visible = v; }); },
    setObjectsHighlighted(ids, v) { appels.push(["surbrillance", v, ids.length]); dans(ids).forEach((id) => { objects[id].highlighted = v; }); },
    setObjectsXRayed(ids, v) { appels.push(["xray", v, ids.length]); dans(ids).forEach((id) => { objects[id].xrayed = v; }); },
    getAABB(ids) { appels.push(["aabb", ids.slice().sort()]); return [0, 0, 0, 1, 1, 1]; }
  };
  const vols = [];
  const cameraFlight = { cancel() { vols.push("cancel"); }, flyTo(options) { vols.push(options); } };
  return { scene, metaScene: { metaObjects }, cameraFlight, appels, vols };
}
const visibles = (scene) => scene.visibleObjectIds.slice().sort();
const gainesNiveau2 = { action: "afficher", parametres: { typesIfc: ["IfcDuctSegment", "IfcDuctFitting"], niveaux: ["Level 2"] } };

// La surbrillance est fausse par defaut (24/10) : les tests qui la verifient la demandent explicitement.
const avecSurbrillance = (commande) => ({ ...commande, parametres: { ...commande.parametres, surbrillance: true } });

function controleurDe(f, extra = {}) {
  return creerControleur({ scene: f.scene, metaScene: f.metaScene, maquettes, cameraFlight: f.cameraFlight, ...extra });
}

// ---------- Registre ----------
test("registre : les deux actions de la v1 sont enregistrees", () => {
  assert.deepEqual(REGISTRE.noms().sort(), ["afficher", "tout_afficher"]);
});

test("registre : une nouvelle action s'ajoute sans toucher au reste", () => {
  const registre = creerRegistre();
  registre.enregistrer({
    nom: "compter", description: "Compte", parametres: [],
    preparer: () => ({ ids: ["a"] }), appliquer: () => null, libelle: () => "un"
  });
  assert.deepEqual(registre.noms(), ["compter"]);
  assert.equal(REGISTRE.trouver("compter"), null, "le registre par defaut n'est pas modifie");
});

test("registre : action mal formee ou en double refusee", () => {
  const registre = creerRegistre();
  assert.throws(() => registre.enregistrer({}), /nom/);
  assert.throws(() => registre.enregistrer({ nom: "x", parametres: [], preparer: () => ({}), appliquer: () => null }), /libelle/);
  const def = { nom: "x", parametres: [], preparer: () => ({ ids: [] }), appliquer: () => null, libelle: () => "" };
  registre.enregistrer(def);
  assert.throws(() => registre.enregistrer(def), /déjà/);
});

// ---------- Validation ----------
test("validerCommande : nominal, isoler et cadrer vrais par defaut, surbrillance fausse", () => {
  const v = validerCommande(gainesNiveau2, null);
  assert.equal(v.ok, true);
  assert.deepEqual(v.commande.parametres, {
    typesIfc: ["IfcDuctSegment", "IfcDuctFitting"], niveaux: ["Level 2"], maquettes: [], noms: [], elements: [], zones: [], contexteMaquettes: [], contexteTypesIfc: [], sansContexte: false, repartir: false,
    modeTypesIfc: "remplacer", modeNiveaux: "remplacer", modeMaquettes: "remplacer", modeNoms: "remplacer", modeElements: "remplacer", modeZones: "remplacer",
    modeContexteMaquettes: "remplacer", modeContexteTypesIfc: "remplacer",
    presentation: "isoler", rayonMetres: 0, isoler: true, surbrillance: false, cadrer: true
  });
});

test("validerCommande : entree vide ou invalide", () => {
  for (const mauvais of [null, undefined, "afficher", [], {}, { action: "" }, { action: "danser" }]) {
    assert.equal(validerCommande(mauvais, null).ok, false, JSON.stringify(mauvais));
  }
  assert.match(validerCommande({ action: "danser" }, null).erreur, /inconnue/);
});

test("validerCommande : parametre inconnu, mal type, valeur absente de la maquette", () => {
  assert.equal(validerCommande({ action: "afficher", parametres: { couleur: ["rouge"] } }, null).ok, false);
  assert.equal(validerCommande({ action: "afficher", parametres: { typesIfc: "IfcWall" } }, null).ok, false);
  assert.equal(validerCommande({ action: "afficher", parametres: { typesIfc: [3] } }, null).ok, false);
  assert.equal(validerCommande({ action: "afficher", parametres: { typesIfc: ["IfcWall"], isoler: "oui" } }, null).ok, false);
  const valeurs = { typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"], maquettes: [], noms: [] };
  const refus = validerCommande({ action: "afficher", parametres: { typesIfc: ["IfcRadiateur"] } }, valeurs);
  assert.equal(refus.ok, false);
  assert.match(refus.erreur, /IfcRadiateur/);
});

test("validerCommande : la valeur est reprise telle que presente dans la maquette (casse)", () => {
  const valeurs = { typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"], maquettes: [], noms: [] };
  const v = validerCommande({ action: "afficher", parametres: { typesIfc: ["ifcductsegment"] } }, valeurs);
  assert.equal(v.ok, true);
  assert.deepEqual(v.commande.parametres.typesIfc, ["IfcDuctSegment"]);
});

test("validerCommande : « afficher » sans aucun critere est refusee, « tout_afficher » n'en demande aucun", () => {
  const vide = validerCommande({ action: "afficher", parametres: { isoler: true } }, null);
  assert.equal(vide.ok, false);
  assert.match(vide.erreur, /critère/);
  assert.equal(validerCommande({ action: "tout_afficher" }, null).ok, true);
  assert.equal(validerCommande({ action: "tout_afficher", parametres: { isoler: true } }, null).ok, false);
});

// ---------- Niveaux et libelles ----------
test("canoniqueNiveau : meme regroupement que les niveaux du drawer", () => {
  assert.equal(canoniqueNiveau("Level 2 Ceiling"), "Level 2");
  assert.equal(canoniqueNiveau("Level 3 TOS"), "Level 3");
  assert.equal(canoniqueNiveau("Level 7A"), "Level 7");
  assert.equal(canoniqueNiveau("Level 7A TOS"), "Level 7");
  assert.equal(canoniqueNiveau("Level 2"), "Level 2");
  assert.equal(canoniqueNiveau(""), "");
});

test("libelleTypeIfc : francais pour les types connus, nom IFC sinon", () => {
  assert.equal(libelleTypeIfc("IfcDuctSegment"), "gaines");
  assert.equal(libelleTypeIfc("IfcInconnu"), "IfcInconnu");
});

// ---------- Preparation (aucun effet de bord) ----------
test("preparer : gaines du niveau 2 = types ET niveau, le plenum du niveau 2 compte", () => {
  const f = fabrique();
  const plan = controleurDe(f).preparer(gainesNiveau2);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.ids.slice().sort(), ["duct-n2", "fit-n2"]);
  assert.equal(plan.compte, 2);
  assert.equal(plan.vide, false);
  assert.deepEqual(f.appels.filter((a) => a[0] !== "aabb"), [], "aucune ecriture dans la scene");
  assert.equal(visibles(f.scene).length, Object.keys(f.scene.objects).length);
});

test("preparer : plusieurs types se cumulent (OU), un critere vide ne filtre pas", () => {
  const f = fabrique();
  const plan = controleurDe(f).preparer({ action: "afficher", parametres: { typesIfc: ["IfcDuctSegment", "IfcPipeSegment"], niveaux: [] } });
  assert.deepEqual(plan.ids.slice().sort(), ["duct-n1", "duct-n2", "pipe-n2"]);
});

test("preparer : niveau seul, maquette seule, nom sans accent ni casse", () => {
  const f = fabrique();
  const c = controleurDe(f);
  assert.deepEqual(c.preparer({ action: "afficher", parametres: { niveaux: ["Level 1"] } }).ids.slice().sort(), ["duct-n1", "mur-n1", "rail"]);
  assert.deepEqual(c.preparer({ action: "afficher", parametres: { maquettes: ["Architecture"] } }).ids.slice().sort(), ["mur-n1", "mur-n2", "rail"]);
  assert.deepEqual(c.preparer({ action: "afficher", parametres: { noms: ["diffuseur epure"] } }).ids, ["diff-n2"]);
});

test("preparer : « Level 2 » ne vise pas un autre niveau et la maquette combine en ET", () => {
  const f = fabrique();
  const plan = controleurDe(f).preparer({ action: "afficher", parametres: { niveaux: ["Level 2"], maquettes: ["Architecture"] } });
  assert.deepEqual(plan.ids, ["mur-n2"]);
});

test("preparer : zero element trouve = vide, avec un message clair", () => {
  const f = fabrique();
  const plan = controleurDe(f).preparer({ action: "afficher", parametres: { typesIfc: ["IfcDuctSegment"], niveaux: ["Level 9"] } });
  assert.equal(plan.ok, true);
  assert.equal(plan.vide, true);
  assert.equal(plan.compte, 0);
  assert.match(plan.resume, /Aucun élément/);
});

test("preparer : commande invalide = refus avec la raison", () => {
  const f = fabrique();
  const plan = controleurDe(f).preparer({ action: "danser" });
  assert.equal(plan.ok, false);
  assert.match(plan.erreur, /inconnue/);
});

test("preparer : le resume nomme ce qui est trouve et les effets", () => {
  const f = fabrique();
  const plan = controleurDe(f).preparer(gainesNiveau2);
  assert.match(plan.resume, /2 éléments/);
  assert.match(plan.resume, /gaines/);
  assert.match(plan.resume, /niveau 2/i);
  assert.match(plan.resume, /masqué/);
  assert.doesNotMatch(plan.resume, /surbrillance/);
  const avec = controleurDe(f).preparer(avecSurbrillance(gainesNiveau2));
  assert.match(avec.resume, /surbrillance/);
});

test("preparer : les elements exclus (garde-corps mal places) ne sont jamais trouves", () => {
  const f = fabrique();
  const plan = controleurDe(f, { exclus: new Set(["rail"]) }).preparer({ action: "afficher", parametres: { niveaux: ["Level 1"] } });
  assert.deepEqual(plan.ids.slice().sort(), ["duct-n1", "mur-n1"]);
});

// ---------- Application et annulation ----------
test("appliquer : isole, met en surbrillance et cadre la camera sur les elements trouves", () => {
  const f = fabrique();
  const c = controleurDe(f);
  const r = c.appliquer(c.preparer(avecSurbrillance(gainesNiveau2)));
  assert.equal(r.ok, true);
  assert.deepEqual(visibles(f.scene), ["duct-n2", "fit-n2"]);
  assert.deepEqual(f.scene.highlightedObjectIds.slice().sort(), ["duct-n2", "fit-n2"]);
  const vol = f.vols.find((v) => typeof v === "object");
  assert.deepEqual(vol.aabb, [0, 0, 0, 1, 1, 1]);
  assert.ok(vol.duration > 0);
  assert.equal(c.active(), true);
  assert.match(r.message, /2 éléments/);
});

test("appliquer : sans isoler, rien n'est masque ; sans surbrillance ni cadrage, ni l'un ni l'autre", () => {
  const f = fabrique();
  const c = controleurDe(f);
  c.appliquer(c.preparer({ action: "afficher", parametres: { typesIfc: ["IfcDuctSegment"], isoler: false, surbrillance: false, cadrer: false } }));
  assert.equal(visibles(f.scene).length, Object.keys(f.scene.objects).length);
  assert.deepEqual(f.scene.highlightedObjectIds, []);
  assert.deepEqual(f.vols, []);
});

test("appliquer : un element trouve mais masque par ailleurs redevient visible", () => {
  const f = fabrique();
  f.scene.objects["duct-n2"].visible = false;
  const c = controleurDe(f);
  c.appliquer(c.preparer(gainesNiveau2));
  assert.equal(f.scene.objects["duct-n2"].visible, true);
});

test("reinitialiser : remet exactement l'etat d'avant, y compris ce qui etait deja masque", () => {
  const f = fabrique();
  f.scene.objects["mur-n1"].visible = false;
  const avant = visibles(f.scene);
  const c = controleurDe(f);
  c.appliquer(c.preparer(gainesNiveau2));
  assert.equal(c.reinitialiser(), true);
  assert.deepEqual(visibles(f.scene), avant);
  assert.deepEqual(f.scene.highlightedObjectIds, []);
  assert.equal(c.active(), false);
  assert.equal(c.reinitialiser(), false, "rien a annuler la deuxieme fois");
});

test("appliquer deux fois : la deuxieme commande part de l'etat d'origine, pas de la premiere", () => {
  const f = fabrique();
  const c = controleurDe(f);
  c.appliquer(c.preparer(avecSurbrillance(gainesNiveau2)));
  c.appliquer(c.preparer({ action: "afficher", parametres: { typesIfc: ["IfcWallStandardCase"], surbrillance: true } }));
  assert.deepEqual(visibles(f.scene), ["mur-n1", "mur-n2"]);
  assert.deepEqual(f.scene.highlightedObjectIds.slice().sort(), ["mur-n1", "mur-n2"]);
  c.reinitialiser();
  assert.equal(visibles(f.scene).length, Object.keys(f.scene.objects).length);
});

test("appliquer : zero element = refus, rien n'est applique", () => {
  const f = fabrique();
  const c = controleurDe(f);
  const r = c.appliquer(c.preparer({ action: "afficher", parametres: { niveaux: ["Level 9"] } }));
  assert.equal(r.ok, false);
  assert.match(r.message, /Aucun élément/);
  assert.deepEqual(f.appels.filter((a) => a[0] !== "aabb"), []);
  assert.equal(c.active(), false);
});

test("appliquer : un plan refuse ne s'applique pas", () => {
  const f = fabrique();
  const c = controleurDe(f);
  assert.equal(c.appliquer(c.preparer({ action: "danser" })).ok, false);
  assert.equal(c.appliquer(null).ok, false);
});

test("tout_afficher : tout redevient visible, surbrillance et x-ray retires, sauf les elements exclus", () => {
  const f = fabrique();
  const c = controleurDe(f, { exclus: new Set(["rail"]) });
  f.scene.objects.rail.visible = false;
  f.scene.objects["mur-n1"].xrayed = true;
  f.scene.objects["mur-n2"].visible = false;
  c.appliquer(c.preparer(gainesNiveau2));
  const r = c.appliquer(c.preparer({ action: "tout_afficher" }));
  assert.equal(r.ok, true);
  assert.deepEqual(f.scene.highlightedObjectIds, []);
  assert.deepEqual(f.scene.xrayedObjectIds, []);
  assert.equal(f.scene.objects["mur-n2"].visible, true);
  assert.equal(f.scene.objects.rail.visible, false, "garde-corps exclu : jamais rendu visible");
  assert.equal(c.active(), false);
});

test("le rappel « apres » est appele avec le nom de l'action appliquee", () => {
  const f = fabrique();
  const noms = [];
  const c = controleurDe(f, { apres: (nom) => noms.push(nom) });
  c.appliquer(c.preparer(gainesNiveau2));
  c.appliquer(c.preparer({ action: "tout_afficher" }));
  assert.deepEqual(noms, ["afficher", "tout_afficher"]);
});

test("creerControleur : scene absente = erreur explicite", () => {
  assert.throws(() => creerControleur({}), /Scène absente/);
  assert.throws(() => creerControleur({ scene: { objects: {} } }), /Métadonnées/);
});
