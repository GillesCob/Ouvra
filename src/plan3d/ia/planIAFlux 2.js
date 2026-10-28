// IA du plan 2D (25/10) : le flux « phrase -> IA -> commandes -> plan modifie -> Est-ce bien votre demande ? ». Module pur : tout ce qui touche la page (modele courant, historique,
// bandeau) est injecte, donc le flux se teste sans navigateur. Meme principe que le Viewer et le Quantitatif : la modification est appliquee TOUT DE SUITE (un seul pas d'historique),
// le bandeau demande confirmation, « Non » defait ce pas et rouvre la saisie avec la phrase.
//
//   creerFluxPlanIA({ obtenirModele, appliquer, annuler, demander, surBandeau })
//     obtenirModele() : modele courant ; appliquer(modele) : le met en place (un pas d'historique) ; annuler() : defait le dernier pas ;
//     demander({ phrase, description }) : src/plan3d/ia/planIAClient.js ; surBandeau({ visible, texte }) : montre ou cache le bandeau.
//   rend { traiter(phrase, { annule }), confirmer(), refuser(), surChangement(modele), enAttente() }
//     traiter : promesse de { ok: true } | { ok: false, message } (contrat de src/iaSaisie.js, ne rejette jamais) ; refuser rend la phrase a redire.

import { decrirePlan } from "./descriptionPlan.js";
import { appliquerCommandes } from "./commandesPlan.js";

const MESSAGE_SANS_PIECE = "Le plan n'a pas encore de pièce. Trace d'abord au moins une pièce avec l'outil Pièce.";

export function creerFluxPlanIA({ obtenirModele, appliquer, annuler, demander, surBandeau }) {
  let attente = null; // { phrase, apres } : modification appliquee, pas encore confirmee

  function fermerBandeau() {
    attente = null;
    surBandeau({ visible: false, texte: "" });
  }

  async function traiter(phrase, { annule = () => false } = {}) {
    fermerBandeau();
    const modele = obtenirModele();
    const description = decrirePlan(modele);
    if (description.pieces.length === 0) return { ok: false, message: MESSAGE_SANS_PIECE };
    let reponse;
    try {
      reponse = await demander({ phrase, description });
    } catch {
      return { ok: false, message: "L'IA est injoignable pour le moment. Utilise les outils du plan." };
    }
    if (annule()) return { ok: false, message: "" }; // modale fermee entre-temps : rien n'est applique a l'insu de l'utilisateur
    if (!reponse.ok) return { ok: false, message: reponse.message };
    if (reponse.resultat !== "commandes") return { ok: false, message: reponse.message };
    if (obtenirModele() !== modele) return { ok: false, message: "Le plan a changé pendant la demande. Redis ta demande." };
    const resultat = appliquerCommandes(modele, reponse.commandes);
    if (!resultat.ok) return { ok: false, message: resultat.message };
    attente = { phrase, apres: resultat.modele }; // avant appliquer : surChangement reconnait notre propre modification
    appliquer(resultat.modele);
    surBandeau({ visible: true, texte: resultat.comptesRendus.join(" ") });
    return { ok: true };
  }

  function confirmer() {
    fermerBandeau();
  }

  // « Non » : le pas d'historique est defait ; rend la phrase pour la rouvrir dans la saisie.
  function refuser() {
    const courante = attente;
    fermerBandeau();
    if (!courante) return "";
    if (obtenirModele() === courante.apres) annuler();
    return courante.phrase;
  }

  // Toute modification du plan qui n'est pas la notre (outil, annuler, import) rend la question sans objet.
  function surChangement(modele) {
    if (attente && modele !== attente.apres) fermerBandeau();
  }

  return { traiter, confirmer, refuser, surChangement, enAttente: () => attente !== null };
}
