// Revalidation de la sortie du modele (22/10). Le schema strict contraint deja la reponse, mais rien n'est suppose : chaque valeur est
// verifiee a nouveau contre les listes reellement envoyees, puis convertie en regle au format EXACT du moteur (src/reglesCollision.js).
// La regle produite porte en plus « relecture » (phrase de relecture, hors contrat du moteur, ignoree par lui).

import { CHAMPS_CRITERE, CHAMPS_ACTION } from "../src/reglesCollision.js";

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
  if (!Array.isArray(sortie.criteres) || sortie.criteres.length === 0) return invalide("Aucun critère.");
  const champsVus = new Set();
  const criteres = [];
  for (const critere of sortie.criteres) {
    if (!critere || !CHAMPS_CRITERE.includes(critere.champ)) return invalide("Champ de critère inconnu.");
    if (champsVus.has(critere.champ)) return invalide("Deux critères sur le même champ.");
    champsVus.add(critere.champ);
    const contient = canonique(valeurs[LISTE_DU_CHAMP[critere.champ]], critere.valeur);
    if (!contient) return invalide("Valeur absente de la maquette pour « " + critere.champ + " ».");
    criteres.push({ champ: critere.champ, contient });
  }
  const action = sortie.action;
  if (!action || !CHAMPS_ACTION.includes(action.champ)) return invalide("Action absente ou inconnue.");
  const valeur = canonique(valeurs[action.champ], action.valeur);
  if (!valeur) return invalide("Valeur d'action non permise.");

  return {
    ok: true,
    resultat: "regle",
    regle: { demande: phrase, relecture, filtre: { portee: sortie.portee, criteres }, action: { champ: action.champ, valeur } }
  };
}
