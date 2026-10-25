// Viewer par commande (24/10) : la couche SELECTEUR (« quoi »), separee de la couche presentation (« comment », src/commandesPresentations.js).
//
// Un selecteur = un objet { nom, description, parametres, fabriquer, decrire } enregistre dans un registre :
//   parametres : [{ nom, genre: "valeurs", source, description }] ; la source est une liste de valeurs permises ("typesIfc", "niveaux", "maquettes", "noms",
//     "zones" ...) lue sur la maquette reelle, que le relais IA transforme en enumeration fermee
//   fabriquer(parametres, contexte) : rend un test (element) => boolean, ou null si le selecteur n'est pas utilise par cette commande
//   decrire(parametres) : morceau de phrase pour le compte rendu, ou null
// Les selecteurs actifs se combinent en ET (« les gaines du niveau 2 » = type ET niveau) ; plusieurs valeurs d'un meme parametre se cumulent (OU).
// Ajouter un critere plus tard (IfcSpace, propriete...) = un appel a SELECTEURS.enregistrer(...), sans toucher au reste.
//
// element = { id, typeIfc, niveau, maquette, maquetteId, nom, nomExact, aabb } : valeurs deja normalisees (casse, accents) sauf id et aabb.
// contexte = { scene, metaScene, maquettes, exclus, zones } ; zones.trouver(nom) rend la boite d'une zone nommee (src/commandesZones.js) ou null.
// Module sans dependance a main.js ni au DOM.

import { descripteurElement, normaliser } from "./reglesCollision.js";
import { canoniqueNiveau, libelleTypeIfc, libelleNiveauCourt } from "./commandesLibelles.js";
import { centreAabb, estAabb, pointDansAabb } from "./commandesGeometrie.js";

export function creerRegistreSelecteurs() {
  const selecteurs = new Map();
  return {
    enregistrer(definition) {
      if (!definition || typeof definition.nom !== "string" || !definition.nom) throw new Error("Sélecteur sans nom.");
      if (selecteurs.has(definition.nom)) throw new Error("Sélecteur « " + definition.nom + " » déjà enregistré.");
      if (!Array.isArray(definition.parametres) || typeof definition.fabriquer !== "function" || typeof definition.decrire !== "function") {
        throw new Error("Sélecteur « " + definition.nom + " » : parametres, fabriquer et decrire attendus.");
      }
      selecteurs.set(definition.nom, definition);
    },
    trouver: (nom) => selecteurs.get(nom) || null,
    noms: () => Array.from(selecteurs.keys()),
    toutes: () => Array.from(selecteurs.values()),
    // Tous les parametres declares par les selecteurs, dans l'ordre d'enregistrement, chacun suivi de son MODE (comment le critere se combine avec la
    // vue actuelle : remplacer, ajouter ou retirer). Un selecteur ajoute plus tard recoit son mode tout seul.
    parametres: () => Array.from(selecteurs.values()).flatMap((s) => s.parametres.flatMap((p) => (p.genre === "valeurs" ? [p, parametreMode(p.nom)] : [p])))
  };
}

// Modes d'un critere dans la vue cumulative (src/commandesVue.js). « remplacer » est le defaut : « uniquement la maquette structure » remplace le critere
// maquettes et laisse les autres criteres de la vue.
export const MODES = ["remplacer", "ajouter", "retirer"];
export const nomMode = (facette) => "mode" + facette.charAt(0).toUpperCase() + facette.slice(1);
function parametreMode(facette) {
  return {
    nom: nomMode(facette), genre: "enum", options: () => MODES, defaut: "remplacer",
    description: "comment « " + facette + " » se combine avec la vue actuelle : remplacer (défaut, « uniquement », « seulement »), ajouter (« aussi », « ajoute »), retirer (« enlève », « sans »)"
  };
}

const lire = (parametres, nom) => (Array.isArray(parametres[nom]) ? parametres[nom] : []);

