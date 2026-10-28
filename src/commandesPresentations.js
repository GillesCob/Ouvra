// Viewer par commande (24/10) : la couche PRESENTATION (« comment »), separee de la couche selecteur (« quoi », src/commandesSelecteurs.js).
//
// Une presentation decide de l'etat de trois groupes d'elements : la SELECTION (ce que les selecteurs ont trouve), le CONTEXTE PROCHE (autour de la
// selection ou du meme niveau) et le RESTE. Etats possibles : visible, transparent (opacite reduite, couleurs d'origine), fantome (x-ray, filaire
// leger) ou masque. La surbrillance (faible usage, xeokit la rend trop forte) et le cadrage de la camera sont des effets facultatifs de la commande.
// Une presentation = { nom, description, valider?, appliquer, libelle, cadrage?, cible?, effetsPropres? } dans un registre :
//   valider(parametres) : message d'erreur ou null (ce que la presentation exige en plus d'un critere)
//   appliquer(plan, contexte, parametres) : agit sur la scene, rend la fonction d'ANNULATION exacte (le journal de src/commandesEtats.js l'assure)
//   relire(parametres, criteres) : relecture de la commande, a l'infinitif, construite ICI depuis la commande validee (jamais depuis le texte du modele) :
//     un verbe et la selection, JAMAIS les effets (masquer le reste, cadrage, transparence...), l'utilisateur n'a pas a les lire
//   libelle(parametres, plan) : liste de phrases courtes decrivant l'effet, pour le compte rendu
//   composition : comment elle se combine avec la VUE COURANTE cumulative (src/commandesVue.js) :
//     « restreint » (isoler, niveau_repere, zone) met a jour les criteres de la vue ; « couche » (evidence, transparence, masquer) agit sur ce qui est visible
//     sans changer les criteres, et les couches s'empilent ; « focus » est une vue rapprochee TEMPORAIRE sur un element : elle tombe des qu'une autre commande est
//     acceptee, et reste annulable par « Non »
//   cadrage : faux = la presentation agit en place, la camera ne bouge jamais ; cible(plan, contexte, parametres) : boite a cadrer, sinon celle de la selection
//   effetsPropres : vrai = la presentation applique elle-meme surbrillance et cadrage (c'est le cas de « isoler », comportement d'origine)
// Les presentations nommees sont choisies par l'IA dans une enumeration fermee (PRESENTATIONS.noms()). Ajouter une presentation plus tard = un appel a
// PRESENTATIONS.enregistrer(...), sans toucher au reste. Module sans dependance a main.js ni au DOM.

import { creerJournal } from "./commandesEtats.js";
import { SELECTEURS, FILTRES_CONTEXTE, MODES, nomMode, phraseSelection, fabriquerFiltreContexte } from "./commandesSelecteurs.js";
import { descripteurElement, normaliser } from "./reglesCollision.js";
import { canoniqueNiveau } from "./commandesLibelles.js";
import { aabbSeCoupent, distanceEntreAabb, elargirAabb, estAabb, unionAabb } from "./commandesGeometrie.js";

export const DUREE_VOL_S = 1.1;
export const OPACITE_TRANSPARENT = 0.2; // « rends les murs transparents » : on voit au travers, la couleur d'origine reste lisible
export const OPACITE_CONTEXTE = 0.3; // contexte proche et reste d'un niveau : meme valeur que le contexte de la page Collision (COLLISION_CONTEXTE_NIVEAU_OPACITE)
export const RAYON_FOCUS_DEFAUT_M = 3; // rayon du contexte proche d'un focus quand la phrase n'en donne pas
export const MARGE_ENVELOPPE_M = 0.5; // une zone nommee : murs et dalles a moins de 0,5 m de son volume
export const TYPES_ENVELOPPE = ["IfcWall", "IfcWallStandardCase", "IfcCurtainWall", "IfcSlab", "IfcCovering", "IfcRoof"];
// Fantome des elements hors focus : memes valeurs que l'isolation de la page Collision (COLLISION_ISOLATION_*), pour le meme rendu.
export const MATERIAU_FANTOME = { fillAlpha: 0.06, edgeAlpha: 0.18, fillColor: [0.8, 0.8, 0.8], edgeColor: [0.8, 0.8, 0.8] };

