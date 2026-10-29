// Discussions par commande IA (24/10) : le flux « appliquer tout de suite, puis confirmer ou annuler », calque sur src/commandesFlux.js (Viewer).
// Sans interface ni reseau : la messagerie est passee en parametre.
//
//   proposer(retour, phrase)   applique le resultat (filtre de la liste, messages mis en evidence) ; rend { ok: true, type, relecture, resume } (la
//                              question « Est-ce bien votre demande ? » peut s'afficher) ou { ok: false, message } (rien n'est applique)
//   accepter()                 « Oui » : le filtre reste ; il devient le point de retour d'un futur « Non »
//   refuser()                  « Non » : la demande en attente est annulee ; si une demande avait ete acceptee avant, elle est rappliquee. Rend { phrase }
//   toutReafficher()           retire tout filtre (bouton « Tout réafficher » de la liste) ; l'attente et le point de retour sont oublies
// messagerie : { appliquerFiltreIA(filtre), confirmerFiltreIA(), retirerFiltreIA() }

export const MESSAGE_RAPPORT_VIDE = "Rien n'a été dit à ce sujet.";
const pluriel = (n, un, plusieurs) => n + " " + (n > 1 ? plusieurs : un);

// Compte rendu d'un resultat pour le bandeau.
export function resumerResultat(retour) {
  const nbFils = retour.resultat.fils.length;
  const nbMis = retour.resultat.surlignes.length;
  if (retour.type === "rapport") return retour.rapport.vide ? MESSAGE_RAPPORT_VIDE : "Rapport prêt, avec ses sources dans " + pluriel(nbFils, "discussion", "discussions") + ".";
  const base = pluriel(nbFils, "discussion", "discussions") + (nbMis ? ", " + pluriel(nbMis, "message trouvé", "messages trouvés") : "") + ".";
  return retour.repli ? base + " " + retour.repli : base;
}

export function creerFlux({ messagerie }) {
  let enAttente = null; // { retour, phrase } : demande appliquee mais pas encore confirmee
  let acceptee = null; // retour de la derniere demande confirmee et toujours appliquee

  // confirme : faux tant que « Est-ce bien votre demande ? » attend une reponse (la liste n'affiche alors pas son bandeau « Retour »).
  function appliquer(retour, confirme) {
    messagerie.appliquerFiltreIA({ ...retour.resultat, relecture: retour.relecture, type: retour.type, rapport: retour.rapport || null, confirme });
  }

  function proposer(retour, phrase = "") {
    if (!retour || !retour.ok) return { ok: false, message: retour ? retour.message : "Demande impossible." };
    appliquer(retour, false);
    enAttente = { retour, phrase };
    return { ok: true, type: retour.type, relecture: retour.relecture, resume: resumerResultat(retour) };
  }

  function accepter() {
    if (!enAttente) return false;
    acceptee = enAttente.retour;
    enAttente = null;
    messagerie.confirmerFiltreIA();
    return true;
  }

  function refuser() {
    if (!enAttente) return null;
    const { phrase } = enAttente;
    enAttente = null;
    if (acceptee) appliquer(acceptee, true); else messagerie.retirerFiltreIA();
    return { phrase };
  }

  function toutReafficher() {
    enAttente = null;
    acceptee = null;
    messagerie.retirerFiltreIA();
  }

  return { proposer, accepter, refuser, toutReafficher, enAttente: () => enAttente !== null };
}
