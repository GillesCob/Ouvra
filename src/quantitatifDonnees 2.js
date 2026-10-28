// Quantitatif (24/10) : de ce que l'application a en memoire aux « elements » que le moteur (src/quantitatif.js) sait compter.
// Deux sources, meme format d'element :
//  - elementsDepuisScene : maquettes deja chargees dans le Viewer (xeokit : metaScene + scene). Donne en plus la boite englobante de chaque
//    element (mesures estimees) et les jeux de proprietes de quantites (Qto) SI le modele en contient.
//  - elementsDepuisJson : metadonnees seules (public/models/hospital/*.json), SANS geometrie ni chargement des .xkt : leger, utilisable avant
//    que le Viewer ait fini de charger (mobile). Compter est exact, les mesures estimees sont alors « non disponibles ».
// Seuls des MOTS partent vers l'IA (valeursPourQuantitatif) : jamais la geometrie. Fonctions pures, hormis chargerElementsJson (reseau, injecte).

import { normaliser } from "./reglesCollision.js";
import { nomsProches } from "./reglesValeurs.js";
import { canoniqueNiveau } from "./commandesViewer.js";
import { TYPES_SPATIAUX, mesuresDisponibles } from "./quantitatif.js";

export const familleDe = (nom) => String(nom || "").replace(/:\d+$/, "");
const PSETS_QUANTITES = /^(Qto_|BaseQuantities)/;

// Maquettes de l'hopital sans metadonnees JSON propres : leur version allegee, exportee des memes maquettes, sert de source (a dire a l'utilisateur).
export const METADONNEES_ALTERNATIVES = {
  "hosp-arch": "/models/hospital/legere/architectural.json",
  "hosp-mep": "/models/hospital/legere/mechanical.json"
};

// ---------- Metadonnees JSON ----------
// json : { metaObjects: [{ id, name, type, parent }] } (format xeokit metaModel). maquette : { id, label }.
export function elementsDepuisJson(json, maquette) {
  const objets = json && Array.isArray(json.metaObjects) ? json.metaObjects : [];
  const parId = new Map(objets.filter((o) => o && o.id !== undefined).map((o) => [o.id, o]));
  const niveaux = new Map();
  function niveauDe(objet, profondeur = 0) {
    if (!objet || profondeur > 60) return ""; // 60 : garde contre une parente cyclique
    if (niveaux.has(objet.id)) return niveaux.get(objet.id);
    const niveau = objet.type === "IfcBuildingStorey" ? canoniqueNiveau(objet.name) : niveauDe(parId.get(objet.parent), profondeur + 1);
    niveaux.set(objet.id, niveau);
    return niveau;
  }
  const elements = objets.filter((o) => o && typeof o === "object" && o.id !== undefined).map((o) => ({
    id: o.id,
    nom: String(o.name || ""),
    famille: familleDe(o.name),
    typeIfc: o.type || "",
    niveau: niveauDe(o),
    maquette: maquette.label,
    maquetteId: maquette.id,
    boite: null,
    quantites: null
  }));
  elements.capacites = { boites: false, quantites: false };
  return elements;
}

// ---------- Scene xeokit ----------
function niveauScene(metaObject) {
  let courant = metaObject;
  for (let garde = 0; courant && garde < 50; garde += 1) {
    if (courant.type === "IfcBuildingStorey") return canoniqueNiveau(courant.name);
    courant = courant.parent;
  }
  return "";
}

// Quantites des jeux de proprietes Qto_* / BaseQuantities d'un metaObject xeokit (propertySets : [{ name, properties: [{ name, value }] }]), ou null.
export function quantitesDe(metaObject) {
  const jeux = Array.isArray(metaObject.propertySets) ? metaObject.propertySets : [];
  const lues = {};
  for (const jeu of jeux) {
    if (!jeu || !PSETS_QUANTITES.test(String(jeu.name || ""))) continue;
    for (const p of jeu.properties || []) {
      const n = Number(p && p.value);
      if (p && typeof p.name === "string" && p.value !== "" && p.value !== null && Number.isFinite(n)) lues[p.name] = n;
    }
  }
  return Object.keys(lues).length ? lues : null;
}

