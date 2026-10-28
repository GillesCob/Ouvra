// Viewer par commande (24/10) : le flux « appliquer tout de suite, puis confirmer ou annuler », sur une VUE CUMULATIVE. Sans interface ni reseau.
//
// La vue courante est une PILE d'etapes (une par commande acceptee ou en attente de reponse) ; les criteres cumules, les couches et le focus sont calcules par
// src/commandesVue.js. A chaque changement de la pile, la scene est entierement RECALCULEE depuis la pile (le moteur defait tout, puis rejoue vue de fond,
// couches et focus) : « Non » retire donc seulement la derniere etape et la scene redevient exactement ce qu'elle etait.
//  - proposer(commande) : empile et applique. Rend { ok: true, confirmation: true, demande, relecture, resume } (la question peut s'afficher), ou
//    { ok: false, message } (zero element, critere sans effet, commande invalide) : rien n'est modifie, aucune etape n'est empilee.
//    confirmation: false pour « tout reafficher » : applique, vide la pile, pas de question.
//    `recentrer` (les deux cas ok) : vrai quand la camera doit se recadrer comme « Recentrer » (commande qui cadre, hors focus qui a son propre cadrage ; « tout reafficher »).
//  - accepter() : « Oui », l'etape est validee. refuser() : « Non », SEULE la derniere etape tombe ; rend { phrase }, la phrase a reformuler.
//  - toutReafficher() : vide la pile (bouton). abandonner() : vide la pile et defait tout (sortie du Viewer).
//  - etatPourIA() : resume en mots de la vue actuelle (criteres, exclusions, couches, nombre d'etapes), envoye au relais pour que « ajoute », « enleve » et
//    « uniquement » soient bien compris.
// Une proposition faite pendant qu'une question est posee remplace l'etape en attente (pas d'empilement) ; si elle echoue, l'etape en attente reste.
// Module sans dependance a main.js ni au DOM : le moteur (creerControleur de src/commandesViewer.js) est passe en parametre.

import { validerCommande } from "./commandesViewer.js";
import { reduire, criteresDeLaVue, compositionDe, resumerVue } from "./commandesVue.js";
import { presentationEffective, PRESENTATIONS } from "./commandesPresentations.js";

export function creerFlux({ moteur }) {
  let pile = []; // [{ commande, validee }] ; au plus une etape non validee, la derniere

  const commandes = () => pile.map((e) => e.commande);

  // Recalcule toute la scene depuis la pile. `cadree` : la commande dont la camera doit se poser sur la selection (la derniere proposee), sinon aucune.
  // Rend le compte rendu de cette commande (resume du moteur, jamais affiche) ou "".
  function rendre(cadree) {
    moteur.reinitialiser();
    const { etat } = reduire(commandes());
    const criteres = criteresDeLaVue(etat);
    let resume = "";
    const estCadree = (commande) => !!cadree && commande === cadree && commande.parametres.cadrer;
    if (criteres.actif) {
      const fond = moteur.preparerVue({ ...criteres, cadrer: !!cadree && compositionDe(cadree.parametres) === "restreint" && cadree.parametres.cadrer });
      moteur.empiler(fond);
      if (cadree && compositionDe(cadree.parametres) === "restreint") resume = fond.resume;
    }
    for (const couche of etat.couches) {
      const prepare = preparerEtape(couche, estCadree(couche), true);
      if (prepare.ok && !prepare.vide) { moteur.empiler(prepare); if (couche === cadree) resume = prepare.resume; }
    }
    if (etat.focus) {
      const prepare = preparerEtape(etat.focus, estCadree(etat.focus), false);
      if (prepare.ok && !prepare.vide) { moteur.empiler(prepare); if (etat.focus === cadree) resume = prepare.resume; }
    }
    moteur.signaler("afficher");
    return resume;
  }

  // Une couche n'agit que sur ce qui est visible a cet instant de la reconstruction ; un focus peut viser un element masque.
  function preparerEtape(commande, cadrer, surLesVisibles) {
    const parametres = { ...commande.parametres, presentation: presentationEffective(commande.parametres), isoler: true, cadrer };
    return moteur.preparer({ action: "afficher", parametres }, null, surLesVisibles ? { parmi: moteur.visibles() } : undefined);
  }

  // Verifie, SANS rien changer a la scene, que la commande a un effet : au moins un element, et une vue qui change. La scene doit montrer la pile validee.
  function verifier(commande) {
    const candidats = [...pile.map((e) => e.commande), commande];
    const composition = compositionDe(commande.parametres);
    if (composition === "couche") {
      const prepare = preparerEtape(commande, false, true);
      return prepare.ok && !prepare.vide ? null : (prepare.resume || prepare.erreur);
    }
    if (composition === "focus") {
      const prepare = preparerEtape(commande, false, false);
      return prepare.ok && !prepare.vide ? null : (prepare.resume || prepare.erreur);
    }
    const verdict = reduire(candidats);
    if (!verdict.ok) return verdict.message;
    const criteres = criteresDeLaVue(verdict.etat);
    if (!criteres.actif) return null;
    const fond = moteur.preparerVue({ ...criteres, cadrer: false });
    return fond.vide ? fond.resume : null;
  }

  function proposer(brute) {
    const verdictCommande = validerCommande(brute, null);
    if (!verdictCommande.ok) return { ok: false, message: verdictCommande.erreur };
    const commande = verdictCommande.commande;
    if (commande.action === "tout_afficher") {
      const resultat = toutReafficher();
      return { ok: true, confirmation: false, resume: resultat.message, recentrer: true };
    }
    // L'etape en attente est remplacee : on verifie la nouvelle commande sur la pile validee seule, et on rend l'ancienne etape si elle echoue.
    const ancienne = pile;
    const validees = pile.filter((e) => e.validee);
    if (validees.length !== pile.length) { pile = validees; rendre(null); }
    const refus = verifier(commande);
    if (refus) {
      if (ancienne !== pile) { pile = ancienne; rendre(null); }
      return { ok: false, message: refus };
    }
    const composition = compositionDe(commande.parametres);
    pile = [...validees, { commande, validee: false }];
    const resume = rendre(commande);
    const recentrer = !!commande.parametres.cadrer && composition !== "focus" && PRESENTATIONS.trouver(presentationEffective(commande.parametres)).cadrage !== false;
    return { ok: true, confirmation: true, recentrer, demande: typeof commande.demande === "string" ? commande.demande : "", relecture: commande.relecture || "", resume };
  }

  function accepter() {
    const attente = pile.find((e) => !e.validee);
    if (!attente) return false;
    attente.validee = true;
    return true;
  }

  function refuser() {
    const attente = pile.find((e) => !e.validee);
    if (!attente) return null;
    pile = pile.filter((e) => e.validee);
    if (pile.length) rendre(null);
    else moteur.reinitialiser();
    return { phrase: typeof attente.commande.demande === "string" ? attente.commande.demande : "" };
  }

  function toutReafficher() {
    pile = [];
    return moteur.appliquer(moteur.preparer({ action: "tout_afficher" }));
  }

  function abandonner() {
    pile = [];
    return moteur.reinitialiser();
  }

  return {
    proposer, accepter, refuser, toutReafficher, abandonner,
    enAttente: () => pile.some((e) => !e.validee),
    etapes: () => pile.length,
    etatPourIA: () => resumerVue(commandes())
  };
}
