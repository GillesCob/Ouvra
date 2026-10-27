// Validation de ce que la page envoie a POST /api/commande (24/10). Meme principe que relais/entree.js : rien n'est suppose, taille, types et
// listes sont verifies avant tout appel au modele. Seuls des MOTS arrivent (phrase, types IFC, niveaux, maquettes, quelques noms d'elements) :
// aucune geometrie, aucun etat de la scene, et tout champ inconnu est ignore. Les listes peuvent etre vides (la traduction repond alors
// « critere introuvable »), mais jamais absentes.

import { PHRASE_MAX, nettoyerListe } from "./entree.js";
import { SELECTEURS, FILTRES_CONTEXTE } from "../src/commandesSelecteurs.js";

const LISTES = ["typesIfc", "niveaux", "maquettes", "noms"];
const ZONES_MAX = 30;
const ZONE_NOM_MAX = 60;

const refus = (message) => ({ ok: false, code: "entree_invalide", message });

// Zones nommees par l'utilisateur (facultatives : absentes = aucune zone). Que des noms, jamais les coordonnees du volume.
function nettoyerZones(brut) {
  if (brut === undefined) return { liste: [] };
  if (!Array.isArray(brut) || brut.length > ZONES_MAX * 4) return { erreur: "La liste « zones » est mal formée." };
  const vus = new Set();
  for (const nom of brut) {
    if (typeof nom !== "string") return { erreur: "La liste « zones » contient autre chose que du texte." };
    const texte = nom.trim();
    if (texte.length > ZONE_NOM_MAX) return { erreur: "Un nom de zone est trop long." };
    if (texte) vus.add(texte);
  }
  if (vus.size > ZONES_MAX) return { erreur: "La liste « zones » est trop longue." };
  return { liste: Array.from(vus) };
}

// Vue actuelle du Viewer, en mots (src/commandesVue.js, resumerVue) : criteres actifs et exclus par critere, couches, nombre d'etapes. Facultative. Que des
// mots, bornes ; un critere inconnu, une liste trop longue ou une valeur trop longue sont ecartes (jamais un refus de toute la requete pour un detail d'etat).
const ETAT_VALEURS_MAX = 12;
const ETAT_TEXTE_MAX = 160;
const ETAT_COUCHES_MAX = 6;
const ETAT_ETAPES_MAX = 500;

function nettoyerEtat(brut) {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const criteres = new Set([...SELECTEURS.noms(), ...FILTRES_CONTEXTE.noms()]);
  const listes = (source) => {
    const sortie = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) return sortie;
    for (const [nom, valeurs] of Object.entries(source)) {
      if (!criteres.has(nom) || !Array.isArray(valeurs)) continue;
      const propres = valeurs.filter((v) => typeof v === "string" && v.trim() && v.length <= ETAT_TEXTE_MAX).slice(0, ETAT_VALEURS_MAX);
      if (propres.length) sortie[nom] = propres;
    }
    return sortie;
  };
  const texte = (v) => (typeof v === "string" ? v.trim().slice(0, ETAT_TEXTE_MAX) : "");
  return {
    etapes: Number.isInteger(brut.etapes) && brut.etapes >= 0 ? Math.min(brut.etapes, ETAT_ETAPES_MAX) : 0,
    facettes: listes(brut.facettes),
    exclues: listes(brut.exclues),
    sansContexte: brut.sansContexte === true,
    couches: (Array.isArray(brut.couches) ? brut.couches : []).map(texte).filter(Boolean).slice(0, ETAT_COUCHES_MAX),
    focus: texte(brut.focus)
  };
}

export function validerEntreeCommande(corps) {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return refus("Demande mal formée.");
  if (typeof corps.phrase !== "string") return refus("La phrase est absente.");
  const phrase = corps.phrase.replace(/\s+/g, " ").trim();
  if (!phrase) return refus("La phrase est vide.");
  if (phrase.length > PHRASE_MAX) return refus("La phrase est trop longue (" + PHRASE_MAX + " caractères au plus).");
  if (!corps.valeurs || typeof corps.valeurs !== "object" || Array.isArray(corps.valeurs)) return refus("Les valeurs de la maquette sont absentes.");
  const valeurs = {};
  for (const nom of LISTES) {
    const { liste, erreur } = nettoyerListe(nom, corps.valeurs[nom]);
    if (erreur) return refus(erreur);
    valeurs[nom] = liste;
  }
  const zones = nettoyerZones(corps.valeurs.zones);
  if (zones.erreur) return refus(zones.erreur);
  valeurs.zones = zones.liste;
  return { ok: true, phrase, valeurs, etat: nettoyerEtat(corps.etat) };
}
