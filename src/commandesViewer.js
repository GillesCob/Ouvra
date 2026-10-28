// Viewer par commande en langage naturel (24/10) : le moteur, sans interface ni reseau.
//
// Une commande pilote la mise en page de la maquette : { action: "afficher", parametres: { ...criteres, presentation, rayonMetres, isoler, surbrillance, cadrer } }.
// Deux couches, chacune avec son registre extensible :
//   - SELECTEURS (src/commandesSelecteurs.js, « quoi ») : types IFC, niveaux, maquettes, noms, element precis, zone nommee. Ils se combinent en ET ; plusieurs
//     valeurs d'un meme critere se cumulent (OU) ; un critere vide ne filtre pas.
//   - PRESENTATIONS (src/commandesPresentations.js, « comment ») : isoler, niveau_repere, focus, transparence, masquer, zone. Choisie par l'IA dans une
//     enumeration fermee (parametre « presentation », « isoler » par defaut). Chacune rend son annulation exacte.
// Effets facultatifs : isoler (masquer le reste, vrai par defaut, propre a la presentation « isoler »), surbrillance (faux par defaut, trop appuyee,
// demandee seulement par « mets en evidence »), cadrer (camera, vrai par defaut).
//
// REGISTRE D'ACTIONS : une action = un objet { nom, description, parametres, valider?, preparer, appliquer, libelle }.
//   parametres : [{ nom, genre: "valeurs", source } | { nom, genre: "booleen", defaut } | { nom, genre: "enum", options(), defaut } | { nom, genre: "nombre", defaut, max }]
//     (le relais IA construit son schema de sortie a partir de cette description, voir relais/schemaCommande.js : ajouter une action ici suffit)
//   valider(parametres) : message d'erreur ou null (regle propre a l'action)
//   preparer(parametres, contexte) : { ids } sans AUCUN effet de bord
//   appliquer(plan, contexte, parametres) : agit sur la scene et rend une fonction d'annulation, ou null s'il n'y a rien a annuler
//   relire(parametres) : facultatif, relecture a l'infinitif de la commande validee (affichee dans la question « Est-ce bien votre demande ? »)
//   libelle(parametres, plan) : compte rendu en francais
// Ajouter une action plus tard = un appel a REGISTRE.enregistrer(...), sans toucher au reste.
//
// Module sans dependance a main.js ni au DOM : la scene (xeokit), ses metadonnees et la camera sont passees a creerControleur.
// Le controleur calcule ce qui serait trouve (preparer, sans effet de bord), l'applique (appliquer) et sait tout annuler (reinitialiser).

import { normaliser } from "./reglesCollision.js";
import { canoniqueNiveau, libelleTypeIfc, pluriel } from "./commandesLibelles.js";
import { SELECTEURS, FILTRES_CONTEXTE, trouverElements, decrireSelection, phraseSelection } from "./commandesSelecteurs.js";
import { PRESENTATIONS, presentationEffective, relireRestreint, volerVers } from "./commandesPresentations.js";
import { creerJournal } from "./commandesEtats.js";

export { canoniqueNiveau, libelleTypeIfc };

// ---------- Registre ----------
export function creerRegistre() {
  const actions = new Map();
  return {
    enregistrer(definition) {
      if (!definition || typeof definition.nom !== "string" || !definition.nom) throw new Error("Action sans nom.");
      if (actions.has(definition.nom)) throw new Error("Action « " + definition.nom + " » déjà enregistrée.");
      if (!Array.isArray(definition.parametres)) throw new Error("Action « " + definition.nom + " » : parametres absents.");
      for (const fonction of ["preparer", "appliquer", "libelle"]) {
        if (typeof definition[fonction] !== "function") throw new Error("Action « " + definition.nom + " » : fonction " + fonction + " absente (libelle, preparer, appliquer attendus).");
      }
      actions.set(definition.nom, definition);
    },
    trouver: (nom) => actions.get(nom) || null,
    noms: () => Array.from(actions.keys()),
    toutes: () => Array.from(actions.values())
  };
}

