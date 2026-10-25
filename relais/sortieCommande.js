// Revalidation de la sortie du modele pour POST /api/commande (24/10). Le schema strict contraint deja la reponse, mais rien n'est suppose : la
// commande est verifiee a nouveau par le moteur (action du registre, parametres connus, valeurs presentes dans les listes reellement envoyees),
// qui reprend chaque valeur telle qu'elle est ecrite dans la maquette.

import { validerCommande, REGISTRE } from "../src/commandesViewer.js";

const invalide = (message) => ({ ok: false, code: "sortie_invalide", message });

// Le schema met les parametres a plat a cote de « action » ; le moteur les attend dans « parametres ».
function versCommande(brute) {
  if (!brute || typeof brute !== "object" || Array.isArray(brute)) return null;
  const { action, ...parametres } = brute;
  return { action, parametres };
}

export function convertirSortieCommande(sortie, valeurs, phrase, registre = REGISTRE) {
  if (!sortie || typeof sortie !== "object" || Array.isArray(sortie)) return invalide("Sortie absente.");
  const relecture = typeof sortie.relecture === "string" ? sortie.relecture.trim() : "";
  if (!relecture) return invalide("Phrase de relecture absente.");

  if (sortie.resultat === "critere_introuvable" || sortie.resultat === "non_comprise") {
    return { ok: true, resultat: sortie.resultat, message: relecture };
  }
  if (sortie.resultat !== "commande") return invalide("Résultat inconnu.");

  const commande = versCommande(sortie.commande);
  if (!commande) return invalide("Commande absente.");
  const verdict = validerCommande(commande, valeurs, registre);
  if (!verdict.ok) return invalide(verdict.erreur);
  // La relecture vient de la commande validee (verdict.commande.relecture), pas du texte du modele : la question posee redit ce qui est applique.
  return { ok: true, resultat: "commande", commande: { ...verdict.commande, demande: phrase } };
}
