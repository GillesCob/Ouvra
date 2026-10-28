// Discussions par commande IA (24/10, refait le 26/10) : la fenetre du recapitulatif, un MINI RAPPORT PARTAGEABLE lisible sur ordinateur et sur mobile.
//
// Il affiche le rapport verifie par le moteur (conclureRapport, src/discussionsIAMoteur.js) au FORMAT FIXE, toujours dans cet ordre :
//  1. titre (avec le logo Ouvra, « Rapport du JJ/MM/AAAA » et le perimetre : messages analyses, discussions, periode) ;
//  2. contexte ; 3. intervenants ; 4. desaccords exprimes ; 5. decision finale (« Aucune décision prise » quand rien n'est decide, jamais inventee) ;
//  puis les sources : chaque bloc a ses boutons de source (auteur, date, discussion) : un clic ferme la fenetre et ouvre le message dans sa discussion.
// Un bloc que l'IA n'a pas pu confirmer porte la mention « non confirmé ».
// Boutons : « Copier » (texte brut, meme ordre), « Exporter en PDF » (PDF A4 genere dans le navigateur, bibliotheques chargees au clic), « Fermer ».
// Tout texte venant des messages ou du modele passe par textContent : aucun HTML n'est jamais injecte.
// Accessibilite : role « dialog » modal, nom = le titre du rapport, focus sur « Fermer » a l'ouverture, tabulation gardee dans le panneau, Echap ferme,
// le focus revient la ou il etait.
//
// Module sans dependance a main.js : surSource(mk, rapport) ouvre le message (apres la fermeture du panneau) ; texteRapport(rapport) : version texte a copier ;
// exporterPdf(rapport, onglet) : ouvre le PDF dans l'onglet donne, sinon le telecharge (promesse de "ouvert" | "telecharge").

import "./reglesIA.css";
import "./discussionsIA.css";
import { dateDuRapport, perimetreDe, libelleDecision, nomsEnPhrase, MESSAGE_AUCUN_DESACCORD, MESSAGE_CONTEXTE_ABSENT, MENTION_NON_CONFIRME } from "./discussionsIARapportFormat.js";
import { preparerOngletPdf } from "./discussionsIARapportOnglet.js";
import { defilementVersTitre, CLASSE_VERROU } from "./discussionsIARapportDefilement.js";
import { verrouillerArrierePlan } from "./verrouDefilement.js";