// ---------- Validation ----------
const erreur = (message) => ({ ok: false, erreur: message });

// Valeur canonique de la liste egale (sans tenir compte de la casse ni des accents) a celle donnee, ou null.
function canonique(liste, valeur) {
  const cherchee = normaliser(valeur).trim();
  return liste.find((v) => normaliser(v).trim() === cherchee) || null;
}

function validerParametre(def, valeur, valeurs) {
  if (def.genre === "enum") {
    if (valeur === undefined || valeur === null) return { ok: true, valeur: def.defaut };
    const options = def.options();
    return options.includes(valeur) ? { ok: true, valeur } : erreur("« " + def.nom + " » : valeur « " + valeur + " » inconnue (attendu : " + options.join(", ") + ").");
  }
  if (def.genre === "nombre") {
    if (valeur === undefined || valeur === null) return { ok: true, valeur: def.defaut };
    const max = def.max === undefined ? Infinity : def.max;
    return typeof valeur === "number" && Number.isFinite(valeur) && valeur >= 0 && valeur <= max
      ? { ok: true, valeur }
      : erreur("« " + def.nom + " » doit être un nombre entre 0 et " + max + ".");
  }
  if (def.genre === "booleen") {
    if (valeur === undefined) return { ok: true, valeur: def.defaut };
    return typeof valeur === "boolean" ? { ok: true, valeur } : erreur("« " + def.nom + " » doit être vrai ou faux.");
  }
  if (valeur === undefined || valeur === null) return { ok: true, valeur: [] };
  if (!Array.isArray(valeur)) return erreur("« " + def.nom + " » doit être une liste.");
  const retenues = [];
  for (const element of valeur) {
    if (typeof element !== "string" || !element.trim()) return erreur("« " + def.nom + " » contient autre chose que du texte.");
    if (valeurs) {
      const connue = canonique(valeurs[def.source] || [], element);
      if (!connue) return erreur("Valeur « " + element + " » absente de la maquette pour « " + def.nom + " ».");
      if (!retenues.includes(connue)) retenues.push(connue);
    } else if (!retenues.includes(element)) {
      retenues.push(element);
    }
  }
  return { ok: true, valeur: retenues };
}

// Verifie une commande { action, parametres } contre le registre et, si `valeurs` est donne, contre les valeurs reellement presentes dans la maquette
// ({ typesIfc, niveaux, maquettes, noms }). Rend { ok: true, commande } avec les parametres complets (booleens par defaut, listes), ou { ok: false, erreur }.
export function validerCommande(commande, valeurs, registre = REGISTRE) {
  if (!commande || typeof commande !== "object" || Array.isArray(commande)) return erreur("La commande est absente ou mal formée.");
  const def = registre.trouver(commande.action);
  if (!def) return erreur("Action inconnue « " + commande.action + " » (attendu : " + registre.noms().join(", ") + ").");
  const bruts = commande.parametres === undefined || commande.parametres === null ? {} : commande.parametres;
  if (typeof bruts !== "object" || Array.isArray(bruts)) return erreur("Les paramètres de la commande sont mal formés.");
  const connus = def.parametres.map((p) => p.nom);
  const inconnu = Object.keys(bruts).find((nom) => !connus.includes(nom));
  if (inconnu) return erreur("Paramètre inconnu « " + inconnu + " » pour l'action « " + def.nom + " ».");
  const parametres = {};
  for (const p of def.parametres) {
    const verdict = validerParametre(p, bruts[p.nom], valeurs);
    if (!verdict.ok) return verdict;
    parametres[p.nom] = verdict.valeur;
  }
  const refus = def.valider ? def.valider(parametres) : null;
  if (refus) return erreur(refus);
  const retour = { action: def.nom, parametres };
  if (typeof commande.demande === "string") retour.demande = commande.demande;
  // La relecture redit la commande VALIDEE (celle qui sera appliquee), construite ici ; le texte libre du modele n'est conserve que pour une action sans `relire`.
  if (typeof def.relire === "function") retour.relecture = def.relire(parametres);
  else if (typeof commande.relecture === "string") retour.relecture = commande.relecture;
  return { ok: true, commande: retour };
}

