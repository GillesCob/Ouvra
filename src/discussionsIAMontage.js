// Discussions par commande IA (24/10) : assemblage des pieces (pipeline, flux, bandeau, panneau du rapport, saisie) autour de la messagerie.
// main.js n'a qu'a appeler creerDiscussionsIAMontage() puis passer monter / action a creerMessagerie (options surMonte et surActionIA) : toute la logique
// vit dans les modules de src/discussionsIA*.js.
//
//   monter(messagerie)   appele une fois le squelette de la messagerie construit (l'onglet #discussionsIABtn et le panneau #msgIAPanneau existent alors)
//   ouvrirSaisie()   l'onglet IA vient d'etre choisi : ouvre la modale de demande en vocal
//   action("tout")   bouton « Retour » de la liste filtree (annule le filtre ; aucun bouton du rapport dans le panneau de gauche)
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
import { construireRapportModele, construireRapportModeleCoupeFeu } from "./discussionsIARapportModele.js";
import { listerSyntheses, ajouterSynthese, ajouterRecherche, destinationOuverture, DEMOS_SYNTHESES } from "./discussionsIAHistorique.js";
import { REQUETE_MOBILE } from "./seuilMobile.js";

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
  let questionEnPause = null; // { relecture, resume } : question « Est-ce bien votre demande ? » masquee le temps de lire une source
  let derniereQuestion = null;
  let entreeHistorique = false; // une entree d'historique posee pour le retour du systeme est en cours
  let ignorerRetourSysteme = false; // le retour du systeme provoque par le bandeau lui-meme (on consomme l'entree)
  let rapportEnAttente = null; // rapport propose et pas encore confirme : « Oui » le rouvre s'il a ete ferme entre-temps

  function monter(messagerieMontee) {
    messagerie = messagerieMontee;
    const bouton = document.getElementById("discussionsIABtn");
    const panneau = document.getElementById("msgIAPanneau");
    if (!bouton || !panneau || ia) return;

    flux = creerFlux({ messagerie });
    rapportVue = creerRapportVue({
      texteRapport: rapportEnTexte,
      exporterPdf: async (rapport, onglet) => (await import("./discussionsIARapportPdf.js")).exporterRapportPdf(rapport, { telecharger, onglet, mobile: !!window.matchMedia && window.matchMedia(REQUETE_MOBILE).matches }),
      // Une source du rapport ouvre DIRECTEMENT le message cite dans sa discussion (jamais la liste des echanges du rapport) ; le bandeau « ← Retour au rapport »
      // (meme principe que « ← Retour a la conversation » du Viewer) rouvre le MEME rapport, tel quel, pour continuer la verification des autres blocs.
      // La question « Est-ce bien votre demande ? » (si elle attend encore) se met en pause sous la discussion et revient avec le rapport : sinon elle prendrait la place du bandeau.
      // Le retour du systeme (geste ou bouton arriere) fait la meme chose : une entree d'historique est posee a l'ouverture de la source.
      surSource: (mk, rapport) => {
        rapportEnAttente = null; // la verification des sources a commence : « Oui » ne rouvre rien, « Retour au rapport » s'en charge
        questionEnPause = bandeau.visible() ? derniereQuestion : null;
        bandeau.masquer(false);
        messagerie.montrerMessageIA(mk);
        retourRapport.montrer({ libelle: "Retour au rapport", surRetour: () => retourAuRapport(rapport) });
        if (!entreeHistorique && typeof history !== "undefined" && history.pushState) { history.pushState({ ouvraRetourRapport: true }, ""); entreeHistorique = true; }
      }
    });
    retourRapport = creerRetourContexte({
      id: "discussionsRapportBandeauRetour",
      classeCorps: "disc-rapport-retour-actif",
      ariaLabel: "Retour au rapport",
      autresClasses: ["msg-retour-actif", "regles-retour-actif", "quantitatif-retour-actif", "plan3d-retour-actif", "discussions-confirm-actif", "msg-echanges-retour-actif"] // un seul bandeau a la fois : le plus recent gagne
    });
    bandeau = creerDiscussionsBandeau({
      retourFocus: bouton,
      surOui: () => {
        // « Oui » : une recherche d'echanges entre dans « Recherches IA précédentes » (30/10) ; le rapport y est deja depuis son affichage.
        const retour = flux.accepter() ? flux.acceptee() : null;
        if (retour && retour.type === "liste") { ajouterRecherche(retour); ia.majHistorique(); }
        if (rapportEnAttente && !rapportVue.ouvert() && window.matchMedia(REQUETE_MOBILE).matches) rapportVue.ouvrir(rapportEnAttente); // mobile : le rapport est ce que « Oui » doit montrer, meme s'il a ete ferme sous le bandeau
        rapportEnAttente = null;
      },
      // « Non » : la demande est annulee, le panneau du rapport se ferme et la saisie se rouvre avec la phrase.
      surNon: () => {
        rapportEnAttente = null;
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
      // Historique des syntheses (28/10) : une synthese enregistree rouvre son rapport tel quel ; une synthese de demonstration est construite a l'ouverture sur les vrais messages.
      historique: { lister: () => listerSyntheses(), ouvrir: ouvrirSynthese },
      traiter: (phrase) => pipeline.traiter(phrase),
      proposer: (retour, phrase) => {
        const application = flux.proposer(retour, phrase);
        if (!application.ok) return application;
        derniereQuestion = { relecture: application.relecture, resume: application.resume };
        bandeau.montrer(derniereQuestion);
        // Le rapport de l'IA est garde dans l'historique des qu'il s'affiche (29/10) : le « Oui » du bandeau n'est pas toujours visible sur mobile. Jamais le « Voir un exemple ».
        if (application.type === "rapport") { rapportEnAttente = retour.rapport; ajouterSynthese(retour.rapport); ia.majHistorique(); rapportVue.ouvrir(retour.rapport); }
        return { ok: true };
      }
    });
  }

  // « ← Retour au rapport » (bandeau ou retour du systeme) : la discussion se referme (la liste de la page revient comme avant la source), le meme rapport se rouvre
  // et la question en pause revient avec lui.
  function retourAuRapport(rapport) {
    if (entreeHistorique) { entreeHistorique = false; ignorerRetourSysteme = true; history.back(); } // le bandeau consomme l'entree d'historique qu'il avait posee
    messagerie.fermerConversationIA();
    if (questionEnPause) { bandeau.montrer(questionEnPause); rapportEnAttente = rapport; questionEnPause = null; }
    if (rapportVue.derniereOuvertureAuCentre() && !window.matchMedia(REQUETE_MOBILE).matches) montrerRapportAuCentre(rapport); // laptop : le rapport revient dans la zone centrale, comme il y etait
    else rapportVue.ouvrir(rapport);
  }

  // Laptop (30/10) : un rapport de l'historique s'affiche dans la zone centrale (celle de la liste des discussions), sans modale. Le bandeau « Retour » existant
  // (meme composant que « Retour au rapport ») ramene a la liste ; la question « Est-ce bien votre demande ? » en attente passe en pause comme pour un echange ouvert.
  function montrerRapportAuCentre(rapport) {
    const centre = messagerie.preparerCentreIA(); // d'abord : il ferme un echange ouvert, ce qui ferait revenir la question mise en pause juste apres
    action("echange-ouvert");
    rapportEnAttente = null;
    rapportVue.ouvrirAuCentre(rapport, centre);
    retourRapport.montrer({
      libelle: "Retour aux discussions",
      surRetour: () => { rapportVue.fermer(); messagerie.fermerConversationIA(); action("echanges-retour"); }
    });
  }

  // Retour du systeme (geste, bouton arriere) depuis la discussion ouverte par une source : meme chose que le bandeau, jamais la liste des rapports.
  function surRetourSysteme() {
    if (ignorerRetourSysteme) { ignorerRetourSysteme = false; return; }
    if (!entreeHistorique) return;
    entreeHistorique = false;
    if (retourRapport && retourRapport.actif()) retourRapport.declencher();
  }
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("popstate", surRetourSysteme);

  function ouvrirSynthese(entree) {
    const destination = destinationOuverture(entree, { mobile: window.matchMedia(REQUETE_MOBILE).matches });
    if (entree.rapport) { if (destination === "centre") montrerRapportAuCentre(entree.rapport); else rapportVue.ouvrir(entree.rapport); return; }
    // Recherche d'echanges (30/10) : la liste filtree gardee est reappliquee telle quelle, sans appel IA ni question « Est-ce bien votre demande ? ».
    if (entree.recherche) { bandeau.masquer(false); rapportVue.fermer(); retourRapport.effacer(); questionEnPause = null; rapportEnAttente = null; flux.rouvrir(entree.recherche); return; }
    const donnees = messagerie.donneesPourIA();
    const index = indexer(donnees.conversations, donnees.personnes);
    const construire = entree.demo === DEMOS_SYNTHESES.coupeFeu ? construireRapportModeleCoupeFeu : construireRapportModele;
    const modele = construire(index, { maintenant: Date.now() });
    if (!modele.ok) return;
    if (destination === "centre") montrerRapportAuCentre(modele.rapport); else rapportVue.ouvrir(modele.rapport);
  }

  // L'onglet IA vient d'etre choisi (clic) : la modale de demande s'ouvre en vocal.
  function ouvrirSaisie() {
    if (ia) ia.ouvrir();
  }

  function action(nom) {
    // Laptop : un echange de la liste filtree s'ouvre (la question en attente passe en pause sous « Retour aux echanges de ma demande ») ou se referme (elle revient).
    if (nom === "echange-ouvert") { questionEnPause = bandeau.visible() ? derniereQuestion : null; bandeau.masquer(false); return; }
    if (nom === "echanges-retour") { if (questionEnPause && flux.enAttente()) bandeau.montrer(questionEnPause); questionEnPause = null; return; }
    if (nom === "tout") {
      bandeau.masquer(false);
      rapportVue.fermer();
      flux.toutReafficher();
    }
  }

  // Quitter la page Discussions : le bandeau « Retour au rapport » ne vit que sur cette page.
  function effacerRetour() {
    if (retourRapport) retourRapport.effacer();
  }

  return { monter, action, ouvrirSaisie, effacerRetour };
}
