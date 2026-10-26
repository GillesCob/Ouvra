// Revalidation de la sortie du modele pour POST /api/discussions (24/10). Le schema strict contraint deja la reponse, mais rien n'est suppose.
//  - comprendre : la commande est reverifiee par le moteur (action du registre, personnes de la messagerie, periode valide) ;
//  - analyser : la forme de la reponse est verifiee ici ; les numeros de messages cites sont reverifies un par un par le moteur de la page
//    (conclureClassement / conclureRapport), qui ecarte tout numero absent des extraits envoyes.

import { validerCommande, REGISTRE } from "../src/discussionsIAMoteur.js";
import { normaliserRapport } from "../src/discussionsIARapportNormaliser.js";
import { periodeDepuisPlat } from "./schemaDiscussions.js";

const invalide = (message) => ({ ok: false, code: "sortie_invalide", message });

// Le schema met l'action et TOUS les parametres a plat a la racine ; le moteur attend { action, parametres } avec les seuls parametres de l'action choisie,
// la periode revenant a sa forme du moteur (periodeDepuisPlat).
function versCommande(brute, registre) {
  if (!brute || typeof brute !== "object" || Array.isArray(brute)) return null;
  const action = typeof brute.action === "string" ? registre.obtenir(brute.action) : null;
  if (!action) return { action: brute.action, parametres: {} };
  const parametres = {};
  for (const def of action.parametres) parametres[def.nom] = def.genre === "periode" ? periodeDepuisPlat(brute[def.nom]) : brute[def.nom];
  return { action: action.nom, parametres };
}

export function convertirSortieComprendre(sortie, valeurs, registre = REGISTRE) {
  if (!sortie || typeof sortie !== "object" || Array.isArray(sortie)) return invalide("Sortie absente.");
  const relecture = typeof sortie.relecture === "string" ? sortie.relecture.trim() : "";
  if (!relecture) return invalide("Phrase de relecture absente.");
  if (sortie.resultat === "critere_introuvable" || sortie.resultat === "non_comprise") return { ok: true, resultat: sortie.resultat, message: relecture };
  if (sortie.resultat !== "commande") return invalide("Résultat inconnu.");
  const commande = versCommande(sortie, registre);
  if (!commande) return invalide("Commande absente.");
  const verdict = validerCommande(commande, valeurs, registre);
  if (!verdict.ok) return invalide(verdict.erreur);
  return { ok: true, resultat: "commande", commande: verdict.commande, relecture };
}

// extraits : ceux REELLEMENT envoyes (id, discussion, auteur, quand, texte). Tout numero cite hors de cette liste est retire ici, avant meme que la page
// ne le reverifie ; un point dont un chiffre ou un mois ne figure dans aucun de ses messages cites est rendu « non confirmé ».
export function convertirSortieAnalyse(sortie, sortieAction, extraits = []) {
  if (!sortie || typeof sortie !== "object" || Array.isArray(sortie)) return invalide("Sortie absente.");
  const parId = new Map(extraits.map((e) => [e.id, e]));
  if (sortieAction === "liste") {
    if (!Array.isArray(sortie.resultats)) return invalide("Classement absent.");
    return { ok: true, sortie: { resultats: sortie.resultats.filter((r) => r && parId.has(r.id)) } };
  }
  // Format fixe du rapport : la normalisation est celle de la page (src/discussionsIARapportNormaliser.js), le relais reverifie avec le meme code.
  const rapport = normaliserRapport(sortie, {
    auteurs: new Set(extraits.map((e) => e.auteur)),
    texteDe: (id) => (parId.has(id) ? parId.get(id).texte + " " + parId.get(id).quand + " " + moisDe(parId.get(id).quand) : null),
    auteurDe: (id) => (parId.has(id) ? parId.get(id).auteur : null)
  });
  if (!rapport) return invalide("Rapport absent.");
  if (rapport.vide) return { ok: true, sortie: { rien_a_dire: true } };
  return { ok: true, sortie: { rien_a_dire: false, titre: rapport.titre, contexte: rapport.contexte, intervenants: rapport.intervenants, desaccords: rapport.desaccords, decision: rapport.decision } };
}

const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisDe = (quand) => NOMS_MOIS[Number(String(quand).slice(5, 7)) - 1] || "";