const pluralSel = (n) => pluriel(n, "élément trouvé", "éléments trouvés");

// ---------- Actions de la v1 ----------
const ACTION_AFFICHER = {
  nom: "afficher",
  description: "Pilote l'affichage d'éléments de la maquette : les sélecteurs (types IFC, niveaux, maquettes, noms, élément précis, zone nommée) disent QUOI, la présentation dit COMMENT (isoler, niveau_repere, focus, transparence, masquer, zone). Peut cadrer la caméra dessus.",
  // Recalcule a chaque lecture : un selecteur ou une presentation enregistres plus tard entrent tout seuls dans la description de l'action.
  get parametres() {
    return [
      ...SELECTEURS.parametres(),
      ...FILTRES_CONTEXTE.parametres(),
      { nom: "sansContexte", genre: "booleen", defaut: false, description: "vrai : plus aucun contexte autour de la sélection (« sans contexte »), seule la sélection reste visible" },
      { nom: "presentation", genre: "enum", options: () => PRESENTATIONS.noms(), defaut: "isoler", description: "comment montrer la sélection : " + PRESENTATIONS.noms().join(", ") },
      { nom: "rayonMetres", genre: "nombre", defaut: 0, max: 500, description: "rayon en mètres autour de l'élément précis (présentation focus) ; 0 si la phrase n'en donne pas" },
      { nom: "isoler", genre: "booleen", defaut: true, description: "vrai : masquer tout ce qui n'est pas trouvé, présentation isoler seulement (par défaut vrai pour « affiche », faux pour « mets en évidence »)" },
      { nom: "surbrillance", genre: "booleen", defaut: false, description: "vrai : mettre en surbrillance les éléments trouvés (par défaut faux : les présentations gardent déjà le contraste, vrai seulement pour « mets en évidence »)" },
      { nom: "cadrer", genre: "booleen", defaut: true, description: "vrai : cadrer la caméra sur les éléments trouvés" },
      { nom: "repartir", genre: "booleen", defaut: false, description: "vrai : repartir de zéro (« repars de zéro », « recommence », « efface tout ») : les critères et couches précédents sont effacés avant cette commande ; faux sinon, la vue actuelle est conservée" }
    ];
  },
  valider(parametres) {
    // Un critere de selection OU un reglage du contexte (« sans contexte », « avec la structure en contexte ») suffit.
    const vide = SELECTEURS.toutes().every((s) => !s.fabriquer(parametres, {}))
      && FILTRES_CONTEXTE.toutes().every((s) => !s.fabriquer(parametres, {})) && !parametres.sansContexte;
    if (vide) return "Préciser au moins un critère : un type d'élément, un niveau, une maquette, un nom, un élément précis ou une zone.";
    return PRESENTATIONS.trouver(parametres.presentation).valider?.(parametres) || null;
  },
  preparer: (parametres, contexte, options) => ({ ids: trouverElements(parametres, contexte, SELECTEURS, options) }),
  // Relecture : un verbe et la selection, jamais d'effet. Mode ajouter / retirer, ou repartir de zero, y sont dits.
  relire(parametres) {
    const presentation = PRESENTATIONS.trouver(presentationEffective(parametres));
    const texte = presentation.composition === "restreint" && presentation.nom !== "zone"
      ? relireRestreint(parametres)
      : presentation.relire(parametres, phraseSelection(parametres));
    return parametres.repartir ? "Repartir de zéro puis " + texte.charAt(0).toLowerCase() + texte.slice(1) : texte;
  },
  appliquer(plan, contexte, parametres) {
    const presentation = PRESENTATIONS.trouver(parametres.presentation);
    const annulerPresentation = presentation.appliquer(plan, contexte, parametres);
    if (presentation.effetsPropres) return annulerPresentation;
    const { scene, cameraFlight } = contexte;
    const journal = creerJournal(scene);
    if (parametres.surbrillance) journal.surbrillance(plan.ids, true);
    if (parametres.cadrer && presentation.cadrage !== false && cameraFlight) {
      const cible = presentation.cible ? presentation.cible(plan, contexte, parametres) : null;
      volerVers(contexte, cible || scene.getAABB(plan.ids));
    }
    return () => {
      journal.annuler();
      if (annulerPresentation) annulerPresentation();
    };
  },
  libelle(parametres, plan) {
    const criteres = decrireSelection(parametres);
    if (plan.ids.length === 0) return "Aucun élément ne correspond (" + criteres + "). Rien n'a été modifié.";
    const presentation = PRESENTATIONS.trouver(parametres.presentation);
    const effets = presentation.libelle(parametres, plan).slice();
    if (!presentation.effetsPropres) {
      if (parametres.surbrillance) effets.push("les éléments sont en surbrillance");
      if (parametres.cadrer && presentation.cadrage !== false) effets.push("la caméra est cadrée dessus");
    }
    return pluralSel(plan.ids.length) + " (" + criteres + ")" + (effets.length ? " : " + effets.join(", ") + "." : ".");
  }
};

