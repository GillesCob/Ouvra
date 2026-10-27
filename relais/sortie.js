// Revalidation de la sortie du modele (22/10). Le schema strict contraint deja la reponse, mais rien n'est suppose : chaque valeur est
// verifiee a nouveau contre les listes reellement envoyees, puis convertie en regle au format EXACT du moteur (src/reglesCollision.js).
// La regle produite porte en plus « relecture » (phrase de relecture, hors contrat du moteur, ignoree par lui).

import { CHAMPS_CRITERE, CHAMPS_ACTION, ACTION_AFFICHER, validerCritereDate } from "../src/reglesCollision.js";

// Portees que l'IA a le droit de produire : « a » et « b » (ordre interne des elements) n'existent pas dans le vocabulaire de l'utilisateur.
export const PORTEES_IA = ["un_des_deux", "les_deux"];
// Champ de critere du moteur -> liste de valeurs permises envoyee par la page.
export const LISTE_DU_CHAMP = { typeIfc: "typesIfc", niveau: "niveaux", maquette: "maquettes", nom: "noms" };

const invalide = (message) => ({ ok: false, code: "sortie_invalide", message });

// Valeur canonique de la liste egale (sans tenir compte de la casse) a celle du modele, ou null.
function canonique(liste, valeur) {
  if (typeof valeur !== "string") return null;
  const cherchee = valeur.trim().toLowerCase();
  return (liste || []).find((v) => v.toLowerCase() === cherchee) || null;
}

export function convertirSortie(sortie, valeurs, phrase) {
  if (!sortie || typeof sortie !== "object" || Array.isArray(sortie)) return invalide("Sortie absente.");
  const relecture = typeof sortie.relecture === "string" ? sortie.relecture.trim() : "";
  if (!relecture) return invalide("Phrase de relecture absente.");

  if (sortie.resultat === "critere_introuvable" || sortie.resultat === "non_comprise") {
    return { ok: true, resultat: sortie.resultat, message: relecture };
  }
  if (sortie.resultat !== "regle") return invalide("Résultat inconnu.");

  if (!PORTEES_IA.includes(sortie.portee)) return invalide("Portée non permise.");
  const criteresBruts = sortie.criteres === undefined || sortie.criteres === null ? [] : sortie.criteres;
  if (!Array.isArray(criteresBruts)) return invalide("Critères mal formés.");
  const champsVus = new Set();
  const criteres = [];
  for (const critere of criteresBruts) {
    if (!critere || !CHAMPS_CRITERE.includes(critere.champ)) return invalide("Champ de critère inconnu.");
    if (champsVus.has(critere.champ)) return invalide("Deux critères sur le même champ.");
    champsVus.add(critere.champ);
    const contient = canonique(valeurs[LISTE_DU_CHAMP[critere.champ]], critere.valeur);
    if (!contient) return invalide("Valeur absente de la maquette pour « " + critere.champ + " ».");
    criteres.push({ champ: critere.champ, contient });
  }

  // Etat de la collision (priorite, statut) : seules les valeurs non nulles comptent, chacune reprise telle que permise.
  const etat = {};
  if (sortie.etat !== undefined && sortie.etat !== null) {
    if (typeof sortie.etat !== "object" || Array.isArray(sortie.etat)) return invalide("État mal formé.");
    for (const champ of CHAMPS_ACTION) {
      if (sortie.etat[champ] === undefined || sortie.etat[champ] === null) continue;
      const valeur = canonique(valeurs[champ], sortie.etat[champ]);
      if (!valeur) return invalide("Valeur d'état non permise pour « " + champ + " ».");
      etat[champ] = valeur;
    }
  }

  // Dates : chaque critere est reverifie par le moteur (format, bornes, calendrier).
  const dates = sortie.dates === undefined || sortie.dates === null ? [] : sortie.dates;
  if (!Array.isArray(dates)) return invalide("Dates mal formées.");
  for (const critereDate of dates) {
    if (!validerCritereDate(critereDate).ok) return invalide("Critère de date invalide.");
  }
  if (criteres.length === 0 && Object.keys(etat).length === 0 && dates.length === 0) return invalide("Aucun critère.");

  const action = sortie.action;
  let actionRegle;
  if (action && action.champ === ACTION_AFFICHER) {
    actionRegle = { champ: ACTION_AFFICHER };
  } else {
    if (!action || !CHAMPS_ACTION.includes(action.champ)) return invalide("Action absente ou inconnue.");
    const valeur = canonique(valeurs[action.champ], action.valeur);
    if (!valeur) return invalide("Valeur d'action non permise.");
    actionRegle = { champ: action.champ, valeur };
  }

  const filtre = { portee: sortie.portee, criteres };
  if (Object.keys(etat).length) filtre.etat = etat;
  if (dates.length) filtre.dates = dates;
  return { ok: true, resultat: "regle", regle: { demande: phrase, relecture, filtre, action: actionRegle } };
}
