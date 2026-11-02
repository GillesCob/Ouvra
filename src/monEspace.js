// Page « Mon espace » (02/11) : barre d'instruction, cinq widgets. Pas un onglet de la barre : on y arrive par le lien de la derniere frise de la page
// Idees d'evolution (#espace), le fil d'Ariane ramene aux idees. Le HTML vient de src/monEspaceRendu.js, les donnees de src/monEspaceDonnees.js, la logique de
// src/monEspaceLogique.js ; le CSS (src/monEspace.css) est importe par main.js (ce module reste importable sous Node).
// Principe de la page : tout se regle par instruction, aucune manipulation.
// PAGE FIGEE (demonstration, aucun risque venant de l'IA) : la barre d'instruction (champ, Valider, micro, suggestions), les stylos et les boutons « Voir » des
// alertes et des documents sont affiches mais desactives (voir monEspaceRendu.js) ; aucun handler ni appel d'API IA ici. Reste actif :
//  - la croix retire un widget ou une vue (bouton « Annuler » pendant 8 secondes) ;
//  - la tuile « Ajouter une vue » ouvre le Viewer tel qu'il est (cible { type: "viewer" }, sans cadrage), avec le bandeau de retour ;
//  - un point de vue ouvre le Viewer cadre, un compteur de collisions ouvre la page Collision filtree, la puce de discussion d'une tache ou d'une echeance ouvre
//    la discussion au message source (main.js, ouvrirDepuisEspace) ; un bandeau « Retour a Mon espace » ramene ici, a la meme position de defilement (revenir).
// Rien n'est memorise : un rechargement remet tout.
import { WIDGETS } from "./monEspaceDonnees.js";
import { htmlPageEspace, htmlCompteurs } from "./monEspaceRendu.js";
import { MESSAGES_ESPACE, DELAI_ANNULATION_MS, retirerWidget, restaurer, idVue, trouverCible, creerMemoireDefilement } from "./monEspaceLogique.js";
import { VUE_ESPACE } from "./vuesIdees.js";

// ouvrir(cible, position) : ouvre la discussion ou la collision visee ; position = defilement de la page, que le bandeau de retour rendra (revenir).
// effectifs() : { <identifiant de filtre>: nombre } des collisions suivies, relu a chaque arrivee sur la page (jamais a la creation : la page Collision n'est pas encore prete).
export function creerMonEspace({ racine, aller, ouvrir = () => {}, effectifs = () => ({}), fenetre = window }) {
  racine.innerHTML = htmlPageEspace();
  const etat = racine.querySelector(".esp-etat-saisie");
  const elements = new Map();
  racine.querySelectorAll(".esp-widget").forEach((el) => elements.set(el.dataset.widget, el));
  racine.querySelectorAll(".esp-vue-item").forEach((el) => elements.set(idVue(el.dataset.vueId), el));
  const conteneur = racine.parentElement; // #view-espace : c'est lui qui defile
  const memoire = creerMemoireDefilement();
  let masques = new Set();
  let minuteur = 0;

  function ecrireEtat(message, annuler) {
    clearTimeout(minuteur);
    etat.textContent = message;
    if (!annuler) return;
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "esp-annuler-retrait";
    bouton.textContent = "Annuler";
    bouton.addEventListener("click", () => { masques = restaurer(masques, annuler); rendre("Rétabli."); });
    etat.append(" ", bouton);
    minuteur = setTimeout(() => { if (etat.contains(bouton)) etat.textContent = ""; }, DELAI_ANNULATION_MS);
  }

  function rendre(message, annuler) {
    elements.forEach((el, id) => { el.hidden = masques.has(id); });
    if (message !== undefined) ecrireEtat(message, annuler);
  }
  function appliquer(resultat, annuler) {
    masques = resultat.masques;
    rendre(resultat.message, annuler);
  }

  racine.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]");
    if (action) {
      const conteneurVue = action.closest("[data-vue-id]");
      const widget = action.closest("[data-widget]");
      const id = conteneurVue ? idVue(conteneurVue.dataset.vueId) : widget.dataset.widget;
      appliquer(retirerWidget(masques, id, conteneurVue ? MESSAGES_ESPACE.vueRetiree : MESSAGES_ESPACE.retire), id);
      return;
    }
    if (e.target.closest(".esp-vue-ajout")) { ouvrir({ type: "viewer" }, conteneur ? conteneur.scrollTop : 0); return; }
    const ciblee = e.target.closest("[data-cible]");
    if (ciblee) {
      const cible = trouverCible(WIDGETS, ciblee.dataset.cible);
      if (cible) ouvrir(cible, conteneur ? conteneur.scrollTop : 0);
      return;
    }
    const lien = e.target.closest("[data-vue]");
    if (lien) {
      e.preventDefault();
      aller(lien.dataset.vue);
    }
  });
  // Compteurs de « Collisions suivies » : recalcules depuis la source (favoris et statuts), jamais memorises.
  function majCompteurs() {
    const widget = WIDGETS.find((w) => w.type === "compteurs");
    const liste = widget && racine.querySelector(`[data-widget="${widget.id}"] .esp-compteurs`);
    if (!liste) return;
    let valeurs;
    try { valeurs = effectifs(); } catch { return; } // appelee pendant l'initialisation de main.js (rechargement sur #espace) : les collisions ne sont pas encore declarees, main.js rappelle apres l'initialisation
    liste.outerHTML = htmlCompteurs(widget.items, valeurs);
  }

  rendre();

  return {
    majCompteurs,
    // Appelee a chaque changement de vue : la page s'ouvre en haut, sauf au retour par le bandeau (revenir).
    surVueActivee(vue) {
      if (vue !== VUE_ESPACE) return;
      majCompteurs();
      if (conteneur) conteneur.scrollTop = memoire.consommer();
    },
    // Retour par le bandeau « Retour a Mon espace » : la page se rouvre a la position memorisee (une seule fois).
    revenir(position) {
      memoire.memoriser(position);
      aller(VUE_ESPACE);
    }
  };
}
