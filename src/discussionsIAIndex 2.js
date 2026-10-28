// Discussions par commande IA (24/10) : index a plat des conversations de la messagerie, sans DOM ni reseau.
//
// La messagerie stocke ses donnees en memoire (conversations > fil principal + sujets > messages, voir src/messagerie/messagerieDonnees.js).
// L'index les met a plat pour que le moteur (src/discussionsIAMoteur.js) filtre, cherche et cite :
//  - un FIL = le fil principal d'une conversation ou un de ses sujets ; sa cle est « convId/sujetId » (sujetId vide pour le principal) ;
//  - un MESSAGE = un message ecrit (les evenements du journal ne sont pas indexes) ; sa cle est « cleFil#position », la position etant celle du
//    message dans fil.messages. La cle sert a retrouver le message dans la page (data-mk) ; elle ne part JAMAIS vers l'IA (les extraits envoyes
//    portent des numeros courts M1, M2... propres a chaque requete, voir preparerAnalyse du moteur).
// Les noms viennent de la messagerie : « Vous » designe l'utilisateur (identifiant MOI).

import { MOI } from "./messagerie/messagerieDonnees.js";

export const cleFil = (convId, sujetId) => convId + "/" + (sujetId || "");
export const cleMessage = (cle, position) => cle + "#" + position;

// « conv/sujet#3 » -> { convId, sujetId, position } ou null.
export function lireCleMessage(mk) {
  const m = typeof mk === "string" ? /^([^/#]+)\/([^#]*)#(\d+)$/.exec(mk) : null;
  return m ? { convId: m[1], sujetId: m[2] || null, position: Number(m[3]) } : null;
}

// conversations : tableau de la messagerie ; personnes : { id: { nom } }. Rend { fils, messages, parCle, personnes }.
export function indexer(conversations, personnes) {
  const nomDe = (id) => (personnes[id] ? personnes[id].nom : id);
  const fils = [];
  const messages = [];
  const parCle = new Map();

  function ajouterFil(conv, fil, sujet) {
    const cle = cleFil(conv.id, sujet ? sujet.id : null);
    const entrees = [];
    fil.messages.forEach((m, position) => {
      if (m.systeme) return;
      const entree = {
        mk: cleMessage(cle, position), filCle: cle, convId: conv.id, sujetId: sujet ? sujet.id : null, position,
        auteur: m.auteur, auteurNom: nomDe(m.auteur), quand: m.quand.getTime(), texte: m.texte || "", mentions: m.mentions || [], aVue: !!m.vue
      };
      entrees.push(entree);
      messages.push(entree);
      parCle.set(entree.mk, entree);
    });
    fils.push({
      cle, convId: conv.id, sujetId: sujet ? sujet.id : null, convNom: conv.nom, convType: conv.type,
      titre: sujet ? sujet.titre : "Principal", statut: sujet ? sujet.statut : null, urgent: !!(sujet && sujet.urgent && sujet.statut !== "clos"),
      nonLus: fil.nonLus || 0, tagues: sujet ? sujet.tagues.slice() : [],
      interlocuteur: conv.type === "individuel" ? (conv.membres.find((p) => p !== MOI) || null) : null,
      messages: entrees
    });
  }

  conversations.forEach((conv) => {
    ajouterFil(conv, conv.principal, null);
    conv.sujets.forEach((s) => ajouterFil(conv, s, s));
  });

  const liste = Object.keys(personnes).filter((id) => id !== MOI).map((id) => ({ id, nom: personnes[id].nom }));
  return { fils, messages, parCle, personnes: liste, filParCle: new Map(fils.map((f) => [f.cle, f])) };
}

// Une personne est impliquee dans un fil si elle y ecrit, y est mentionnee, y est taguee, ou si c'est l'interlocuteur du 1 a 1.
// Etre simple membre d'un groupe ne suffit pas (sinon tout groupe repondrait pour tout le monde).
export function filImplique(fil, personneId) {
  return fil.interlocuteur === personneId || fil.tagues.includes(personneId) ||
    fil.messages.some((m) => m.auteur === personneId || m.mentions.includes(personneId));
}