// Relecture d'une presentation « restreint » : un verbe par mode (« Afficher le niveau 3 », « Ajouter les vannes », « Retirer le niveau 2 »), un groupe par mode
// present dans la commande, rien d'autre (jamais d'effet ni de compte).
const VERBES_MODE = { remplacer: "Afficher", ajouter: "Ajouter", retirer: "Retirer" };

// Les criteres du contexte se disent comme les autres (« la maquette Structure ») : on les ramene aux noms des selecteurs pour reutiliser phraseSelection.
const VERS_SELECTEUR = { contexteMaquettes: "maquettes", contexteTypesIfc: "typesIfc" };

export function relireRestreint(parametres) {
  const phrases = [];
  for (const mode of MODES) {
    const groupe = {};
    for (const facette of SELECTEURS.noms()) {
      if (Array.isArray(parametres[facette]) && parametres[facette].length && (parametres[nomMode(facette)] || "remplacer") === mode) groupe[facette] = parametres[facette];
    }
    if (Object.keys(groupe).length) phrases.push({ mode, texte: VERBES_MODE[mode] + " " + phraseSelection(groupe) });
  }
  // Contexte : « avec la maquette Structure en contexte » (rattache a la phrase principale), « ajouter … au contexte », « retirer … du contexte », « sans contexte ».
  const contexte = { remplacer: {}, ajouter: {}, retirer: {} };
  for (const critere of FILTRES_CONTEXTE.noms()) {
    if (Array.isArray(parametres[critere]) && parametres[critere].length) contexte[parametres[nomMode(critere)] || "remplacer"][VERS_SELECTEUR[critere] || critere] = parametres[critere];
  }
  const principale = phrases.length > 0;
  const complements = [];
  if (parametres.sansContexte) complements.push(principale ? "sans contexte" : "Retirer le contexte");
  if (Object.keys(contexte.remplacer).length) complements.push(principale ? "avec " + phraseSelection(contexte.remplacer) + " en contexte" : "Garder " + phraseSelection(contexte.remplacer) + " en contexte");
  if (Object.keys(contexte.ajouter).length) complements.push("ajouter " + phraseSelection(contexte.ajouter) + " au contexte");
  if (Object.keys(contexte.retirer).length) complements.push("retirer " + phraseSelection(contexte.retirer) + " du contexte");
  const texte = phrases.map((p, i) => (i === 0 ? p.texte : p.texte.charAt(0).toLowerCase() + p.texte.slice(1))).join(", ");
  const liaison = (c) => (c.startsWith("avec ") || c.startsWith("sans ") ? " " : ", ");
  let resultat = texte;
  complements.forEach((c, i) => {
    if (!resultat) resultat = c.charAt(0).toUpperCase() + c.slice(1);
    else resultat += (i === 0 ? liaison(c) : ", ") + c;
  });
  return resultat;
}

export function creerRegistrePresentations() {
  const presentations = new Map();
  return {
    enregistrer(definition) {
      if (!definition || typeof definition.nom !== "string" || !definition.nom) throw new Error("Présentation sans nom.");
      if (presentations.has(definition.nom)) throw new Error("Présentation « " + definition.nom + " » déjà enregistrée.");
      for (const fonction of ["appliquer", "libelle"]) {
        if (typeof definition[fonction] !== "function") throw new Error("Présentation « " + definition.nom + " » : fonction " + fonction + " absente.");
      }
      if (typeof definition.description !== "string" || !definition.description) throw new Error("Présentation « " + definition.nom + " » : description absente.");
      presentations.set(definition.nom, definition);
    },
    trouver: (nom) => presentations.get(nom) || null,
    noms: () => Array.from(presentations.keys()),
    toutes: () => Array.from(presentations.values())
  };
}

export const PRESENTATIONS = creerRegistrePresentations();

