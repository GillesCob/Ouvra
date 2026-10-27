// Validation de ce que la page envoie a POST /api/discussions (24/10). Meme principe que relais/entree.js : rien n'est suppose, taille, types et
// listes sont verifies avant tout appel au modele. Deux etapes (champ « etape ») :
//  - comprendre : la phrase, les NOMS des personnes de la messagerie (rien d'autre : ni identifiant, ni contenu) et la date du jour ;
//  - analyser   : le sujet cherche et des extraits numerotes M1, M2... (discussion, auteur, date, texte coupe). C'est la SEULE etape ou du contenu de
//    discussion quitte la page : au plus MAX_EXTRAITS messages, EXTRAIT_MAX caracteres chacun, jamais de geometrie, de piece jointe ni d'identifiant.
// Tout champ inconnu est ignore.

import { PHRASE_MAX } from "./entree.js";
import { REGISTRE, SUJET_MAX, EXTRAIT_MAX, DISCUSSION_MAX, AUTEUR_MAX } from "../src/discussionsIAMoteur.js";
import { MAX_RAPPORT } from "../src/discussionsIAActions.js";

export const MAX_EXTRAITS = MAX_RAPPORT;
const PERSONNES_MAX = 30;
const NOM_MAX = 60; // nom de personne de la liste (etape comprendre)

const refus = (message) => ({ ok: false, code: "entree_invalide", message });
const texteBorne = (valeur) => (typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "");

// « AAAA-MM-JJ » reel du calendrier, sinon null.
function jourValide(texte) {
  const m = typeof texte === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? texte : null;
}

function validerPhrase(brut) {
  if (typeof brut !== "string") return { erreur: "La phrase est absente." };
  const phrase = texteBorne(brut);
  if (!phrase) return { erreur: "La phrase est vide." };
  if (phrase.length > PHRASE_MAX) return { erreur: "La phrase est trop longue (" + PHRASE_MAX + " caractères au plus)." };
  return { phrase };
}

function validerPersonnes(brut) {
  if (!Array.isArray(brut) || brut.length > PERSONNES_MAX * 2) return null;
  const noms = new Set();
  for (const n of brut) {
    if (typeof n !== "string") return null;
    const nom = n.trim();
    if (nom.length > NOM_MAX) return null;
    if (nom) noms.add(nom);
  }
  return noms.size <= PERSONNES_MAX ? Array.from(noms) : null;
}

function validerExtraits(brut) {
  if (!Array.isArray(brut) || brut.length === 0) return { erreur: "Aucun extrait à analyser." };
  if (brut.length > MAX_EXTRAITS) return { erreur: "Trop d'extraits (" + MAX_EXTRAITS + " au plus)." };
  const ids = new Set();
  const extraits = [];
  for (const e of brut) {
    if (!e || typeof e !== "object" || Array.isArray(e)) return { erreur: "Extrait mal formé." };
    if (typeof e.id !== "string" || !/^M\d{1,3}$/.test(e.id) || ids.has(e.id)) return { erreur: "Numéro d'extrait invalide ou répété." };
    // Libelles et texte coupes aux bornes (jamais rejetes : le titre d'un sujet cree dans la messagerie n'a pas de longueur maximale) ; la page coupe deja de meme.
    const discussion = texteBorne(e.discussion).slice(0, DISCUSSION_MAX);
    const auteur = texteBorne(e.auteur).slice(0, AUTEUR_MAX);
    const quand = typeof e.quand === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(e.quand) ? e.quand : "";
    const texte = texteBorne(e.texte).slice(0, EXTRAIT_MAX + 4);
    if (!discussion || !auteur || !quand) return { erreur: "Extrait incomplet." };
    if (!texte) return { erreur: "Texte d'extrait vide." };
    ids.add(e.id);
    extraits.push({ id: e.id, discussion, auteur, quand, texte });
  }
  return { extraits };
}

export function validerEntreeDiscussions(corps, maintenant = new Date(), registre = REGISTRE) {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return refus("Demande mal formée.");

  if (corps.etape === "comprendre") {
    const { phrase, erreur } = validerPhrase(corps.phrase);
    if (erreur) return refus(erreur);
    if (!corps.valeurs || typeof corps.valeurs !== "object" || Array.isArray(corps.valeurs)) return refus("Les valeurs de la messagerie sont absentes.");
    const personnes = validerPersonnes(corps.valeurs.personnes);
    if (!personnes) return refus("La liste des personnes est absente ou trop longue.");
    return { ok: true, etape: "comprendre", phrase, valeurs: { personnes }, aujourdhui: jourValide(corps.aujourdhui) || maintenant.toISOString().slice(0, 10) };
  }

  if (corps.etape === "analyser") {
    const action = typeof corps.action === "string" ? registre.obtenir(corps.action) : null;
    if (!action || !action.ia) return refus("Cette action n'a pas d'analyse.");
    const { phrase, erreur } = validerPhrase(corps.phrase);
    if (erreur) return refus(erreur);
    const sujet = texteBorne(corps.sujet);
    if (!sujet || sujet.length > SUJET_MAX) return refus("Le sujet est absent ou trop long.");
    const lot = validerExtraits(corps.extraits);
    if (lot.erreur) return refus(lot.erreur);
    return { ok: true, etape: "analyser", action: action.nom, phrase, sujet, extraits: lot.extraits };
  }

  return refus("Étape inconnue.");
}
