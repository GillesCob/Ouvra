// Liste « Conversation » du dialogue Nouveau sujet / Conversation existante : conversations individuelles et de groupe separees en deux groupes
// (<optgroup>). Libelles repris a l'identique des onglets de la page Discussions (« Individuel », « Groupes », src/messagerie/messagerie.js).
// Fonction pure (testee sous Node) : l'ordre recu est conserve a l'interieur de chaque groupe, un groupe vide n'est pas rendu.
export const GROUPES_CONVERSATIONS = [
  { type: "individuel", libelle: "Individuel" },
  { type: "groupe", libelle: "Groupes" }
];

export function regrouperConversations(conversations) {
  return GROUPES_CONVERSATIONS
    .map(({ type, libelle }) => ({ type, libelle, conversations: conversations.filter((c) => c.type === type) }))
    .filter((g) => g.conversations.length > 0);
}