// Selecteur « une liste de valeurs, un test par valeur » : le plus courant.
function parValeurs({ nom, source, description, valeur, test, decrire }) {
  return {
    nom,
    description,
    parametres: [{ nom, genre: "valeurs", source, description }],
    fabriquer(parametres) {
      const valeurs = lire(parametres, nom).map(valeur);
      return valeurs.length ? (element) => valeurs.some((v) => test(element, v)) : null;
    },
    decrire(parametres) {
      const liste = lire(parametres, nom);
      return liste.length ? decrire(liste) : null;
    }
  };
}

export const SELECTEURS = creerRegistreSelecteurs();

SELECTEURS.enregistrer(parValeurs({
  nom: "typesIfc", source: "typesIfc", description: "types IFC à viser (plusieurs possibles, ils se cumulent)",
  valeur: normaliser, test: (e, v) => e.typeIfc === v,
  decrire: (liste) => liste.map(libelleTypeIfc).filter((l, i, tous) => tous.indexOf(l) === i).join(" et ")
}));
SELECTEURS.enregistrer(parValeurs({
  nom: "niveaux", source: "niveaux", description: "niveaux à viser",
  valeur: (v) => normaliser(canoniqueNiveau(v)), test: (e, v) => e.niveau === v,
  decrire: (liste) => liste.map(libelleNiveauCourt).join(" et ")
}));
SELECTEURS.enregistrer(parValeurs({
  nom: "maquettes", source: "maquettes", description: "maquettes à viser",
  valeur: normaliser, test: (e, v) => e.maquette === v || e.maquetteId === v,
  decrire: (liste) => "maquette " + liste.join(" et ")
}));
SELECTEURS.enregistrer(parValeurs({
  nom: "noms", source: "noms", description: "mots du nom des éléments à viser (le nom contient le mot)",
  valeur: (v) => normaliser(v).trim(), test: (e, v) => e.nom.includes(v),
  decrire: (liste) => "nom contenant " + liste.map((n) => "« " + n + " »").join(" ou ")
}));
// Un element PRECIS : nom complet identique (« Famille:Type:1165462 »), identifiant, ou numero Revit final du nom (« ...:1165462 »). Un nom « Famille:Type »
// sans numero (les noms proposes a l'IA n'ont pas leur suffixe) vise toutes les instances de ce type.
SELECTEURS.enregistrer(parValeurs({
  nom: "elements", source: "noms", description: "élément précis visé, par son nom complet (« Famille:Type:numéro ») ou son identifiant",
  valeur: (v) => normaliser(v).trim(),
  test: (e, v) => e.nomExact === v || normaliser(e.id) === v || (v.length > 0 && (e.nomExact.endsWith(":" + v) || e.nomExact.startsWith(v + ":"))),
  decrire: (liste) => "élément " + liste.map((n) => "« " + n + " »").join(" ou ")
}));
// Zone nommee : les elements dont le centre est dans la boite de la zone. Une vraie piece (IfcSpace) s'ajoutera plus tard comme un autre selecteur
// ou comme une autre source de boites dans contexte.zones, sans changer ce test.
SELECTEURS.enregistrer({
  nom: "zones",
  description: "zones nommées de la maquette (volumes définis par l'utilisateur)",
  parametres: [{ nom: "zones", genre: "valeurs", source: "zones", description: "zones nommées à viser" }],
  fabriquer(parametres, contexte) {
    const boites = lire(parametres, "zones").map((nom) => (contexte.zones ? contexte.zones.trouver(nom) : null)).filter(estAabb);
    if (!lire(parametres, "zones").length) return null;
    return (element) => !!element.aabb && estAabb(element.aabb) && boites.some((boite) => pointDansAabb(centreAabb(element.aabb), boite));
  },
  decrire: (parametres) => (lire(parametres, "zones").length ? "zone " + lire(parametres, "zones").map((z) => "« " + z + " »").join(" et ") : null)
});

