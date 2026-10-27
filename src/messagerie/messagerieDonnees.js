// Modele de la messagerie (aucune donnee fictive ici, voir donneesDemo.js).
//
// Conversation : { id, type: "individuel" | "groupe", nom, membres: [idPersonne], sousTitre, principal: Fil, sujets: [Sujet] }
// Fil (le principal d'une conversation) : { messages, nonLus, mentions, repereNb, reperePos, affiches }
// Sujet : un Fil avec en plus { id, titre, tagues: [idPersonne], statut, urgent, closPar?, closLe? }
//   urgent : booleen distinct du statut ; un sujet clos le perd (voir cloturer).
// Message : { auteur, quand: Date, texte, vue?, mentions?: [idPersonne] (personnes notifiees par un « @Nom » du texte) } ou evenement du journal :
//   { systeme: true, genre: "ouverture" | "statut" | "cloture" | "reouverture" | "ajout" | "urgence", auteur, quand, statut?, sujetId?, titre?, tagues?, personne?, urgent? }
// Vue (prise de vue jointe a un message) : { seed, niveau, modeles, image?, etat? }
//   image : URL ou data URL JPEG ; etat : { camera, maquettes, ... } pour rouvrir le Viewer au meme angle ; sans image, schema de repli.

export const MOI = "me";
export const STATUTS_ACTIFS = ["ouvert", "encours", "attente"];
export const LIBELLES_STATUT = { ouvert: "Ouvert", encours: "En cours", attente: "En attente", clos: "Clos" };
// Messages charges par paquet quand on remonte l'historique.
export const TAILLE_PAQUET = 40;

export function creerFil(messages, nonLus, mentions) {
  return { messages, nonLus, mentions: mentions || 0, repereNb: 0, reperePos: 0, affiches: 0 };
}

export function insererParDate(liste, element) {
  let pos = 0;
  while (pos < liste.length && liste[pos].quand < element.quand) pos++;
  liste.splice(pos, 0, element);
}

export function dernierMessage(fil) {
  for (let i = fil.messages.length - 1; i >= 0; i--) if (!fil.messages[i].systeme) return fil.messages[i];
  return fil.messages[fil.messages.length - 1];
}

export function nonLusSujets(conv) {
  return conv.sujets.reduce((n, s) => n + s.nonLus, 0);
}
export function nonLusConv(conv) {
  return conv.principal.nonLus + nonLusSujets(conv);
}
export function activiteConv(conv) {
  const dernier = dernierMessage(conv.principal);
  let t = dernier ? dernier.quand : conv.creeLe;
  conv.sujets.forEach((s) => {
    const l = dernierMessage(s).quand;
    if (l > t) t = l;
  });
  return t;
}

// Conversation neuve, sans aucun message : 1 a 1 avec une personne ou groupe nomme par l'utilisateur (creeLe sert de date d'activite).
export function creerConversation({ id, type, nom, membres, sousTitre, quand }) {
  return { id, type, nom, membres, sousTitre, principal: creerFil([], 0, 0), sujets: [], creeLe: quand };
}

// Le fil actif d'une conversation : le sujet choisi, sinon le principal.
export function filActif(conv, sujetId) {
  if (!sujetId) return conv.principal;
  return conv.sujets.find((s) => s.id === sujetId) || null;
}

// Ouvrir un fil : les non lus passent a zero dans les listes, le repere « N nouveaux messages » reste dans le fil.
export function ouvrirFil(fil) {
  fil.reperePos = fil.messages.length - fil.nonLus;
  fil.repereNb = fil.nonLus;
  fil.nonLus = 0;
  fil.affiches = Math.max(TAILLE_PAQUET, fil.repereNb + 8);
}

export function fermerRepere(fil) {
  fil.repereNb = 0;
}

export function ajouterMessage(fil, message) {
  fil.messages.push(message);
  fil.affiches += 1;
}

// Evenement du journal : toujours dans le sujet ; l'ouverture, la cloture et la reouverture laissent aussi une trace dans le principal.
export function ajouterEvenement(conv, sujet, genre, quand, statut) {
  sujet.messages.push({ systeme: true, genre, statut, auteur: MOI, quand });
  sujet.affiches += 1;
  if (genre !== "statut") {
    conv.principal.messages.push({ systeme: true, genre, sujetId: sujet.id, quand, auteur: MOI, titre: sujet.titre, tagues: [] });
    conv.principal.affiches += 1;
  }
}

// Ajout d'une personne a un sujet de groupe : elle voit tout l'historique ; seul le journal du sujet en garde la trace, pas le principal.
export function ajouterPersonne(sujet, personne, quand) {
  sujet.tagues.push(personne);
  sujet.messages.push({ systeme: true, genre: "ajout", auteur: MOI, quand, personne });
  sujet.affiches += 1;
}

