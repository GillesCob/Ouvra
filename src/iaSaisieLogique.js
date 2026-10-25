// Saisie IA commune (24/10) : logique d'ouverture et de bascule Vocal / Texte, sans DOM (testee). Utilisee par src/iaSaisie.js.
// Principe commun aux IA d'Ouvra : pas d'etape intermediaire « Texte / Vocal ». La demande s'ouvre DIRECTEMENT en mode vocal, micro pret (un clic
// demarre l'ecoute, un second la termine et envoie ; l'ecoute ne demarre jamais toute seule). « Ecrire ma demande » bascule en texte,
// « Utiliser le micro » revient au vocal, sans perdre la phrase. Dictee indisponible : ouverture directe en texte, avec la raison.

export const AIDE_VOCAL = "Appuie sur le micro pour faire ta demande à voix haute, ou écris-la.";
export const AIDE_ECOUTE = "Je t'écoute. Appuie de nouveau sur le micro pour terminer et envoyer.";
export const ANNONCE_VOCAL = "Mode vocal. Appuie sur le micro pour faire ta demande.";
export const ANNONCE_TEXTE = "Mode texte. Écris ta demande puis valide.";

// Mode d'ouverture de la demande : { mode: "vocal" | "texte", raison } (raison = pourquoi le vocal manque, sinon null).
export function modeOuverture({ dicteeDisponible, motifIndisponible = null }) {
  return dicteeDisponible ? { mode: "vocal", raison: null } : { mode: "texte", raison: motifIndisponible || "La dictée vocale n'est pas disponible ici. Tu peux écrire ta demande." };
}

// Mode apres un clic sur « Ecrire ma demande » / « Utiliser le micro ». Sans dictee, on reste en texte.
export function modeApresBascule(mode, { dicteeDisponible }) {
  if (mode === "vocal") return "texte";
  return dicteeDisponible ? "vocal" : "texte";
}

export const annonceMode = (mode) => (mode === "vocal" ? ANNONCE_VOCAL : ANNONCE_TEXTE);
export const aideVocal = (ecoute) => (ecoute ? AIDE_ECOUTE : AIDE_VOCAL);

// Que faire quand l'ecoute s'arrete ?
//   envoyer : l'utilisateur a termine (second clic) et une phrase a ete reconnue ;
//   texte   : l'ecoute s'est arretee d'elle-meme avec une phrase : on passe en texte pour la verifier, rien n'est perdu ni envoye tout seul ;
//   rien    : rien reconnu (le message « Rien n'a ete reconnu » s'affiche).
export function suiteFinEcoute({ termineParUtilisateur, phrase }) {
  if (!String(phrase || "").trim()) return "rien";
  return termineParUtilisateur ? "envoyer" : "texte";
}