// ---------- Outils communs ----------
export function tousLesIds({ scene, exclus }) {
  return Object.keys(scene.objects).filter((id) => !(exclus && exclus.has(id)));
}

const aabbDe = (scene, id) => {
  const objet = scene.objects[id];
  return objet && estAabb(objet.aabb) ? objet.aabb : null;
};

function niveauNormalise(contexte, id) {
  const d = descripteurElement(contexte.metaScene, id, contexte.maquettes);
  return d ? normaliser(canoniqueNiveau(d.niveau)) : "";
}

function typeIfcDe(contexte, id) {
  const meta = contexte.metaScene.metaObjects[id];
  return meta ? meta.type : "";
}

// Vol de camera vers une boite. poseCentree(aabb) (fournie par le Viewer, src/cadrageCentre.js) donne la pose qui centre la boite dans la zone 3D avec une marge
// serree ; sans elle (ou si elle ne sait pas cadrer), cadrage par defaut de xeokit, plus large.
export function volerVers({ cameraFlight, poseCentree }, aabb) {
  if (!cameraFlight || !aabb) return;
  cameraFlight.cancel();
  const pose = poseCentree ? poseCentree(aabb) : null;
  cameraFlight.flyTo(pose ? { ...pose, duration: DUREE_VOL_S } : { aabb, duration: DUREE_VOL_S });
}

// ---------- isoler (comportement d'origine) ----------
// Presentation reellement appliquee : « isoler » avec isoler a faux et sans rien masquer est « mettre en evidence » (ancien reglage), une COUCHE, pas une restriction.
export function presentationEffective(parametres) {
  return parametres.presentation === "isoler" && parametres.isoler === false ? "evidence" : parametres.presentation;
}

PRESENTATIONS.enregistrer({
  nom: "isoler",
  description: "Affiche seulement la sélection et masque tout le reste (« affiche », « montre », « seul », « uniquement »).",
  composition: "restreint",
  effetsPropres: true,
  relire: (parametres, criteres) => (!parametres.isoler && parametres.surbrillance ? "Mettre en évidence " : "Afficher ") + criteres,
  appliquer(plan, contexte, parametres) {
    const { scene, cameraFlight } = contexte;
    const trouves = plan.ids;
    const dejaVisibles = new Set(scene.visibleObjectIds);
    const gardes = new Set(trouves);
    const masques = parametres.isoler ? Array.from(dejaVisibles).filter((id) => !gardes.has(id)) : [];
    const reveles = trouves.filter((id) => !dejaVisibles.has(id));
    if (masques.length) scene.setObjectsVisible(masques, false);
    scene.setObjectsVisible(trouves, true);
    const journal = creerJournal(scene);
    if (parametres.surbrillance) journal.surbrillance(trouves, true); // l'etat d'origine de chaque element est retenu pour l'annulation
    if (parametres.cadrer && cameraFlight) volerVers(contexte, scene.getAABB(trouves));
    return () => {
      if (masques.length) scene.setObjectsVisible(masques, true);
      if (reveles.length) scene.setObjectsVisible(reveles, false);
      journal.annuler();
    };
  },
  libelle(parametres) {
    const effets = [];
    if (parametres.isoler) effets.push("le reste est masqué");
    if (parametres.surbrillance) effets.push("les éléments sont en surbrillance");
    if (parametres.cadrer) effets.push("la caméra est cadrée dessus");
    return effets;
  }
});

