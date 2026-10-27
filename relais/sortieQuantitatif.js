// Revalidation de la sortie du modele pour POST /api/quantitatif (24/10). Le schema strict contraint deja la reponse, mais rien n'est suppose : la
// requete est verifiee a nouveau par le moteur (mesure du registre, filtres connus, valeurs presentes dans les listes reellement envoyees, deux
// regroupements au plus). La phrase de relecture d'une requete est REECRITE par le moteur (libelleRequete) : jamais le texte libre du modele,
// qui pourrait redire autre chose que ce qui sera calcule.

import { validerRequete, libelleRequete } from "../src/quantitatif.js";

const invalide = (message) => ({ ok: false, code: "sortie_invalide", message });

export function convertirSortieQuantitatif(sortie, valeurs) {
  if (!sortie || typeof sortie !== "object" || Array.isArray(sortie)) return invalide("Sortie absente.");
  const relecture = typeof sortie.relecture === "string" ? sortie.relecture.trim() : "";

  if (sortie.resultat === "critere_introuvable" || sortie.resultat === "non_comprise") {
    if (!relecture) return invalide("Phrase d'explication absente.");
    return { ok: true, resultat: sortie.resultat, message: relecture };
  }
  if (sortie.resultat !== "requete") return invalide("Résultat inconnu.");

  const verdict = validerRequete(sortie.requete, valeurs);
  if (!verdict.ok) return invalide(verdict.erreur);
  return { ok: true, resultat: "requete", requete: verdict.requete, relecture: libelleRequete(verdict.requete) };
}