const ACTION_TOUT_AFFICHER = {
  nom: "tout_afficher",
  description: "Remet toute la maquette visible et retire la surbrillance et la transparence.",
  parametres: [],
  relire: () => "Tout réafficher",
  preparer: (_parametres, { scene, exclus }) => ({ ids: Object.keys(scene.objects).filter((id) => !(exclus && exclus.has(id))) }),
  // Le moteur defait d'abord, a l'identique, la derniere commande appliquee (controleur.appliquer) ; ce qui reste ici est le filet de securite
  // « tout redevient normal », borne aux elements du plan (donc hors `exclus`) : l'x-ray et la surbrillance posees ailleurs sur des elements exclus ne sont pas touchees.
  appliquer(plan, { scene }) {
    const ids = new Set(plan.ids);
    scene.setObjectsVisible(plan.ids, true);
    scene.setObjectsXRayed(scene.xrayedObjectIds.filter((id) => ids.has(id)), false);
    scene.setObjectsHighlighted(scene.highlightedObjectIds.filter((id) => ids.has(id)), false);
    return null;
  },
  libelle: () => "Toute la maquette est de nouveau affichée."
};

export const REGISTRE = creerRegistre();
REGISTRE.enregistrer(ACTION_AFFICHER);
REGISTRE.enregistrer(ACTION_TOUT_AFFICHER);

