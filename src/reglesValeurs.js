// Regles de collision en langage naturel, branchement de l'IA (22/10) : ce que la page envoie au relais.
// Seuls des MOTS partent vers l'IA (types IFC, niveaux, maquettes, quelques noms d'elements) : jamais la geometrie.
//  - typesIfc, niveaux, maquettes : calcules sur les maquettes reellement chargees a chaque demande (valeursPossibles, src/reglesCollision.js) ;
//  - noms : les noms d'elements se comptent en milliers (19 683 pour la maquette mecanique de l'hopital) et ne sont pas tous envoyes.
//    Une recherche prealable, dans la page, retient au plus NOMS_MAX noms de « Famille:Type » proches des mots de la phrase.
// Fonctions pures : la scene (metaScene xeokit) et la liste des maquettes sont passees en parametre.

import { normaliser, valeursPossibles } from "./reglesCollision.js";

export const NOMS_MAX = 15;
const NOM_LONGUEUR_MAX = 160; // meme plafond que relais/entree.js
const TYPES_SPATIAUX = new Set(["IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace"]);
const MOTS_VIDES = new Set([
  "les", "des", "une", "que", "qui", "pour", "avec", "dans", "sur", "tout", "toute", "toutes", "tous", "entre", "est", "sont", "aux", "par", "pas", "plus",
  "collision", "collisions", "passe", "passer", "mets", "mettre", "met", "urgent", "urgente", "haute", "basse", "normale", "priorite", "statut",
  "ecarte", "ecarter", "confirme", "confirmer", "element", "elements", "implique", "impliquent", "concerne", "concernent", "niveau", "maquette",
  "dont", "leur", "chaque", "ces", "cette", "quand", "elles", "ils"
]);

// Index des noms « Famille:Type » (suffixe numerique de l'identifiant Revit retire, doublons fusionnes), refait seulement si le nombre
// d'objets de la scene a change (chargement progressif des maquettes).
const indexes = new WeakMap();

function indexNoms(metaScene) {
  if (!metaScene || typeof metaScene !== "object") return [];
  const objets = metaScene && metaScene.metaObjects ? Object.values(metaScene.metaObjects) : [];
  const memo = indexes.get(metaScene);
  if (memo && memo.taille === objets.length) return memo.noms;
  const vus = new Map();
  for (const mo of objets) {
    if (!mo || !mo.name || TYPES_SPATIAUX.has(mo.type)) continue;
    const nom = String(mo.name).replace(/:\d+$/, "");
    if (!nom || nom.length > NOM_LONGUEUR_MAX || vus.has(nom)) continue;
    vus.set(nom, normaliser(nom));
  }
  const noms = Array.from(vus, ([brut, norme]) => ({ brut, norme }));
  indexes.set(metaScene, { taille: objets.length, noms });
  return noms;
}

// Mots de la phrase utiles a la recherche, avec un radical raccourci pour tolerer pluriels et suffixes (« diffuseur » / « Diffuser »).
function motsDe(phrase) {
  const mots = normaliser(phrase).split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
  const singuliers = mots.map((mot) => (mot.length > 4 ? mot.replace(/[sx]$/, "") : mot));
  return Array.from(new Set(singuliers)).map((mot) => (mot.length >= 5 ? [mot, mot.slice(0, Math.max(4, mot.length - 2))] : [mot]));
}

// Mots (separes par espace, deux-points, souligne, tiret...) des noms retenus qui contiennent un des mots de la phrase, du plus frequent au moins frequent.
// Le critere « nom » du moteur cherche une SOUS-CHAINE : « Diffuser » vise tous les diffuseurs, ce que ne permet aucun nom complet « Famille:Type ».
function motsDesNoms(noms, mots) {
  const frequences = new Map(); // forme normalisee -> { mot (casse d'origine), n }
  for (const nom of noms) {
    const vus = new Set();
    for (const mot of nom.split(/[\s:_\-.,()/]+/)) {
      const norme = normaliser(mot);
      if (norme.length < 3 || vus.has(norme) || !mots.some((formes) => formes.some((f) => norme.includes(f)))) continue;
      vus.add(norme);
      const existant = frequences.get(norme);
      if (existant) existant.n += 1;
      else frequences.set(norme, { mot, n: 1 });
    }
  }
  return Array.from(frequences.values()).sort((a, b) => b.n - a.n || a.mot.length - b.mot.length || a.mot.localeCompare(b.mot, "fr")).map((e) => e.mot);
}

// Au plus `max` valeurs pour le critere « nom » : d'abord quelques mots communs (au plus un tiers), puis les noms « Famille:Type » les mieux classes.
export function nomsProches(metaScene, phrase, max = NOMS_MAX) {
  const mots = motsDe(phrase);
  if (!mots.length) return [];
  const classes = [];
  for (const { brut, norme } of indexNoms(metaScene)) {
    const score = mots.reduce((total, formes) => total + (formes.some((f) => norme.includes(f)) ? 1 : 0), 0);
    if (score > 0) classes.push({ brut, score });
  }
  classes.sort((a, b) => b.score - a.score || a.brut.length - b.brut.length || a.brut.localeCompare(b.brut, "fr"));
  const noms = classes.map((c) => c.brut);
  const motsCommuns = motsDesNoms(noms.slice(0, 200), mots).slice(0, Math.floor(max / 3)).filter((m) => m.length <= NOM_LONGUEUR_MAX);
  return [...motsCommuns, ...noms.filter((n) => !motsCommuns.includes(n))].slice(0, max);
}

// valeursAction : { priorite: [...], statut: [...] }, les valeurs permises par la page (une seule source : main.js).
export function valeursPourIA(metaScene, maquettes, phrase, valeursAction) {
  const possibles = valeursPossibles(metaScene, maquettes);
  return {
    typesIfc: possibles.typesIfc.filter((t) => !TYPES_SPATIAUX.has(t)),
    niveaux: possibles.niveaux,
    maquettes: possibles.maquettes,
    noms: nomsProches(metaScene, phrase),
    priorite: valeursAction.priorite.slice(),
    statut: valeursAction.statut.slice()
  };
}
