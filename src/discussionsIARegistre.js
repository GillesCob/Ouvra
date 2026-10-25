// Discussions par commande IA (24/10) : le REGISTRE D'ACTIONS, extensible. Sans dependance : ni DOM, ni reseau, ni donnees.
//
// Ajouter une demande possible = ajouter UN enregistrement dans src/discussionsIAActions.js. Le schema envoye au modele (relais/schemaDiscussions.js),
// la validation (src/discussionsIAMoteur.js), la consigne (relais/consigneDiscussions.js) et les tests de coherence le lisent tous ici.
//
// Une action :
//   nom           identifiant stable (celui que le modele choisit)
//   description   une phrase pour le modele : quand choisir cette action
//   parametres    [{ nom, genre, obligatoire, description }] ; genre : personne | texte | mots | periode | statuts | booleen
//   sortie        "liste" (discussions filtrees, messages mis en evidence) ou "rapport" (synthese sourcee)
//   ia            vrai : le texte de messages retenus part vers le modele pour un classement (liste) ou une synthese (rapport) ; faux : tout reste local
//   verifier(p)   facultatif : message d'erreur si la combinaison de parametres n'a pas de sens, sinon rien
//   selectionner(p, index, contexte)   cherche dans l'index (src/discussionsIAIndex.js), voir le moteur
//   relecture(p)  phrase de repli (infinitif) quand la commande ne vient pas du modele

export const GENRES = ["personne", "texte", "mots", "periode", "statuts", "booleen"];
export const STATUTS_SUJET = ["ouvert", "encours", "attente", "clos"];

export function creerRegistre(actions = []) {
  const parNom = new Map();
  const registre = {
    enregistrer(action) {
      if (!action || typeof action.nom !== "string" || !action.nom) throw new Error("Action sans nom.");
      if (parNom.has(action.nom)) throw new Error("Action déjà enregistrée : " + action.nom);
      if (!["liste", "rapport"].includes(action.sortie)) throw new Error("Sortie inconnue pour " + action.nom);
      for (const p of action.parametres) if (!GENRES.includes(p.genre)) throw new Error("Genre inconnu pour " + action.nom + "." + p.nom);
      if (typeof action.selectionner !== "function") throw new Error("Action sans sélection : " + action.nom);
      parNom.set(action.nom, action);
      return registre;
    },
    obtenir: (nom) => parNom.get(nom) || null,
    toutes: () => Array.from(parNom.values()),
    noms: () => Array.from(parNom.keys())
  };
  actions.forEach((a) => registre.enregistrer(a));
  return registre;
}