// ---------- Filtre du CONTEXTE ----------
// Second registre, meme mecanique que les selecteurs mais pour le groupe « contexte proche » des presentations qui en ont un (niveau_repere, focus, zone).
// Il ne filtre JAMAIS la selection : « les gaines du niveau 2 avec comme maquette de contexte uniquement la structure » garde les gaines (maquette
// mecanique) et limite le contexte a la structure. Ce qui est du contexte mais hors du filtre est MASQUE. Aucun filtre actif = tout le contexte ; `sansContexte`
// vrai = aucun contexte du tout. Ajouter un critere de contexte plus tard = un enregistrement ici.
export const FILTRES_CONTEXTE = creerRegistreSelecteurs();
FILTRES_CONTEXTE.enregistrer(parValeurs({
  nom: "contexteMaquettes", source: "maquettes", description: "maquettes gardées dans le CONTEXTE autour de la sélection (jamais un filtre de la sélection elle-même)",
  valeur: normaliser, test: (e, v) => e.maquette === v || e.maquetteId === v,
  decrire: (liste) => "maquette " + liste.join(" et ") + " en contexte"
}));
FILTRES_CONTEXTE.enregistrer(parValeurs({
  nom: "contexteTypesIfc", source: "typesIfc", description: "types IFC gardés dans le CONTEXTE autour de la sélection (jamais un filtre de la sélection elle-même)",
  valeur: normaliser, test: (e, v) => e.typeIfc === v,
  decrire: (liste) => liste.map(libelleTypeIfc).filter((l, i, tous) => tous.indexOf(l) === i).join(" et ") + " en contexte"
}));

// Test (id) => booleen « cet element reste-t-il dans le contexte ? », ou null quand rien ne limite le contexte. parametres.contexteExclusions (interne a la vue
// cumulative) = { critere: [valeurs] } ecartees du contexte.
export function fabriquerFiltreContexte(parametres, contexte, registre = FILTRES_CONTEXTE) {
  const sans = parametres.sansContexte === true;
  const tests = registre.toutes().map((s) => s.fabriquer(parametres, contexte)).filter(Boolean);
  const exclusions = parametres.contexteExclusions || {};
  const testsExclusion = Object.entries(exclusions).filter(([, valeurs]) => valeurs && valeurs.length)
    .map(([critere, valeurs]) => { const s = registre.trouver(critere); return s ? s.fabriquer({ [critere]: valeurs }, contexte) : null; }).filter(Boolean);
  if (!sans && !tests.length && !testsExclusion.length) return null;
  const cache = new Map();
  return (id) => {
    if (sans) return false;
    if (!cache.has(id)) {
      const d = descripteurElement(contexte.metaScene, id, contexte.maquettes);
      const element = d ? elementNormalise(id, d, contexte.scene.objects[id] && contexte.scene.objects[id].aabb) : null;
      cache.set(id, !!element && tests.every((t) => t(element)) && !testsExclusion.some((t) => t(element)));
    }
    return cache.get(id);
  };
}

function elementNormalise(id, d, aabb) {
  return {
    id,
    typeIfc: normaliser(d.typeIfc),
    niveau: normaliser(canoniqueNiveau(d.niveau)),
    maquette: normaliser(d.maquette),
    maquetteId: normaliser(d.maquetteId),
    nom: normaliser(d.nom),
    nomExact: normaliser(d.nom).trim(),
    aabb
  };
}

// Ids des elements de la scene qui satisfont TOUS les selecteurs actifs de la commande. Aucun selecteur actif = aucun element (la validation
// de l'action l'interdit deja).
//   options.toutSiAucun : sans aucun critere actif, rend tous les elements (la vue cumulative sans filtre) au lieu de aucun
//   options.exclusions : { facette: [valeurs] } ; un element qui correspond a l'une d'elles est ecarte (« enleve le niveau 2 »)
//   options.parmi : Set d'ids ; seuls ces elements sont consideres (une couche n'agit que sur ce qui est visible)
export function trouverElements(parametres, contexte, registre = SELECTEURS, options = {}) {
  const { toutSiAucun = false, exclusions = null, parmi = null } = options;
  const tests = registre.toutes().map((s) => s.fabriquer(parametres, contexte)).filter(Boolean);
  if (!tests.length && !toutSiAucun) return [];
  const testsExclusion = exclusions
    ? Object.entries(exclusions).filter(([, valeurs]) => valeurs && valeurs.length).map(([facette, valeurs]) => {
        const selecteur = registre.trouver(facette);
        return selecteur ? selecteur.fabriquer({ [facette]: valeurs }, contexte) : null;
      }).filter(Boolean)
    : [];
  const { scene, metaScene, maquettes, exclus } = contexte;
  const ids = [];
  for (const id of Object.keys(scene.objects)) {
    if (exclus && exclus.has(id)) continue;
    if (parmi && !parmi.has(id)) continue;
    const descripteur = descripteurElement(metaScene, id, maquettes);
    if (!descripteur) continue;
    const element = elementNormalise(id, descripteur, scene.objects[id] && scene.objects[id].aabb);
    if (tests.every((test) => test(element)) && !testsExclusion.some((test) => test(element))) ids.push(id);
  }
  return ids;
}