// ---------- niveau_repere ----------
// « Affiche les gaines du niveau 2 » : le niveau reste visible, les autres niveaux sont masques, la selection garde couleurs et opacite pleine, le reste du
// niveau passe en transparence legere (le contraste vient de la transparence, pas de la surbrillance).
PRESENTATIONS.enregistrer({
  nom: "niveau_repere",
  composition: "restreint",
  description: "Garde le niveau visible : la sélection reste pleine, le reste du niveau devient légèrement transparent, les autres niveaux sont masqués. Pour « affiche les gaines du niveau 2 » (un type ET un niveau).",
  relire: (parametres, criteres) => "Afficher " + criteres,
  appliquer(plan, contexte, parametres) {
    const { scene } = contexte;
    const journal = creerJournal(scene);
    const tous = tousLesIds(contexte);
    const selection = new Set(plan.ids);
    const niveauxRepere = new Set(plan.ids.map((id) => niveauNormalise(contexte, id)).filter(Boolean));
    // Le filtre de contexte ne touche que le reste du niveau : la selection est toujours affichee, le contexte hors filtre est MASQUE (pas transparent).
    const dansContexte = fabriquerFiltreContexte(parametres, contexte);
    const duNiveau = [];
    const autres = [];
    for (const id of tous) {
      if (selection.has(id)) continue;
      const dansLeNiveau = niveauxRepere.has(niveauNormalise(contexte, id));
      (dansLeNiveau && (!dansContexte || dansContexte(id)) ? duNiveau : autres).push(id);
    }
    journal.visible(plan.ids, true);
    journal.opacite(plan.ids, 1);
    journal.visible(duNiveau, true);
    journal.opacite(duNiveau, OPACITE_CONTEXTE);
    journal.visible(autres, false);
    return journal.annuler;
  },
  libelle: () => ["le niveau reste visible, le reste du niveau est en transparence légère, les autres niveaux sont masqués"]
});

// ---------- focus ----------
// « Montre-moi la vanne X » (vue façon collision) : le modele passe en fantome (x-ray filaire leger, memes valeurs que l'isolation des collisions),
// les elements dans le rayon sont en transparence, l'element reste plein, la camera se pose dessus.
PRESENTATIONS.enregistrer({
  nom: "focus",
  composition: "focus",
  description: "Vue façon collision sur un élément précis : le modèle devient fantôme, les éléments dans un rayon (en mètres) sont transparents, l'élément reste plein. Pour « montre-moi la vanne X » ou « montre ce qu'il y a autour de X dans un rayon de 5 m ».",
  valider: (parametres) => (parametres.elements && parametres.elements.length ? null : "Préciser l'élément à montrer, par son nom complet."),
  relire: (parametres, criteres) => "Montrer " + criteres,
  cible(plan, { scene }) {
    const boite = unionAabb(plan.ids.map((id) => aabbDe(scene, id)));
    return boite ? elargirAabb(boite, 1) : scene.getAABB(plan.ids);
  },
  appliquer(plan, contexte, parametres) {
    const { scene } = contexte;
    const journal = creerJournal(scene);
    const rayon = parametres.rayonMetres > 0 ? parametres.rayonMetres : RAYON_FOCUS_DEFAUT_M;
    const selection = new Set(plan.ids);
    const boite = unionAabb(plan.ids.map((id) => aabbDe(scene, id)));
    const dansContexte = fabriquerFiltreContexte(parametres, contexte);
    const proches = [];
    const lointains = [];
    const ecartes = []; // proches mais hors du filtre de contexte : masques
    for (const id of tousLesIds(contexte)) {
      if (selection.has(id)) continue;
      const b = aabbDe(scene, id);
      const prochePhysiquement = boite && b && distanceEntreAabb(b, boite) <= rayon;
      if (!prochePhysiquement) lointains.push(id);
      else (!dansContexte || dansContexte(id) ? proches : ecartes).push(id);
    }
    journal.materielXray(MATERIAU_FANTOME);
    journal.visible(plan.ids, true);
    journal.fantome(plan.ids, false);
    journal.opacite(plan.ids, 1);
    journal.fantome(proches, false);
    journal.opacite(proches, OPACITE_CONTEXTE);
    journal.fantome(lointains, true);
    journal.visible(ecartes, false);
    return journal.annuler;
  },
  libelle: (parametres) => ["le modèle passe en fantôme, les éléments dans un rayon de " + (parametres.rayonMetres > 0 ? parametres.rayonMetres : RAYON_FOCUS_DEFAUT_M).toLocaleString("fr-FR") + " m sont transparents"]
});

