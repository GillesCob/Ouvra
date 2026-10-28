// Discussions par commande IA (24/10) : assemblage des pieces (pipeline, flux, bandeau, panneau du rapport, saisie) autour de la messagerie.
// main.js n'a qu'a appeler creerDiscussionsIAMontage() puis passer monter / action a creerMessagerie (options surMonte et surActionIA) : toute la logique
// vit dans les modules de src/discussionsIA*.js.
//
//   monter(messagerie)   appele une fois le squelette de la messagerie construit (l'onglet #discussionsIABtn et le panneau #msgIAPanneau existent alors)
//   ouvrirSaisie()   l'onglet IA vient d'etre choisi : ouvre la modale de demande en vocal
//   action("tout" | "rapport")   boutons de la liste filtree : « Tout réafficher » et « Voir le rapport »
//   effacerRetour()   efface le bandeau « ← Retour au rapport » (appele par main.js quand on quitte la page Discussions)

import { creerDiscussionsIA } from "./discussionsIA.js";
import { creerDiscussionsBandeau } from "./discussionsIABandeau.js";
import { creerRetourContexte } from "./retourContexte.js";
import { creerRapportVue } from "./discussionsIARapportVue.js";
import { creerFlux } from "./discussionsIAFlux.js";
import { creerPipeline } from "./discussionsIAPipeline.js";
import { indexer } from "./discussionsIAIndex.js";
import { rapportEnTexte } from "./discussionsIAMoteur.js";
import { EXEMPLES_DISCUSSIONS } from "./discussionsIAExemples.js";
import { demanderComprehension, demanderAnalyse } from "./discussionsIAClient.js";
import { construireRapportModele } from "./discussionsIARapportModele.js";

const DELAI_ANALYSE_MS = 42000; // un rapport est plus long a ecrire : un peu plus que le delai du relais (32 s)

// Telechargement d'un fichier genere dans le navigateur (le meme geste que la page Quantitatif) : rien n'est envoye a un serveur.
function telecharger(nomFichier, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  let retourRapport = null;

  function monter(messagerieMontee) {
    messagerie = messagerieMontee;
    const bouton = document.getElementById("discussionsIABtn");
    const panneau = document.getElementById("msgIAPanneau");
    if (!bouton || !panneau || ia) return;

    flux = creerFlux({ messagerie });
    rapportVue = creerRapportVue({
      texteRapport: rapportEnTexte,
      exporterPdf: async (rapport, onglet) => (await import("./discussionsIARapportPdf.js")).exporterRapportPdf(rapport, { telecharger, onglet }),
      // Une source du rapport ouvre la discussion au message cite ; le bandeau « ← Retour au rapport » (meme principe que « ← Retour a la conversation » du Viewer)
      // rouvre le MEME rapport pour continuer la verification des autres blocs.
      surSource: (mk, rapport) => {
        messagerie.montrerMessageIA(mk);
        retourRapport.montrer({ libelle: "Retour au rapport", surRetour: () => rapportVue.ouvrir(rapport) });
      }
    });
    retourRapport = creerRetourContexte({
      id: "discussionsRapportBandeauRetour",
      classeCorps: "disc-rapport-retour-actif",
      ariaLabel: "Retour au rapport",
      autresClasses: ["msg-retour-actif", "regles-retour-actif", "quantitatif-retour-actif", "plan3d-retour-actif", "discussions-confirm-actif"] // un seul bandeau a la fois : le plus recent gagne
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
      // Lien « Voir un exemple de rapport » (28/10) : le rapport modele s'ouvre dans la meme fenetre que le rapport de l'IA, sans appel reseau ni bandeau de confirmation.
      exempleRapport: {
        libelle: "Voir un exemple de rapport",
        surClic: () => {
          const donnees = messagerie.donneesPourIA();
          const modele = construireRapportModele(indexer(donnees.conversations, donnees.personnes), { maintenant: Date.now() });
          if (modele.ok) rapportVue.ouvrir(modele.rapport);
        }
      },
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

  // Quitter la page Discussions : le bandeau « Retour au rapport » ne vit que sur cette page.
  function effacerRetour() {
    if (retourRapport) retourRapport.effacer();
  }

  return { monter, action, ouvrirSaisie, effacerRetour };
}
