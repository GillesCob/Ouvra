// Rendu HTML de la page « Mon espace » (02/11) : fonctions pures (sans DOM, testables sous Node). Reproduit le HTML du mockup ouvra-mon-espace.html,
// classes prefixees esp- (voir src/monEspace.css). Toutes les valeurs passent par echapper().
import { WIDGETS, SUGGESTIONS, TEXTES_ESPACE } from "./monEspaceDonnees.js";
import { htmlVignette } from "./monEspaceVignettes.js";

export const echapper = (texte) => String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const SVG_TRAIT = (contenu) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenu}</svg>`;
export const ICONE_STYLO = SVG_TRAIT('<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>');
export const ICONE_CROIX = SVG_TRAIT('<path d="M6 6l12 12M18 6L6 18"/>');
export const ICONE_MICRO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

// Deux boutons ronds (stylo = modifier, croix = supprimer) : zone tactile de 44 px, rond visible de 32 px (28 px sur une vue). Le stylo ecrit dans la barre d'instruction, la croix retire.
export function htmlActions(nom, compact = false) {
  const bouton = (action, libelle, icone) => `<button type="button" class="esp-rond" data-action="${action}" aria-label="${libelle} ${echapper(nom)}"><span class="esp-rond-vis">${icone}</span></button>`;
  return `<div class="esp-actions${compact ? " esp-actions-vue" : ""}">${bouton("modifier", "Modifier", ICONE_STYLO)}${bouton("supprimer", "Supprimer", ICONE_CROIX)}</div>`;
}

const initiale = (nom) => String(nom).trim().charAt(0).toUpperCase();

const CORPS = {
  vues: (items) => `<ul class="esp-vues">${items.map((v) => `<li class="esp-vue-item" data-vue-id="${echapper(v.id)}">`
    + `<button type="button" class="esp-vue" data-vue="viewer">${htmlVignette(v.vignette)}<span class="esp-vue-nom">${echapper(v.libelle)}</span>`
    + `<span class="esp-vue-instr"><span class="esp-vue-etiquette">Instruction du Viewer</span><span class="esp-vue-phrase">« ${echapper(v.instruction)} »</span></span>`
    + `<span class="esp-vue-cadrage">Cadrage enregistré</span></button>${htmlActions(v.libelle, true)}</li>`).join("")}`
    + `<li><button type="button" class="esp-vue-ajout"><span class="esp-vue-plus" aria-hidden="true">+</span>${echapper(TEXTES_ESPACE.ajoutVue)}</button></li></ul>`,
  alertes: (items) => `<ul class="esp-liste">${items.map((a) => `<li><span class="esp-heure">${echapper(a.heure)}</span><div class="esp-corps"><p>${echapper(a.texte)}</p></div><button type="button" class="esp-btn-voir">Voir</button></li>`).join("")}</ul>`,
  todo: (items) => `<ul class="esp-taches">${items.map((t) => `<li class="esp-tache"><span class="esp-etat" aria-hidden="true"></span><div class="esp-tache-corps"><p class="esp-tache-titre">${echapper(t.titre)}</p>`
    + `<p class="esp-tache-contexte"><span class="esp-initiale" aria-hidden="true">${echapper(initiale(t.par))}</span><span>Demandé par ${echapper(t.par)}</span>`
    + `<button type="button" class="esp-source" data-vue="discussions">${echapper(t.discussion)}</button><span class="esp-tache-heure">${echapper(t.heure)}</span></p></div>`
    + `<span class="esp-urgence">${echapper(t.urgence)}</span></li>`).join("")}</ul>`,
  documents: (items) => `<ul class="esp-liste">${items.map((d) => `<li><div class="esp-corps"><p>${echapper(d.texte)}</p></div><span class="esp-heure esp-heure-large">${echapper(d.quand)}</span></li>`).join("")}</ul>`,
  compteurs: (items) => `<ul class="esp-compteurs">${items.map((c) => `<li${c.urgent ? ' class="esp-urgent"' : ""}><strong>${echapper(c.valeur)}</strong><span>${echapper(c.libelle)}</span></li>`).join("")}</ul>`
};

export function htmlWidget(widget, rang) {
  const corps = CORPS[widget.type];
  if (!corps) throw new Error(`Type de widget inconnu : ${widget.type}`);
  const titre = widget.type === "todo"
    ? `<div class="esp-todo-entete"><h2>${echapper(widget.titre)}</h2><span class="esp-compteur">${widget.items.length} à traiter</span></div>`
    : `<h2>${echapper(widget.titre)}</h2>`;
  const repere = widget.repereIA ? `<p class="esp-repere-ia">${echapper(widget.repereIA)}</p>` : "";
  return `<section class="esp-widget esp-w-${echapper(widget.zone)}" style="--i:${rang}" data-widget="${echapper(widget.id)}" data-phrase="${echapper(widget.phrase)}" data-nom="${echapper(widget.titre)}">`
    + `${htmlActions(widget.titre)}<div class="esp-widget-tete">${titre}${repere}</div>${corps(widget.items)}</section>`;
}

export function htmlPageEspace(widgets = WIDGETS, suggestions = SUGGESTIONS, textes = TEXTES_ESPACE) {
  return '<main class="esp-page">'
    + `<nav class="esp-fil" aria-label="Fil d'Ariane"><a href="#idees" data-vue="idees">${echapper(textes.filIdees)}</a> › <span aria-current="page">${echapper(textes.filCourant)}</span></nav>`
    + `<h1 class="esp-titre">${echapper(textes.titre)}</h1>`
    + `<p class="esp-sous-titre">${echapper(textes.sousTitre)}</p>`
    + '<section class="esp-instruction" aria-label="Instruction">'
    + '<form class="esp-instruction-ligne" autocomplete="off">'
    + `<button type="button" class="esp-micro" aria-label="Dicter une instruction" aria-pressed="false">${ICONE_MICRO}</button>`
    + `<input class="esp-champ" type="text" placeholder="${echapper(textes.placeholder)}" aria-label="${echapper(textes.placeholder)}">`
    + '<button type="submit" class="esp-btn-principal">Valider</button>'
    + "</form>"
    + `<ul class="esp-puces" aria-label="Suggestions">${suggestions.map((s) => `<li><button type="button" class="esp-puce">${echapper(s)}</button></li>`).join("")}</ul>`
    + '<p class="esp-etat-saisie" role="status" aria-live="polite"></p>'
    + "</section>"
    + `<div class="esp-grille">${widgets.map(htmlWidget).join("")}</div>`
    + `<details class="esp-journal"><summary>${echapper(textes.journal)}</summary><ol class="esp-journal-liste"></ol><p class="esp-vide" hidden>${echapper(textes.journalVide)}</p></details>`
    + "</main>";
}
