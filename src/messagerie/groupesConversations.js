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
