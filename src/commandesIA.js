// Point d'entree du Viewer par commande en langage naturel (24/10) : le bouton « IA » de la barre du Viewer (#commandesIABtn) ouvre DIRECTEMENT la modale de
// saisie COMMUNE (src/iaSaisie.js) en mode vocal, gros micro pret : un clic sur le micro demarre l'ecoute, un second la termine et envoie. Un bouton
// « Ecrire ma demande » bascule la meme modale en texte (champ, « Valider », phrases toutes faites dans leur menu deroulant), « Utiliser le micro » revient.
// Sans dictee disponible (pas d'API, micro refuse), elle s'ouvre en texte avec la raison. Plus de choix « Texte / Vocal » intermediaire.
//  - Apres l'envoi le logo Ouvra tourne pendant la traduction (traduire), puis la commande est appliquee tout de suite (proposerCommande) : la modale se
//    ferme et le bandeau « Est-ce bien votre demande ? » (src/commandesBandeau.js) prend le relais. Si la commande n'est pas applicable (zero element, etc.)
//    ou en cas d'echec de la traduction, la modale revient a sa vue avec le message.
//  - « Non » du bandeau : reformuler(phrase) rouvre la modale en TEXTE avec la phrase envoyee.
// Module sans dependance a main.js : tout passe par les parametres de creerCommandesIA.
//   bouton : le bouton « IA » (index.html) ; exemples : [{ demande }] (src/commandesExemples.js)
//   proposerCommande(commande) : applique la commande ; rend { ok: true } ou { ok: false, message } (rien n'est applique, le message s'affiche dans la
//     modale restee ouverte)
//   traduire(phrase) : promesse de { ok: true, resultat: "commande", commande } | { ok: true, resultat: "critere_introuvable" | "non_comprise", message }
//     | { ok: false, code, message } (src/commandesIAClient.js) ; ne rejette jamais
//   fermerAutres() : ferme les autres menus deroulants de la page

import "./commandesIA.css";
import { creerIASaisie } from "./iaSaisie.js";
import { messageRefus } from "./iaSaisieLogique.js";

const PLACEHOLDER_TEXTE = "Ex. : gaines au niveau 2";
const MESSAGE_PHRASE_VIDE = "Écrire ce qui est à voir, par exemple « affiche-moi les gaines au niveau 2 ».";

export function creerCommandesIA({ bouton, exemples, proposerCommande, traduire, fermerAutres }) {
  bouton.setAttribute("aria-haspopup", "dialog");

  const saisie = creerIASaisie({
    exemples,
    libelle: "Commande par l'IA",
    placeholder: PLACEHOLDER_TEXTE,
    messageVide: MESSAGE_PHRASE_VIDE,
    retourFocus: bouton,
    async surEnvoi(phrase, { annule }) {
      const reponse = await traduire(phrase);
      // Modale fermee (ou page quittee) depuis l'envoi : le resultat est abandonne, rien ne s'applique a l'insu de l'utilisateur.
      if (annule()) return { ok: false };
      if (reponse.ok && reponse.resultat === "commande") {
        const application = proposerCommande({ ...reponse.commande, demande: phrase });
        return application.ok ? { ok: true } : { ok: false, message: application.message }; // ok : le bandeau a deja pris le focus (« Oui »)
      }
      return { ok: false, message: reponse.ok ? messageRefus(reponse.resultat, reponse.message) : reponse.message };
    }
  });

  // Les clics du bouton ne remontent pas : xeokit annule l'action par defaut d'un clic tant que le pointeur est reste sur le canevas 3D.
  bouton.addEventListener("click", (e) => {
    e.stopPropagation();
    fermerAutres();
    if (saisie.ouvert()) saisie.fermer(true); else saisie.ouvrir();
  });

  return { fermer: () => saisie.fermer(false), ouvert: saisie.ouvert, reformuler: saisie.reformuler };
}
