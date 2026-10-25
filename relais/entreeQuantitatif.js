// Validation de ce que la page envoie a POST /api/quantitatif (24/10). Meme principe que relais/entree.js et relais/entreeCommande.js : rien n'est
// suppose, taille, types et listes sont verifies avant tout appel au modele. Seuls des MOTS arrivent (phrase, types IFC, niveaux, maquettes, quelques
// noms d'elements, noms de mesures) : aucune geometrie, aucune quantite, et tout champ inconnu est ignore.
// Les mesures proposees doivent exister dans le registre du moteur (src/quantitatif.js) : la page ne peut pas en inventer une.

import { PHRASE_MAX, nettoyerListe } from "./entree.js";
import { MESURES } from "../src/quantitatif.js";

const LISTES = ["typesIfc", "niveaux", "maquettes", "noms"];

const refus = (message) => ({ ok: false, code: "entree_invalide", message });

export function validerEntreeQuantitatif(corps) {
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
  const connues = MESURES.noms();
  const mesures = corps.valeurs.mesures;
  if (!Array.isArray(mesures) || mesures.length === 0 || mesures.length > connues.length) return refus("La liste « mesures » est absente ou vide.");
  if (mesures.some((m) => typeof m !== "string" || !connues.includes(m))) return refus("La liste « mesures » contient une mesure inconnue.");
  valeurs.mesures = Array.from(new Set(mesures));
  return { ok: true, phrase, valeurs };
}