// ---------- Controleur ----------
// scene : scene xeokit (objects, visibleObjectIds, highlightedObjectIds, xrayedObjectIds, setObjects*, getAABB) ; metaScene : metadonnees IFC ;
// maquettes : [{ id, label }] ; zones : { trouver(nom) -> boite } (src/commandesZones.js) ou null ; cameraFlight : viewer.cameraFlight ; exclus : ids a ne jamais toucher (garde-corps mal places de l'hopital) ;
// poseCentree(aabb) : pose de camera centrant la boite (optionnel) ; apres(nomAction) : rappel appele apres chaque application (le Viewer y resynchronise son drawer).
export function creerControleur({ scene, metaScene, maquettes = [], cameraFlight = null, exclus = null, zones = null, poseCentree = null, apres = null, registre = REGISTRE } = {}) {
  if (!scene || !scene.objects) throw new Error("Scène absente : le moteur de commandes ne peut pas démarrer.");
  if (!metaScene || !metaScene.metaObjects) throw new Error("Métadonnées de la scène absentes : le moteur de commandes ne peut pas démarrer.");
  const contexte = { scene, metaScene, maquettes, cameraFlight, exclus, zones, poseCentree };
  let annulations = []; // annulations des applications en cours, la plus recente en dernier (defaites en ordre inverse)

  function resultatDePlan(def, commande, plan) {
    const ids = plan.ids || [];
    const complet = { ...plan, ids };
    return {
      ok: true,
      action: def.nom,
      commande,
      ids,
      compte: ids.length,
      vide: def.nom !== "tout_afficher" && ids.length === 0,
      resume: def.libelle(commande.parametres, complet),
      plan: complet
    };
  }

  // options (vue cumulative) : parmi (Set d'ids, ne considerer que ceux-la), exclusions ({ critere: [valeurs] } ecartees). Sans effet de bord.
  function preparer(commande, valeurs = null, options = undefined) {
    const verdict = validerCommande(commande, valeurs, registre);
    if (!verdict.ok) return { ok: false, erreur: verdict.erreur };
    const def = registre.trouver(verdict.commande.action);
    return resultatDePlan(def, verdict.commande, def.preparer(verdict.commande.parametres, contexte, options));
  }

  // Prepare la VUE de fond de la vue cumulative : inclusions { critere: [valeurs] } et exclusions, avec la presentation `style` (isoler, niveau_repere, zone).
  // Aucun critere = tous les elements (la vue sans filtre). Contrairement a preparer, ne demande pas de critere. Sans effet de bord.
  function preparerVue({ inclusions = {}, exclusions = null, style = "isoler", cadrer = true, sansContexte = false }) {
    const def = registre.trouver("afficher");
    const parametres = {};
    for (const p of def.parametres) parametres[p.nom] = p.genre === "valeurs" ? [] : p.defaut;
    // Les criteres du contexte (FILTRES_CONTEXTE) ne filtrent jamais la selection : ils restent dans les parametres pour la presentation seulement.
    const exclusionsSelection = {};
    const exclusionsContexte = {};
    for (const [nom, valeurs] of Object.entries(exclusions || {})) (FILTRES_CONTEXTE.trouver(nom) ? exclusionsContexte : exclusionsSelection)[nom] = valeurs;
    Object.assign(parametres, inclusions, { presentation: style, cadrer, surbrillance: false, isoler: true, sansContexte, contexteExclusions: exclusionsContexte });
    const ids = trouverElements(parametres, contexte, SELECTEURS, { toutSiAucun: true, exclusions: exclusionsSelection });
    return resultatDePlan(def, { action: def.nom, parametres }, { ids });
  }

  function reinitialiser() {
    if (!annulations.length) return false;
    while (annulations.length) annulations.pop()();
    return true;
  }

  // Applique SANS defaire ce qui est deja applique (les couches de la vue cumulative s'empilent) ; `signaler` previent ensuite le Viewer, une seule fois.
  function empiler(prepare) {
    if (!prepare || !prepare.ok) return { ok: false, message: (prepare && prepare.erreur) || "Commande non valide." };
    if (prepare.vide) return { ok: false, message: prepare.resume };
    const def = registre.trouver(prepare.action);
    const annuler = def.appliquer(prepare.plan, contexte, prepare.commande.parametres);
    if (annuler) annulations.push(annuler);
    return { ok: true, message: prepare.resume };
  }

  const signaler = (nomAction) => { if (apres) apres(nomAction); };

  function appliquer(prepare) {
    if (!prepare || !prepare.ok) return { ok: false, message: (prepare && prepare.erreur) || "Commande non valide." };
    if (prepare.vide) return { ok: false, message: prepare.resume };
    reinitialiser(); // la commande suivante part de l'etat d'origine, jamais de celui de la precedente
    const resultat = empiler(prepare);
    signaler(prepare.action);
    return resultat;
  }

  return { preparer, preparerVue, appliquer, empiler, signaler, reinitialiser, visibles: () => new Set(scene.visibleObjectIds), active: () => annulations.length > 0 };
}