// Ajout de personnes au groupe (« + » des Participants) : elles deviennent membres et voient tout l'historique ; les sujets existants gardent leurs tags.
export function ajouterAuGroupe(conv, personnes) {
  personnes.forEach((p) => { if (!conv.membres.includes(p)) conv.membres.push(p); });
  conv.sousTitre = conv.membres.length + " participants";
}

export function changerStatut(conv, sujet, statut, quand) {
  sujet.statut = statut;
  ajouterEvenement(conv, sujet, "statut", quand, statut);
}

// Urgence : un sujet clos n'est jamais urgent ; le marqueur ne compte que sur un sujet non clos.
export function estUrgent(sujet) {
  return sujet.urgent && sujet.statut !== "clos";
}
export function convAUrgent(conv) {
  return conv.sujets.some(estUrgent);
}

// Bascule d'urgence : seul le journal du sujet en garde la trace, pas le principal.
export function basculerUrgence(sujet, quand) {
  sujet.urgent = !sujet.urgent;
  sujet.messages.push({ systeme: true, genre: "urgence", auteur: MOI, quand, urgent: sujet.urgent });
  sujet.affiches += 1;
}

export function cloturer(conv, sujet, quand) {
  sujet.statut = "clos";
  sujet.urgent = false;
  sujet.closPar = MOI;
  sujet.closLe = quand;
  ajouterEvenement(conv, sujet, "cloture", quand);
}

export function rouvrir(conv, sujet, quand) {
  sujet.statut = "ouvert";
  ajouterEvenement(conv, sujet, "reouverture", quand);
}

// Nouveau sujet : le premier message ouvre le fil, le principal garde la trace de l'ouverture.
export function creerSujet(conv, { titre, texte, tagues, vue, quand, id, urgent }) {
  const sujet = Object.assign(creerFil([{ auteur: MOI, quand, texte, vue: vue || undefined }], 0, 0), {
    id: id || "n" + quand.getTime(), titre, tagues, statut: "ouvert", urgent: !!urgent, creeEnSession: true
  });
  conv.sujets.push(sujet);
  conv.principal.messages.push({ systeme: true, genre: "ouverture", sujetId: sujet.id, quand, auteur: MOI, titre, tagues });
  conv.principal.affiches += 1;
  return sujet;
}

// Premiere prise de vue d'un sujet : sa « vue d'origine ».
export function vueOrigine(sujet) {
  return sujet.messages.find((m) => m.vue) || null;
}

export function sujetsClos(conv) {
  return conv.sujets.filter((s) => s.statut === "clos").sort((a, b) => b.closLe - a.closLe);
}

// Pastilles de sujets, ordre voulu par Gilles (22/10) : 1) sujets avec non lus (quel que soit leur caractere urgent), 2) sujets urgents, 3) sujets non urgents.
// Dans chaque groupe, les plus recents d'abord. Un sujet cree en session se place toujours en dernier de son groupe urgent / non urgent (jamais dans le groupe des non lus),
// dans l'ordre de creation. Le sujet actif (actifId) garde son rang de « non lu » tant qu'il est ouvert : l'ouvrir ne le deplace pas, il ne descend qu'une fois quitte.
export function sujetsTries(conv, actifId) {
  const groupe = (s) => (!s.creeEnSession && (s.nonLus > 0 || s.id === actifId) ? 0 : estUrgent(s) ? 1 : 2);
  return conv.sujets.slice().sort((x, y) => (groupe(x) - groupe(y)) || (!!x.creeEnSession - !!y.creeEnSession) ||
    (x.creeEnSession ? 0 : dernierMessage(y).quand - dernierMessage(x).quand));
}

// Onglets de la liste : « individuel », « groupe » et « ia » (les discussions trouvees par une commande IA, sans liste de conversations).
export const ONGLETS = ["individuel", "groupe", "ia"];

// Conversations d'un onglet, dans l'ordre d'affichage de la liste : celles qui ont des non lus d'abord, puis la plus recente d'abord.
export function listeTriee(conversations, type) {
  return conversations
    .filter((c) => c.type === type)
    .sort((a, b) => {
      const ua = nonLusConv(a) > 0;
      const ub = nonLusConv(b) > 0;
      if (ua !== ub) return ua ? -1 : 1;
      return activiteConv(b) - activiteConv(a);
    });
}

// Conversation a ouvrir automatiquement quand on choisit un onglet : la premiere de la liste affichee (Individuel comme Groupes). Aucune pour l'onglet IA
// (le centre reste vide tant qu'aucune discussion n'est choisie dans les resultats), ni sur mobile (la liste prend l'ecran, on n'ouvre rien a la place de l'utilisateur).
export function conversationAOuvrir(conversations, onglet, { mobile = false } = {}) {
  if (mobile || onglet === "ia" || !ONGLETS.includes(onglet)) return null;
  const premiere = listeTriee(conversations, onglet)[0];
  return premiere ? premiere.id : null;
}

export function convParId(conversations, id) {
  return conversations.find((c) => c.id === id) || null;
}
