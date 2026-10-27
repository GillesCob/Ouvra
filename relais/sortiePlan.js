// Revalidation de la sortie du modele pour POST /api/plan (25/10). Le schema strict contraint deja la reponse, mais rien n'est suppose : chaque commande est verifiee a nouveau
// par le moteur (action du registre, piece parmi celles envoyees, cote, nombres, enumerations), six commandes au plus. Le relais ne connait que les libelles des pieces :
// la verification complete contre le vrai plan (numero d'ouverture, mesures, chevauchements) est refaite par la page avant d'appliquer quoi que ce soit.

import { validerCommande, COMMANDES_MAX } from "../src/plan3d/ia/commandesPlan.js";

const invalide = (message) => ({ ok: false, code: "sortie_invalide", message });

export function convertirSortiePlan(sortie, libelles) {
  if (!sortie || typeof sortie !== "object" || Array.isArray(sortie)) return invalide("Sortie absente.");
  const explication = typeof sortie.explication === "string" ? sortie.explication.trim() : "";

  if (sortie.resultat === "element_introuvable" || sortie.resultat === "non_comprise") {
    if (!explication) return invalide("Phrase d'explication absente.");
    return { ok: true, resultat: sortie.resultat, message: explication };
  }
  if (sortie.resultat !== "commandes") return invalide("Résultat inconnu.");
  if (!Array.isArray(sortie.commandes) || sortie.commandes.length === 0) return invalide("Aucune commande.");
  if (sortie.commandes.length > COMMANDES_MAX) return invalide("Trop de commandes.");
  const faux = { parLibelle: new Set(libelles) };
  const commandes = [];
  for (const c of sortie.commandes) {
    const verdict = validerCommande(c, faux);
    if (!verdict.ok) return invalide(verdict.erreur);
    commandes.push(verdict.commande);
  }
  return { ok: true, resultat: "commandes", commandes };
}