// ---------- evidence ----------
// « Mets les cloisons en evidence » : une COUCHE de surbrillance sur la selection, sans rien masquer ni restreindre la vue.
PRESENTATIONS.enregistrer({
  nom: "evidence",
  composition: "couche",
  description: "Met la sélection en surbrillance sans rien masquer ni changer la vue. Pour « mets les cloisons en évidence », « surligne les vannes ».",
  relire: (parametres, criteres) => "Mettre en évidence " + criteres,
  appliquer(plan, { scene }) {
    const journal = creerJournal(scene);
    journal.surbrillance(plan.ids, true);
    return journal.annuler;
  },
  libelle: () => ["ils sont en surbrillance, le reste ne change pas"]
});

// ---------- transparence ----------
PRESENTATIONS.enregistrer({
  nom: "transparence",
  composition: "couche",
  description: "Rend la sélection transparente et ne touche à rien d'autre. Pour « rends les murs transparents », « mets les faux plafonds en transparence ».",
  cadrage: false,
  relire: (parametres, criteres) => "Rendre " + criteres + " transparents",
  appliquer(plan, { scene }) {
    const journal = creerJournal(scene);
    journal.opacite(plan.ids, OPACITE_TRANSPARENT);
    return journal.annuler;
  },
  libelle: () => ["ils deviennent transparents, le reste ne change pas"]
});

// ---------- masquer ----------
PRESENTATIONS.enregistrer({
  nom: "masquer",
  composition: "couche",
  description: "Masque la sélection et ne touche à rien d'autre. Pour « masque la structure », « masque les faux plafonds et le mobilier », « affiche tout sauf l'électricité » (masquer la maquette Électricité).",
  cadrage: false,
  relire: (parametres, criteres) => "Masquer " + criteres,
  appliquer(plan, { scene }) {
    const journal = creerJournal(scene);
    journal.visible(plan.ids, false);
    return journal.annuler;
  },
  libelle: () => ["ils sont masqués, le reste ne change pas"]
});

// ---------- zone ----------
// « Affiche la zone Bloc operatoire » : ce qui est dans la zone reste plein, les murs, dalles et plafonds qui l'entourent passent en transparence,
// tout le reste est masque.
PRESENTATIONS.enregistrer({
  nom: "zone",
  composition: "restreint",
  description: "Isole une zone nommée : son contenu reste plein, les murs, dalles et plafonds qui l'entourent sont transparents, tout le reste est masqué. Pour « affiche la zone Bloc opératoire ».",
  valider: (parametres) => (parametres.zones && parametres.zones.length ? null : "Préciser la zone à afficher."),
  relire: (parametres) => "Afficher la zone " + (parametres.zones || []).map((z) => "« " + z + " »").join(" et "),
  cible(plan, contexte, parametres) {
    return unionAabb((parametres.zones || []).map((nom) => (contexte.zones ? contexte.zones.trouver(nom) : null)));
  },
  appliquer(plan, contexte, parametres) {
    const { scene } = contexte;
    const journal = creerJournal(scene);
    const zone = unionAabb((parametres.zones || []).map((nom) => (contexte.zones ? contexte.zones.trouver(nom) : null)));
    const cadre = zone ? elargirAabb(zone, MARGE_ENVELOPPE_M) : null;
    const enveloppe = [];
    const dedans = [];
    const masques = [];
    const selection = new Set(plan.ids);
    const dansContexte = fabriquerFiltreContexte(parametres, contexte);
    for (const id of tousLesIds(contexte)) {
      const b = aabbDe(scene, id);
      const estEnveloppe = TYPES_ENVELOPPE.includes(typeIfcDe(contexte, id)) && cadre && b && aabbSeCoupent(b, cadre) && (!dansContexte || dansContexte(id));
      if (estEnveloppe) enveloppe.push(id);
      else if (selection.has(id)) dedans.push(id);
      else masques.push(id);
    }
    journal.visible(dedans, true);
    journal.opacite(dedans, 1);
    journal.visible(enveloppe, true);
    journal.opacite(enveloppe, OPACITE_TRANSPARENT);
    journal.visible(masques, false);
    return journal.annuler;
  },
  libelle: () => ["le contenu de la zone reste plein, les murs et dalles qui l'entourent sont transparents, le reste est masqué"]
});
