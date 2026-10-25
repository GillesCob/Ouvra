// Discussions par commande IA (24/10) : le panneau du rapport, une modale lisible sur ordinateur et sur mobile.
//
// Il affiche le rapport verifie par le moteur (conclureRapport, src/discussionsIAMoteur.js) :
//  - un titre, le nombre de messages analyses, et une mention rappelant que le rapport ne reprend que les messages fournis ;
//  - des sections, des points ; un point que l'IA n'a pas pu confirmer porte la mention « non confirmé » ;
//  - sous CHAQUE point, ses sources (auteur, date et heure, discussion) : un clic ferme le panneau et ouvre le message dans sa discussion ;
//  - la chronologie des messages cites, avec l'extrait ;
//  - « Copier » (texte brut, sources entre parentheses) et « Fermer ».
// Tout texte venant des messages ou du modele passe par textContent : aucun HTML n'est jamais injecte.
// Accessibilite : role « dialog » modal, nom = le titre du rapport, focus sur « Fermer » a l'ouverture, tabulation gardee dans le panneau, Echap ferme,
// le focus revient la ou il etait.
//
// Module sans dependance a main.js : surSource(mk) ouvre le message (apres la fermeture du panneau) ; texteRapport(rapport) : version texte a copier.

import "./reglesIA.css";
import "./discussionsIA.css";

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerRapportVue({ surSource, texteRapport }) {
  let fond = null;
  let carte = null;
  let corps = null;
  let titre = null;
  let compte = null;
  let boutonCopier = null;
  let boutonFermer = null;
  let rapportCourant = null;
  let focusAvant = null;

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
    titre = creer("h2", "disc-rapport-titre");
    titre.id = "discRapportTitre";
    compte = creer("p", "disc-rapport-compte");
    compte.id = "discRapportCompte";
    entete.append(titre, compte);
    corps = creer("div", "disc-rapport-corps");
    const pied = creer("div", "disc-rapport-pied");
    boutonCopier = creer("button", "disc-rapport-btn", "Copier");
    boutonCopier.type = "button";
    boutonFermer = creer("button", "disc-rapport-btn disc-rapport-fermer", "Fermer");
    boutonFermer.type = "button";
    pied.append(boutonCopier, boutonFermer);
    carte.append(entete, corps, pied);
    fond.appendChild(carte);
    document.body.appendChild(fond);

    fond.addEventListener("click", (e) => { if (e.target === fond) fermer(true); });
    boutonFermer.addEventListener("click", () => fermer(true));
    boutonCopier.addEventListener("click", copier);
    corps.addEventListener("click", (e) => {
      const source = e.target.closest("[data-mk]");
      if (!source) return;
      const mk = source.dataset.mk;
      fermer(false);
      surSource(mk);
    });
    document.addEventListener("keydown", (e) => {
      if (fond.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(true); return; }
      if (e.key === "Tab") boucleFocus(e);
    }, true);
  }

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

  function rendreSection(section) {
    const bloc = creer("section", "disc-rapport-section");
    bloc.appendChild(creer("h3", null, section.titre));
    const ul = creer("ul", "disc-rapport-points");
    for (const p of section.points) {
      const li = creer("li", "disc-rapport-point");
      const phrase = creer("p", "disc-rapport-phrase", p.texte);
      if (!p.confirme) phrase.appendChild(creer("span", "disc-rapport-incertain", " non confirmé"));
      const sources = creer("div", "disc-rapport-sources");
      p.sources.forEach((s) => sources.appendChild(boutonSource(s)));
      li.append(phrase, sources);
      ul.appendChild(li);
    }
    bloc.appendChild(ul);
    return bloc;
  }

  function rendreChronologie(chronologie) {
    const bloc = creer("section", "disc-rapport-section disc-rapport-chrono");
    bloc.appendChild(creer("h3", null, "Chronologie des sources"));
    const ul = creer("ul", "disc-rapport-points");
    for (const s of chronologie) {
      const li = creer("li", "disc-rapport-point");
      const b = boutonSource(s);
      const extrait = creer("p", "disc-rapport-extrait", s.extrait.texte);
      li.append(b, extrait);
      ul.appendChild(li);
    }
    bloc.appendChild(ul);
    return bloc;
  }

  function ouvrir(rapport) {
    assurerSquelette();
    rapportCourant = rapport;
    titre.textContent = rapport.titre;
    compte.textContent = rapport.vide
      ? rapport.analyses + " message" + (rapport.analyses > 1 ? "s" : "") + " examiné" + (rapport.analyses > 1 ? "s" : "") + "."
      : rapport.analyses + " messages analysés. Ce rapport ne reprend que ce que disent ces messages ; chaque point renvoie à ses sources.";
    corps.textContent = "";
    if (rapport.vide) {
      corps.appendChild(creer("p", "disc-rapport-rien", rapport.message));
    } else {
      rapport.sections.forEach((s) => corps.appendChild(rendreSection(s)));
      corps.appendChild(rendreChronologie(rapport.chronologie));
    }
    boutonCopier.textContent = "Copier";
    focusAvant = document.activeElement;
    fond.hidden = false;
    corps.scrollTop = 0;
    boutonFermer.focus({ preventScroll: true });
  }

  function fermer(rendreFocus) {
    if (!fond || fond.hidden) return;
    fond.hidden = true;
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

  return { ouvrir, fermer: () => fermer(false), ouvert: () => !!fond && !fond.hidden };
}
