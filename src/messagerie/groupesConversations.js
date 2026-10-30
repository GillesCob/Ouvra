// Choix de la conversation du dialogue « Nouveau sujet » / « Conversation existante » (28/10) : d'abord le TYPE (individuelle ou de groupe), rien de presélectionné,
// puis la liste des conversations de ce type. Fonctions pures (testees sous Node) : l'ordre recu est conserve.
export const TYPES_CONVERSATION = [
  { type: "individuel", libelle: "Conversation individuelle" },
  { type: "groupe", libelle: "Conversation de groupe" }
];

// Conversations du type donne ; type inconnu ou absent : liste vide (aucune conversation proposee tant que le type n'est pas choisi).
export function conversationsDuType(conversations, type) {
  return TYPES_CONVERSATION.some((t) => t.type === type) ? conversations.filter((c) => c.type === type) : [];
}

// Libelle d'une conversation dans le menu de choix (30/10) : une conversation individuelle affiche le metier du contact entre parentheses apres son nom
// (« Sophie Lambert (BET Fluides) »), le metier etant son sous-titre (personne.role). Sans metier : le nom seul. Un groupe : son nom (son sous-titre est un nombre de participants).
// Libelle d'affichage seulement : la valeur du menu reste l'identifiant de la conversation.
export function libelleConversation(conversation) {
  const metier = conversation.type === "individuel" && typeof conversation.sousTitre === "string" ? conversation.sousTitre.trim() : "";
  return metier ? conversation.nom + " (" + metier + ")" : conversation.nom;
}
