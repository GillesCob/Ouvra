// Page « Mon espace » (02/11) : barre d'instruction, six widgets, journal. Pas un onglet de la barre : on y arrive par le lien de la derniere frise de la page
// Idees d'evolution (#espace), le fil d'Ariane ramene aux idees. Le HTML vient de src/monEspaceRendu.js, les donnees de src/monEspaceDonnees.js, la logique de
// src/monEspaceLogique.js ; le CSS (src/monEspace.css) est importe par main.js (ce module reste importable sous Node).
// Principe de la page : tout se regle par instruction, aucune manipulation.
//  - une phrase du journal retapee refait apparaitre son widget ; « Annuler » du journal masque le dernier ;
//  - le stylo d'un widget ou d'une vue prepare « Modifie ... : » dans la barre ; la croix retire (bouton « Annuler » pendant 8 secondes, ou phrase retapee) ;
//  - la tuile « Ajouter une vue » prepare « Ajoute une vue : » dans la barre ;
//  - une vue ouvre le Viewer, une discussion source ouvre Discussions : navigation seulement, la commande du Viewer n'est PAS appliquee (pas branche) ;
//  - le micro bascule seulement son etat (aucune dictee reelle ici). Rien n'est memorise : un rechargement remet tout.
import { WIDGETS, TEXTES_ESPACE } from "./monEspaceDonnees.js";
import { htmlPageEspace } from "./monEspaceRendu.js";
import { MESSAGES_ESPACE, DELAI_ANNULATION_MS, appliquerInstruction, retirerWidget, restaurer, lignesJournal, idVue, phraseModifier } from "./monEspaceLogique.js";
import { VUE_ESPACE } from "./vuesIdees.js";

export function creerMonEspace({ racine, aller, fenetre = window }) {
  racine.innerHTML = htmlPageEspace();
  const champ = racine.querySelector(".esp-champ");
  const etat = racine.querySelector(".esp-etat-saisie");
  const liste = racine.querySelector(".esp-journal-liste");
  const vide = racine.querySelector(".esp-vide");
  const micro = racine.querySelector(".esp-micro");
  const elements = new Map();
  racine.querySelectorAll(".esp-widget").forEach((el) => elements.set(el.dataset.widget, el));
  racine.querySelectorAll(".esp-vue-item").forEach((el) => elements.set(idVue(el.dataset.vueId), el));
  const conteneur = racine.parentElement; // #view-espace : c'est lui qui defile
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
    liste.textContent = "";
    const lignes = lignesJournal(WIDGETS, masques);
    lignes.forEach((l) => {
      const li = document.createElement("li");
      const phrase = document.createElement("span");
      phrase.className = "esp-phrase";
      phrase.textContent = l.phrase;
      li.appendChild(phrase);
      if (l.annulable) {
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "esp-btn-annuler";
        bouton.textContent = "Annuler";
        bouton.addEventListener("click", () => appliquer(retirerWidget(masques, l.id, MESSAGES_ESPACE.annulee)));
        li.appendChild(bouton);
      }
      liste.appendChild(li);
    });
    vide.hidden = lignes.length > 0;
    if (message !== undefined) ecrireEtat(message, annuler);
  }
  function appliquer(resultat, annuler) {
    masques = resultat.masques;
    rendre(resultat.message, annuler);
  }

  // Prepare une phrase dans la barre d'instruction, curseur au bout, barre ramenee a l'ecran (utile sur mobile).
  function preparerPhrase(phrase) {
    champ.value = phrase;
    champ.focus({ preventScroll: true });
    champ.setSelectionRange(phrase.length, phrase.length);
    const reduit = fenetre.matchMedia && fenetre.matchMedia("(prefers-reduced-motion: reduce)").matches;
    champ.scrollIntoView({ block: "center", behavior: reduit ? "auto" : "smooth" });
  }

  racine.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]");
    if (action) {
      const conteneurVue = action.closest("[data-vue-id]");
      const widget = action.closest("[data-widget]");
      if (action.dataset.action === "modifier") {
        const nom = conteneurVue ? conteneurVue.querySelector(".esp-vue-nom").textContent : widget.dataset.nom;
        preparerPhrase(phraseModifier(nom, !!conteneurVue));
      } else {
        const id = conteneurVue ? idVue(conteneurVue.dataset.vueId) : widget.dataset.widget;
        appliquer(retirerWidget(masques, id, conteneurVue ? MESSAGES_ESPACE.vueRetiree : MESSAGES_ESPACE.retire), id);
      }
      return;
    }
    if (e.target.closest(".esp-vue-ajout")) { preparerPhrase(TEXTES_ESPACE.ajoutVuePhrase); return; }
    const puce = e.target.closest(".esp-puce");
    if (puce) { champ.value = puce.textContent; champ.focus(); return; }
    const lien = e.target.closest("[data-vue]");
    if (lien) {
      e.preventDefault();
      aller(lien.dataset.vue);
    }
  });
  racine.querySelector(".esp-instruction-ligne").addEventListener("submit", (e) => {
    e.preventDefault();
    const resultat = appliquerInstruction(WIDGETS, masques, champ.value);
    appliquer(resultat);
    if (resultat.vider) champ.value = "";
  });
  micro.addEventListener("click", () => {
    const on = micro.classList.toggle("esp-ecoute");
    micro.setAttribute("aria-pressed", on ? "true" : "false");
    ecrireEtat(on ? MESSAGES_ESPACE.ecoute : "");
  });

  rendre();

  return {
    // Appelee a chaque changement de vue : la page s'ouvre toujours en haut.
    surVueActivee(vue) {
      if (vue === VUE_ESPACE && conteneur) conteneur.scrollTop = 0;
    }
  };
}