export const LOGO_RAPPORT = "/images/ouvra-logo.svg";
const MOBILE = "(max-width: 768px)";
export const NOM_DEPLIANTS_PAGE = "ouvra-depliants"; // un seul name pour tous les <details> de la page (regle : ouvrir un menu deroulant ferme les autres)

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerRapportVue({ surSource, texteRapport, exporterPdf }) {
  let fond = null;
  let carte = null;
  let corps = null;
  let titre = null;
  let compte = null;
  let boutonCopier = null;
  let boutonPdf = null;
  let dateEl = null;
  let modeleEl = null;
  let boutonFermer = null;
  let rapportCourant = null;
  let focusAvant = null;
  let verrou = null;
  let planDefilement = 0; // requestAnimationFrame du defilement vers le titre du menu ouvert

  function assurerSquelette() {
    if (fond) return;
    fond = creer("div", "regles-ia-fond disc-rapport-fond");
    fond.hidden = true;
    carte = creer("div", "regles-ia-carte disc-rapport-carte");
    carte.setAttribute("role", "dialog");
    carte.setAttribute("aria-modal", "true");
    carte.setAttribute("aria-labelledby", "discRapportTitre");
    carte.setAttribute("aria-describedby", "discRapportCompte");
    const entete = creer("div", "disc-rapport-entete");
    entete.dataset.bloc = "titre";
    const marque = creer("div", "disc-rapport-marque");
    const logo = creer("img", "disc-rapport-logo");
    logo.src = LOGO_RAPPORT;
    logo.alt = "Ouvra";
    logo.width = 72;
    logo.height = 53;
    dateEl = creer("p", "disc-rapport-date");
    marque.append(logo, dateEl);
    titre = creer("h2", "disc-rapport-titre");
    titre.id = "discRapportTitre";
    compte = creer("p", "disc-rapport-compte");
    compte.id = "discRapportCompte";
    modeleEl = creer("p", "disc-rapport-modele", "Modèle de rapport");
    modeleEl.hidden = true;
    entete.append(marque, titre, compte, modeleEl);
    corps = creer("div", "disc-rapport-corps");
    const pied = creer("div", "disc-rapport-pied");
    boutonCopier = creer("button", "disc-rapport-btn", "Copier");
    boutonCopier.type = "button";
    boutonPdf = creer("button", "disc-rapport-btn", "Exporter en PDF");
    boutonPdf.type = "button";
    boutonFermer = creer("button", "disc-rapport-btn disc-rapport-fermer btn-principal", "Fermer");
    boutonFermer.type = "button";
    pied.append(boutonCopier, boutonPdf, boutonFermer);
    carte.append(entete, corps, pied);
    fond.appendChild(carte);
    document.body.appendChild(fond);

    fond.addEventListener("click", (e) => { if (e.target === fond) fermer(true); });
    boutonFermer.addEventListener("click", () => fermer(true));
    boutonCopier.addEventListener("click", copier);
    boutonPdf.addEventListener("click", exporter);
    corps.addEventListener("click", (e) => {
      const source = e.target.closest("[data-mk]");
      if (!source) return;
      const mk = source.dataset.mk;
      fermer(false);
      surSource(mk, rapportCourant); // le rapport en cours : « Retour au rapport » le rouvre tel quel
    });
    // Menus deroulants : a l'ouverture (les autres se referment par `name`), le titre du menu monte en haut de la zone visible, contenu deplie dessous
    // (cf discussionsIARapportDefilement.js). Differe d'une image : le repli des autres menus est applique avant la mesure.
    corps.addEventListener("toggle", (e) => {
      if (!e.target.matches(".disc-rapport-depliant")) return;
      cancelAnimationFrame(planDefilement);
      planDefilement = requestAnimationFrame(() => defilerVersMenuOuvert());
    }, true);
    verrou = verrouillerArrierePlan(fond, zoneDefilante, CLASSE_VERROU);
    document.addEventListener("keydown", (e) => {
      if (fond.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(true); return; }
      if (e.key === "Tab") boucleFocus(e);
    }, true);
  }

  // Amene le titre du menu ouvert en haut de la zone visible ; sans menu ouvert, retire le rembourrage ajoute pour permettre ce defilement.
  function defilerVersMenuOuvert() {
    const zone = zoneDefilante();
    corps.style.removeProperty("padding-bottom");
    const menu = corps.querySelector(".disc-rapport-depliant[open]");
    if (!menu) return;
    const style = getComputedStyle(zone);
    const zoneHaut = zone.getBoundingClientRect().top + (parseFloat(style.paddingTop) || 0); // mobile : sous la zone de l'encoche
    const { top, rembourrage } = defilementVersTitre({ haut: menu.querySelector("summary").getBoundingClientRect().top, zoneHaut, scrollTop: zone.scrollTop, scrollMax: zone.scrollHeight - zone.clientHeight });
    if (rembourrage) corps.style.paddingBottom = `${rembourrage}px`;
    const reduit = globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    zone.scrollTo({ top, behavior: reduit ? "auto" : "smooth" });
  }

  // L'element qui defile : toute la carte sur mobile (page pleine ecran), le corps seul sur grand ecran.
  const zoneDefilante = () => (globalThis.matchMedia && globalThis.matchMedia(MOBILE).matches ? carte : corps);

  function boucleFocus(e) {
    const cibles = [...carte.querySelectorAll("button")].filter((el) => !el.disabled);
    if (!cibles.length) return;
    const premier = cibles[0];
    const dernier = cibles[cibles.length - 1];
    if (e.shiftKey && (document.activeElement === premier || !carte.contains(document.activeElement))) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }

  // Bouton d'une source : « Claire Martin, 20/10 à 14:32 », la discussion en petit. Un clic ouvre le message.
  function boutonSource(s) {
    const b = creer("button", "disc-rapport-source");
    b.type = "button";
    b.dataset.mk = s.mk;
    b.setAttribute("aria-label", "Ouvrir le message de " + s.auteurNom + " du " + s.quandLibelle + " dans la discussion " + s.discussion);
    b.append(creer("span", "disc-rapport-source-qui", s.auteurNom + ", " + s.quandLibelle), creer("span", "disc-rapport-source-fil", s.discussion));
    return b;
  }

  const mention = () => creer("span", "disc-rapport-incertain", MENTION_NON_CONFIRME);

  function boutonsSources(sources) {
    const liste = creer("div", "disc-rapport-sources");
    sources.forEach((s) => liste.appendChild(boutonSource(s)));
    return liste;
  }

  // Un bloc du format fixe : un titre de section (h3) et son contenu. data-bloc sert aux tests et a la mesure en navigateur.
  // Sur mobile (28/10), les blocs secondaires (depliant = true : intervenants, sources) sont des menus deroulants, fermes au depart, pour que l'essentiel
  // (contexte, desaccords, decision) soit visible sans defiler. Un seul `name` partage par tous les <details> de la page : en ouvrir un ferme les autres.
  function bloc(nom, libelle, ...contenu) {
    return construireBloc(nom, libelle, false, contenu);
  }

  function construireBloc(nom, libelle, depliant, contenu) {
    if (depliant && globalThis.matchMedia && globalThis.matchMedia(MOBILE).matches) {
      const el = creer("details", "disc-rapport-bloc disc-rapport-depliant");
      el.name = NOM_DEPLIANTS_PAGE;
      el.dataset.bloc = nom;
      const resume = creer("summary");
      resume.appendChild(creer("h3", null, libelle));
      const corpsDepliant = creer("div", "disc-rapport-depliant-corps");
      contenu.forEach((c) => corpsDepliant.appendChild(c));
      el.append(resume, corpsDepliant);
      return el;
    }
    const el = creer("section", "disc-rapport-bloc");
    el.dataset.bloc = nom;
    el.appendChild(creer("h3", null, libelle));
    contenu.forEach((c) => el.appendChild(c));
    return el;
  }

  function phrase(texte, confirme) {
    const p = creer("p", "disc-rapport-phrase", texte);
    if (!confirme) p.appendChild(mention());
    return p;
  }

  function rendreContexte(rapport) {
    const c = rapport.contexte;
    if (!c.texte) return bloc("contexte", "Contexte", creer("p", "disc-rapport-phrase disc-rapport-muet", MESSAGE_CONTEXTE_ABSENT));
    return bloc("contexte", "Contexte", phrase(c.texte, c.confirme), boutonsSources(c.sources));
  }

  function rendreIntervenants(rapport) {
    const ul = creer("ul", "disc-rapport-intervenants");
    rapport.intervenants.forEach((nom) => ul.appendChild(creer("li", "disc-rapport-intervenant", nom)));
    return construireBloc("intervenants", "Intervenants", true, [rapport.intervenants.length ? ul : creer("p", "disc-rapport-phrase disc-rapport-muet", "Aucun intervenant identifié.")]);
  }

  function rendreDesaccords(rapport) {
    if (!rapport.desaccords.length) return bloc("desaccords", "Désaccords exprimés", creer("p", "disc-rapport-phrase disc-rapport-muet", MESSAGE_AUCUN_DESACCORD));
    const ul = creer("ul", "disc-rapport-points");
    for (const d of rapport.desaccords) {
      const li = creer("li", "disc-rapport-point");
      if (d.opposants.length) li.appendChild(creer("p", "disc-rapport-opposants", nomsEnPhrase(d.opposants)));
      li.append(phrase(d.objet, d.confirme), boutonsSources(d.sources));
      ul.appendChild(li);
    }
    return bloc("desaccords", "Désaccords exprimés", ul);
  }

  function rendreDecision(rapport) {
    const d = rapport.decision;
    const el = bloc("decision", "Décision finale");
    el.classList.add("disc-rapport-decision-" + d.statut);
    const etiquette = creer("p", "disc-rapport-decision-etat", libelleDecision(d));
    el.appendChild(etiquette);
    if (d.statut !== "aucune") {
      el.appendChild(phrase(d.texte, d.statut === "prise" ? d.confirme : true));
      el.appendChild(boutonsSources(d.sources));
    }
    return el;
  }

  function rendreChronologie(rapport) {
    const ul = creer("ul", "disc-rapport-points");
    rapport.chronologie.forEach((s, i) => {
      const li = creer("li", "disc-rapport-point");
      li.append(boutonSource(s), creer("p", "disc-rapport-extrait", (i + 1) + ". " + s.extrait.texte));
      ul.appendChild(li);
    });
    const el = construireBloc("sources", "Sources", true, [ul]);
    el.classList.add("disc-rapport-chrono");
    return el;
  }

  function ouvrir(rapport) {
    assurerSquelette();
    rapportCourant = rapport;
    titre.textContent = rapport.titre;
    dateEl.textContent = dateDuRapport(rapport);
    compte.textContent = perimetreDe(rapport) + (rapport.vide ? "." : ". Ce rapport ne reprend que ce que disent ces messages ; chaque bloc renvoie à ses sources.");
    modeleEl.hidden = !rapport.modele; // « Modèle de rapport » : exemple prepare a l'avance, jamais genere par l'IA
    corps.textContent = "";
    if (rapport.vide) {
      corps.appendChild(creer("p", "disc-rapport-rien", rapport.message));
    } else {
      [rendreContexte, rendreIntervenants, rendreDesaccords, rendreDecision, rendreChronologie].forEach((rendre) => corps.appendChild(rendre(rapport)));
    }
    boutonCopier.textContent = "Copier";
    boutonPdf.textContent = "Exporter en PDF";
    boutonPdf.disabled = !!rapport.vide;
    focusAvant = document.activeElement;
    fond.hidden = false;
    verrou.verrouiller();
    carte.scrollTop = 0;
    corps.scrollTop = 0;
    boutonFermer.focus({ preventScroll: true });
  }

  function fermer(rendreFocus) {
    if (!fond || fond.hidden) return;
    fond.hidden = true;
    verrou.deverrouiller();
    if (rendreFocus && focusAvant && document.contains(focusAvant)) focusAvant.focus({ preventScroll: true });
  }

  async function copier() {
    if (!rapportCourant) return;
    try {
      await navigator.clipboard.writeText(texteRapport(rapportCourant));
      boutonCopier.textContent = "Copié";
    } catch {
      boutonCopier.textContent = "Copie impossible"; // contexte non securise ou autorisation refusee : le rapport reste lisible a l'ecran
    }
  }

  async function exporter() {
    if (!rapportCourant || rapportCourant.vide || boutonPdf.disabled) return;
    boutonPdf.disabled = true;
    boutonPdf.textContent = "Préparation du PDF…";
    // Le PDF s'ouvre dans un nouvel onglet (28/10) : l'onglet est ouvert ICI, dans le geste du clic, avant toute attente (sinon les bloqueurs de pop-up le refusent).
    // Bloque : onglet null, l'export retombe sur le telechargement.
    const onglet = window.open("", "_blank");
    if (onglet) {
      onglet.opener = null; // l'onglet du PDF n'a aucun lien avec la page d'Ouvra
      preparerOngletPdf(onglet); // titre + logo Ouvra dans l'onglet (src/discussionsIARapportOnglet.js)
    }
    try {
      const livre = await exporterPdf(rapportCourant, onglet);
      boutonPdf.textContent = livre === "ouvert" ? "PDF ouvert" : "PDF téléchargé";
    } catch {
      if (onglet && !onglet.closed) onglet.close();
      boutonPdf.textContent = "Export impossible"; // le rapport reste lisible et copiable
    } finally {
      boutonPdf.disabled = false;
    }
  }

  return { ouvrir, fermer: () => fermer(false), ouvert: () => !!fond && !fond.hidden };
}
