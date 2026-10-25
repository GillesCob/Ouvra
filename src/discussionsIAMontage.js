// Discussions par commande IA (24/10) : assemblage des pieces (pipeline, flux, bandeau, panneau du rapport, saisie) autour de la messagerie.
// main.js n'a qu'a appeler creerDiscussionsIAMontage() puis passer monter / action a creerMessagerie (options surMonte et surActionIA) : toute la logique
// vit dans les modules de src/discussionsIA*.js.
//
//   monter(messagerie)   appele une fois le squelette de la messagerie construit (l'onglet #discussionsIABtn et le panneau #msgIAPanneau existent alors)
//   ouvrirSaisie()   l'onglet IA vient d'etre choisi : ouvre la modale de demande en vocal
//   action("tout" | "rapport")   boutons de la liste filtree : « Tout réafficher » et « Voir le rapport »

import { creerDiscussionsIA } from "./discussionsIA.js";
import { creerDiscussionsBandeau } from "./discussionsIABandeau.js";
import { creerRapportVue } from "./discussionsIARapportVue.js";
import { creerFlux } from "./discussionsIAFlux.js";
import { creerPipeline } from "./discussionsIAPipeline.js";
import { indexer } from "./discussionsIAIndex.js";
import { rapportEnTexte } from "./discussionsIAMoteur.js";
import { EXEMPLES_DISCUSSIONS } from "./discussionsIAExemples.js";
import { demanderComprehension, demanderAnalyse } from "./discussionsIAClient.js";

const DELAI_ANALYSE_MS = 42000; // un rapport est plus long a ecrire : un peu plus que le delai du relais (32 s)

// Date du jour de l'utilisateur, « AAAA-MM-JJ » (heure locale), envoyee au relais pour resoudre « depuis 3 jours » ou « le 15 octobre ».
function dateDuJourLocale() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function creerDiscussionsIAMontage() {
  let messagerie = null;
  let flux = null;
  let bandeau = null;
  let rapportVue = null;
  let ia = null;

  function monter(messagerieMontee) {
    messagerie = messagerieMontee;
    const bouton = document.getElementById("discussionsIABtn");
    const panneau = document.getElementById("msgIAPanneau");
    if (!bouton || !panneau || ia) return;

    flux = creerFlux({ messagerie });
    rapportVue = creerRapportVue({
      texteRapport: rapportEnTexte,
      surSource: (mk) => messagerie.montrerMessageIA(mk)
    });
    bandeau = creerDiscussionsBandeau({
      retourFocus: bouton,
      surOui: () => flux.accepter(),
      // « Non » : la demande est annulee, le panneau du rapport se ferme et la saisie se rouvre avec la phrase.
      surNon: () => {
        rapportVue.fermer();
        const retour = flux.refuser();
        if (retour) ia.reformuler(retour.phrase);
      }
    });
    const pipeline = creerPipeline({
      lireIndex: () => {
        const donnees = messagerie.donneesPourIA();
        return indexer(donnees.conversations, donnees.personnes);
      },
      comprendre: ({ phrase, valeurs }) => demanderComprehension({ phrase, valeurs, aujourdhui: dateDuJourLocale() }),
      analyser: (corps) => demanderAnalyse(corps, { delaiMs: DELAI_ANALYSE_MS })
    });

    ia = creerDiscussionsIA({
      panneau,
      retourFocus: bouton,
      exemples: EXEMPLES_DISCUSSIONS,
      traiter: (phrase) => pipeline.traiter(phrase),
      proposer: (retour, phrase) => {
        const application = flux.proposer(retour, phrase);
        if (!application.ok) return application;
        bandeau.montrer({ relecture: application.relecture, resume: application.resume });
        if (application.type === "rapport") rapportVue.ouvrir(retour.rapport);
        return { ok: true };
      }
    });
  }

  // L'onglet IA vient d'etre choisi (clic) : la modale de demande s'ouvre en vocal.
  function ouvrirSaisie() {
    if (ia) ia.ouvrir();
  }

  function action(nom) {
    if (nom === "tout") {
      bandeau.masquer(false);
      rapportVue.fermer();
      flux.toutReafficher();
    } else if (nom === "rapport") {
      const rapport = messagerie.rapportIA();
      if (rapport) rapportVue.ouvrir(rapport);
    }
  }

  return { monter, action, ouvrirSaisie };
}