// La selection en groupe nominal francais, pour les relectures (« les gaines du niveau 2 », « l'élément « X » de la zone « Y » »). Les six criteres connus sont
// tournes a la main ; un selecteur ajoute plus tard est repris avec sa propre `decrire`.
const CONNUS = ["typesIfc", "niveaux", "maquettes", "noms", "elements", "zones"];
const enumeration = (liste, lien = "et") => (liste.length < 2 ? liste.join("") : liste.slice(0, -1).join(", ") + " " + lien + " " + liste[liste.length - 1]);
const guillemets = (liste) => enumeration(liste.map((v) => "« " + v + " »"), "ou");

export function phraseSelection(parametres, registre = SELECTEURS) {
  const types = lire(parametres, "typesIfc");
  const elements = lire(parametres, "elements");
  const niveaux = lire(parametres, "niveaux").map(libelleNiveauCourt);
  const maquettes = lire(parametres, "maquettes");
  const noms = lire(parametres, "noms");
  const zones = lire(parametres, "zones");
  const actifs = CONNUS.filter((f) => lire(parametres, f).length);
  // Un seul critere, niveaux ou maquettes : « le niveau 3 », « la maquette Structure » (plus naturel que « les éléments du niveau 3 »).
  if (actifs.length === 1 && actifs[0] === "niveaux" && niveaux.every((n) => /^niveau /.test(n))) {
    return (niveaux.length > 1 ? "les niveaux " : "le niveau ") + enumeration(niveaux.map((n) => n.slice(7)));
  }
  if (actifs.length === 1 && actifs[0] === "maquettes") return (maquettes.length > 1 ? "les maquettes " : "la maquette ") + enumeration(maquettes);
  let texte;
  if (elements.length) texte = "l'élément " + guillemets(elements);
  else if (types.length) texte = "les " + enumeration(types.map(libelleTypeIfc).filter((l, i, tous) => tous.indexOf(l) === i));
  else texte = "les éléments";
  if (niveaux.length) {
    texte += niveaux.every((n) => /^niveau /.test(n))
      ? (niveaux.length > 1 ? " des niveaux " : " du niveau ") + enumeration(niveaux.map((n) => n.slice(7)))
      : " de " + enumeration(niveaux);
  }
  if (maquettes.length) texte += (maquettes.length > 1 ? " des maquettes " : " de la maquette ") + enumeration(maquettes);
  // « Famille:Type » : la famille (avant les deux-points) alourdit la phrase, le type suffit a reconnaitre la demande.
  if (noms.length) texte += " dont le nom contient " + guillemets(noms.map((n) => (n.includes(":") ? n.split(":").slice(1).join(":") : n)));
  if (zones.length) texte += (zones.length > 1 ? " des zones " : " de la zone ") + guillemets(zones);
  const autres = registre.toutes().filter((s) => !CONNUS.includes(s.nom)).map((s) => s.decrire(parametres)).filter(Boolean);
  return autres.length ? texte + " (" + autres.join(", ") + ")" : texte;
}

export function decrireSelection(parametres, registre = SELECTEURS) {
  return registre.toutes().map((s) => s.decrire(parametres)).filter(Boolean).join(", ");
}