// metaScene : viewer.metaScene ; scene : viewer.scene ; maquettes : [{ id, label }].
// La boite englobante n'est calculee qu'a la demande (fonction), pas pour des dizaines de milliers d'elements a l'ouverture de la page.
// exclus : Set d'identifiants hors perimetre (les memes que le Viewer : garde-corps mal places de l'hopital), non comptes et signales dans le resultat.
export function elementsDepuisScene({ metaScene, scene, maquettes, exclus = null }) {
  const tous = metaScene && metaScene.metaObjects ? Object.values(metaScene.metaObjects) : [];
  const objets = exclus && exclus.size ? tous.filter((mo) => !exclus.has(mo.id)) : tous;
  const etiquettes = new Map((maquettes || []).map((m) => [m.id, m.label]));
  const avecGeometrie = !!scene && !!scene.objects && Object.keys(scene.objects).length > 0;
  let quantites = false;
  const elements = objets.map((mo) => {
    const modele = (mo.metaModels || [])[0];
    const q = quantitesDe(mo);
    if (q) quantites = true;
    return {
      id: mo.id,
      nom: String(mo.name || ""),
      famille: familleDe(mo.name),
      typeIfc: mo.type || "",
      niveau: niveauScene(mo),
      maquette: modele ? etiquettes.get(modele.id) || modele.id : "",
      maquetteId: modele ? modele.id : "",
      boite: avecGeometrie ? () => { const e = scene.objects[mo.id]; return e && e.aabb ? e.aabb : null; } : null,
      quantites: q
    };
  });
  elements.capacites = { boites: avecGeometrie, quantites };
  elements.horsPerimetre = tous.length - objets.length;
  return elements;
}

// ---------- Chargement des metadonnees sans geometrie ----------
// maquettes : [{ id, label, metaSrc? }]. Rend les sources a lire et celles qui n'en ont pas.
export function sourcesJson(maquettes) {
  const sources = [];
  const sansMetadonnees = [];
  for (const m of maquettes || []) {
    const url = m.metaSrc || METADONNEES_ALTERNATIVES[m.id];
    if (url) sources.push({ maquette: { id: m.id, label: m.label }, url, remplace: !m.metaSrc });
    else sansMetadonnees.push(m.label);
  }
  return { sources, sansMetadonnees };
}

// Lit les JSON (fetch injecte) ; une maquette illisible est signalee dans `notes`, les autres restent utilisables.
export async function chargerElementsJson(maquettes, { fetch: appel = (...a) => globalThis.fetch(...a), exclus = null } = {}) {
  const { sources, sansMetadonnees } = sourcesJson(maquettes);
  const notes = [];
  if (sansMetadonnees.length) notes.push("Sans métadonnées chargeables pour l'instant : " + sansMetadonnees.join(", ") + ".");
  const elements = [];
  let horsPerimetre = 0;
  await Promise.all(sources.map(async (s) => {
    try {
      const reponse = await appel(s.url);
      if (!reponse.ok) throw new Error("statut " + reponse.status);
      const liste = elementsDepuisJson(await reponse.json(), s.maquette);
      if (s.remplace) notes.push(s.maquette.label + " : métadonnées de la version allégée de la maquette.");
      liste.forEach((e) => { if (exclus && exclus.has(e.id)) horsPerimetre += 1; else elements.push(e); });
    } catch {
      notes.push("Métadonnées de « " + s.maquette.label + " » illisibles, maquette ignorée.");
    }
  }));
  elements.capacites = { boites: false, quantites: false };
  elements.horsPerimetre = horsPerimetre;
  return { elements, notes };
}

// ---------- Valeurs envoyees a l'IA (des mots) ----------
const MOTS_DE_QUESTION = new Set(["combien", "nombre", "liste", "listes", "quantite", "quantites", "longueur", "surface", "volume", "total", "totale", "estimee", "estime", "par", "type", "types"]);
const indexNoms = new WeakMap();

function metaPourNoms(elements) {
  if (!indexNoms.has(elements)) {
    const metaObjects = {};
    elements.forEach((e, i) => { if (!TYPES_SPATIAUX.has(e.typeIfc)) metaObjects[i] = { name: e.nom, type: e.typeIfc }; });
    indexNoms.set(elements, { metaObjects });
  }
  return indexNoms.get(elements);
}

// Plafonds du serveur (relais/entree.js) : au-dela, toute la requete serait rejetee. Une valeur trop longue est ecartee (elle ne peut pas etre tronquee : elle
// doit rester identique a celle de la maquette).
const LISTE_PLAFOND = 40;
const ELEMENT_PLAFOND = 80;
const ELEMENT_NOM_MAX = 160;
const borner = (liste) => liste.filter((v) => v.length <= ELEMENT_PLAFOND).slice(0, LISTE_PLAFOND);
const tri = (ensemble) => Array.from(ensemble).sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));

export function valeursPourQuantitatif(elements, phrase) {
  const types = new Set();
  const niveaux = new Set();
  const maquettes = new Set();
  for (const e of elements) {
    if (e.maquette) maquettes.add(e.maquette);
    if (TYPES_SPATIAUX.has(e.typeIfc)) continue;
    if (e.typeIfc) types.add(e.typeIfc);
    if (e.niveau) niveaux.add(e.niveau);
  }
  const mots = normaliser(phrase).split(/[^a-z0-9]+/).filter((m) => m && !MOTS_DE_QUESTION.has(m)).join(" ");
  return {
    typesIfc: borner(tri(types)),
    niveaux: borner(tri(niveaux)),
    maquettes: borner(tri(maquettes)),
    noms: nomsProches(metaPourNoms(elements), mots).map((n) => n.slice(0, ELEMENT_NOM_MAX)),
    mesures: mesuresDisponibles(elements)
  };
}
