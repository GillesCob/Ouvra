// Rendu HTML de la page « Mon espace » (02/11) : fonctions pures (sans DOM, testables sous Node). Reproduit le HTML du mockup ouvra-mon-espace.html,
// classes prefixees esp- (voir src/monEspace.css). Toutes les valeurs passent par echapper().
import { WIDGETS, SUGGESTIONS, TEXTES_ESPACE } from "./monEspaceDonnees.js";

export const echapper = (texte) => String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const SVG_TRAIT = (contenu) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenu}</svg>`;
export const ICONE_STYLO = SVG_TRAIT('<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>');
export const ICONE_CROIX = SVG_TRAIT('<path d="M6 6l12 12M18 6L6 18"/>');
export const ICONE_MICRO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

// Deux boutons ronds (stylo = modifier, croix = supprimer) : zone tactile de 44 px, rond visible de 32 px (28 px sur une vue). La croix retire ; le stylo, qui
// preparait une phrase dans la barre d'instruction, est fige (page de demonstration : la barre est desactivee), sans data-action donc sans effet possible.
export function htmlActions(nom, compact = false) {
  const bouton = (action, libelle, icone) => `<button type="button" class="esp-rond" data-action="${action}" aria-label="${libelle} ${echapper(nom)}"><span class="esp-rond-vis">${icone}</span></button>`;
  const stylo = `<button type="button" class="esp-rond" disabled aria-disabled="true" aria-label="Modifier ${echapper(nom)}"><span class="esp-rond-vis">${ICONE_STYLO}</span></button>`;
  return `<div class="esp-actions${compact ? " esp-actions-vue" : ""}">${stylo}${bouton("supprimer", "Supprimer", ICONE_CROIX)}</div>`;
}

const initiale = (nom) => String(nom).trim().charAt(0).toUpperCase();

function htmlVue(v) {
  return `<li class="esp-vue-item" data-vue-id="${echapper(v.id)}" data-nom="${echapper(v.titre)}">`
    + `<button type="button" class="esp-vue" data-cible="${echapper(v.id)}" aria-label="Ouvrir le point de vue ${echapper(v.titre)}">`
    + `<span class="esp-vue-image"><img src="${echapper(v.miniature)}" alt="" width="640" height="400" loading="lazy" decoding="async"></span>`
    + `<span class="esp-vue-titre">${echapper(v.titre)}</span></button>${htmlActions(v.titre, true)}</li>`;
}

// Bouton « Voir » (alertes) : affiche quand la ligne a une cible (collision, discussion), mais fige (page de demonstration) : desactive, sans data-cible,
// donc rien ne peut l'atteindre ; une mise a jour de maquette n'en a pas.
const htmlBoutonVoir = (item, libelle) => (item.cible ? `<button type="button" class="esp-btn-voir" disabled aria-disabled="true" aria-label="Voir : ${echapper(libelle)}">Voir</button>` : "");
const htmlAlerte = (a) => `<li><span class="esp-heure">${echapper(a.heure)}</span><div class="esp-corps"><p>${echapper(a.texte)}</p></div>${htmlBoutonVoir(a, a.texte)}</li>`;

// Une echeance = son titre et le lien vers la conversation d'origine (meme puce que la todo), rien d'autre.
const htmlEcheance = (e) => `<li class="esp-echeance"><p class="esp-ech-titre">${echapper(e.titre)}</p>`
  + `<button type="button" class="esp-source" data-cible="${echapper(e.id)}">${echapper(e.discussion)}</button></li>`;

// effectifs : { <identifiant de filtre>: nombre } fourni par la page (collisions suivies) ; un compteur sans effectif connu affiche 0.
export const htmlCompteurs = (items, effectifs = {}) => {
  const valeur = (c) => effectifs[c.cible.filtre] ?? 0;
  return `<ul class="esp-compteurs">${items.map((c) => `<li${c.urgent ? ' class="esp-urgent"' : ""}><button type="button" class="esp-compteur-bouton" data-cible="${echapper(c.id)}" aria-label="Voir les collisions suivies : ${echapper(valeur(c))} ${echapper(c.libelle.toLowerCase())}">`
    + `<strong>${echapper(valeur(c))}</strong><span>${echapper(c.libelle)}</span></button></li>`).join("")}</ul>`;
};

const CORPS = {
  vues: (items) => `<ul class="esp-vues">${items.map(htmlVue).join("")}`
    + `<li><button type="button" class="esp-vue-ajout"><span class="esp-vue-plus" aria-hidden="true">+</span>${echapper(TEXTES_ESPACE.ajoutVue)}</button></li></ul>`,
  alertes: (items) => `<ul class="esp-liste">${items.map(htmlAlerte).join("")}</ul>`,
  todo: (items) => `<ul class="esp-taches">${items.map((t) => `<li class="esp-tache"><span class="esp-etat" aria-hidden="true"></span><div class="esp-tache-corps"><p class="esp-tache-titre">${echapper(t.titre)}</p>`
    + `<p class="esp-tache-contexte"><span class="esp-initiale" aria-hidden="true">${echapper(initiale(t.par))}</span><span>Demandé par ${echapper(t.par)}</span>`
    + `<button type="button" class="esp-source" data-cible="${echapper(t.id)}">${echapper(t.discussion)}</button><span class="esp-tache-heure">${echapper(t.heure)}</span></p>`
    + (t.citation ? `<p class="esp-tache-citation">« ${echapper(t.citation)} »</p>` : "") + "</div>"
    + `<span class="esp-urgence">${echapper(t.urgence)}</span></li>`).join("")}</ul>`,
  echeances: (items) => `<ol class="esp-echeances">${items.map(htmlEcheance).join("")}</ol>`,
  // Chaque compteur est un bouton : il ouvre la page Collision filtree sur ces collisions.
  compteurs: (items, effectifs) => htmlCompteurs(items, effectifs)
};

export function htmlWidget(widget, rang, effectifs) {
  const corps = CORPS[widget.type];
  if (!corps) throw new Error(`Type de widget inconnu : ${widget.type}`);
  const titre = widget.type === "todo"
    ? `<div class="esp-todo-entete"><h2>${echapper(widget.titre)}</h2><span class="esp-compteur">${widget.items.length} à traiter</span></div>`
    : `<h2>${echapper(widget.titre)}</h2>`;
  const repere = widget.repereIA ? `<p class="esp-repere-ia">${echapper(widget.repereIA)}</p>` : "";
  return `<section class="esp-widget esp-w-${echapper(widget.zone)}" style="--i:${rang}" data-widget="${echapper(widget.id)}" data-phrase="${echapper(widget.phrase)}" data-nom="${echapper(widget.titre)}">`
    + `${htmlActions(widget.titre)}<div class="esp-widget-tete">${titre}${repere}</div>${corps(widget.items, effectifs)}</section>`;
}

export function htmlPageEspace(widgets = WIDGETS, suggestions = SUGGESTIONS, textes = TEXTES_ESPACE, effectifs = {}) {
  return '<main class="esp-page">'
    + `<nav class="esp-fil" aria-label="Fil d'Ariane"><a href="#idees" data-vue="idees">${echapper(textes.filIdees)}</a> › <span aria-current="page">${echapper(textes.filCourant)}</span></nav>`
    + `<h1 class="esp-titre">${echapper(textes.titre)}</h1>`
    + `<p class="esp-sous-titre">${echapper(textes.sousTitre)}</p>`
    + '<section class="esp-instruction" aria-label="Instruction">'
    // Barre d'instruction affichee mais figee (page de demonstration, aucun appel IA possible) : tout est desactive, ni formulaire ni handler.
    + '<div class="esp-instruction-ligne" role="group" aria-label="Instruction">'
    + `<button type="button" class="esp-micro" disabled aria-disabled="true" aria-label="Dicter une instruction">${ICONE_MICRO}</button>`
    + `<input class="esp-champ" type="text" disabled aria-disabled="true" placeholder="${echapper(textes.placeholder)}" aria-label="${echapper(textes.placeholder)}">`
    + '<button type="button" class="esp-btn-principal" disabled aria-disabled="true">Valider</button>'
    + "</div>"
    + `<ul class="esp-puces" aria-label="Suggestions">${suggestions.map((s) => `<li><button type="button" class="esp-puce" disabled aria-disabled="true">${echapper(s)}</button></li>`).join("")}</ul>`
    + '<p class="esp-etat-saisie" role="status" aria-live="polite"></p>'
    + "</section>"
    + `<div class="esp-grille">${widgets.map((w, i) => htmlWidget(w, i, effectifs)).join("")}</div>`
    + "</main>";
}
