// Rendu HTML de la page « Mon espace » (02/11) : fonctions pures (sans DOM, testables sous Node). Reproduit le HTML du mockup ouvra-mon-espace.html,
// classes prefixees esp- (voir src/monEspace.css). Toutes les valeurs passent par echapper().
import { WIDGETS, SUGGESTIONS, TEXTES_ESPACE } from "./monEspaceDonnees.js";
import { HOSPITAL_CLASHES } from "./clashesHospital.js";
import { decrireCarteCollision, htmlPrioriteCollision, LIBELLES_STATUT_COLLISION, LIBELLES_PRIORITE_COLLISION } from "./collisionCarte.js";

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

// Carte d'une collision : meme contenu et memes classes que buildCollisionCard (main.js), donc le meme style (style.css) : pastille du numero, types en francais,
// identifiants et niveau, point de statut, filet de couleur = priorite. Le libelle du statut et la priorite sont ecrits en toutes lettres (pas de survol sur mobile).
export function htmlCarteCollision(clash, clashes = HOSPITAL_CLASHES) {
  const infos = decrireCarteCollision(clash.zone);
  if (!infos) throw new Error(`Collision sans deux identifiants : ${clash.id}`);
  const numero = clashes.indexOf(clash) + 1;
  const statut = LIBELLES_STATUT_COLLISION[clash.statut] || clash.statut;
  const prio = LIBELLES_PRIORITE_COLLISION[clash.priorite] ? clash.priorite : "normale";
  return `<span class="collision-item collision-item-carte ${echapper(clash.statut)} prio-${prio}">`
    + `<span class="collision-num-badge" aria-hidden="true">${numero}</span>`
    + `<span class="collision-card-text"><span class="collision-types">${echapper(infos.titre)}</span><span class="collision-sub">${echapper(infos.sousTitre)}</span></span>`
    + `<span class="collision-statut"><span class="collision-statut-dot ${echapper(clash.statut)}"></span><span class="collision-statut-label">${echapper(statut)}</span>`
    + `${htmlPrioriteCollision(prio)}</span></span>`;
}

const clashParId = (id, clashes = HOSPITAL_CLASHES) => clashes.find((c) => c.id === id) || null;
export const urlMiniature = (clashId) => `/images/vues/${clashId}.jpg`;
export const nomVue = (clash, clashes = HOSPITAL_CLASHES) => "Collision n° " + (clashes.indexOf(clash) + 1);

function htmlVue(v) {
  const clash = clashParId(v.clashId);
  if (!clash) throw new Error(`Collision inconnue : ${v.clashId}`);
  const nom = nomVue(clash);
  return `<li class="esp-vue-item" data-vue-id="${echapper(v.id)}" data-nom="${echapper(nom)}">`
    + `<button type="button" class="esp-vue" data-cible="${echapper(v.id)}" aria-label="Ouvrir ${echapper(nom.toLowerCase())} sur la page Collision">`
    + `<span class="esp-vue-image"><img src="${echapper(urlMiniature(v.clashId))}" alt="" width="640" height="400" loading="lazy" decoding="async"></span>`
    + `${htmlCarteCollision(clash)}</button>${htmlActions(nom, true)}</li>`;
}

// Bouton « Voir » (alertes et documents) : seulement quand la ligne a une cible reelle (collision, discussion) ; une mise a jour de maquette n'en a pas.
const htmlBoutonVoir = (item, libelle) => (item.cible ? `<button type="button" class="esp-btn-voir" data-cible="${echapper(item.id)}" aria-label="Voir : ${echapper(libelle)}">Voir</button>` : "");
const htmlAlerte = (a) => `<li><span class="esp-heure">${echapper(a.heure)}</span><div class="esp-corps"><p>${echapper(a.texte)}</p></div>${htmlBoutonVoir(a, a.texte)}</li>`;
const htmlDocument = (d) => `<li><div class="esp-corps"><p>${echapper(d.texte)}</p>${d.meta ? `<p class="esp-meta">${echapper(d.meta)}</p>` : ""}</div>`
  + `<span class="esp-heure esp-heure-large">${echapper(d.quand)}</span>${htmlBoutonVoir(d, d.texte)}</li>`;

// Une echeance = son titre et le lien vers la conversation d'origine (meme puce que la todo), rien d'autre.
const htmlEcheance = (e) => `<li class="esp-echeance"><p class="esp-ech-titre">${echapper(e.titre)}</p>`
  + `<button type="button" class="esp-source" data-cible="${echapper(e.id)}">${echapper(e.discussion)}</button></li>`;

const CORPS = {
  vues: (items) => `<ul class="esp-vues">${items.map(htmlVue).join("")}</ul>`,
  alertes: (items) => `<ul class="esp-liste">${items.map(htmlAlerte).join("")}</ul>`,
  todo: (items) => `<ul class="esp-taches">${items.map((t) => `<li class="esp-tache"><span class="esp-etat" aria-hidden="true"></span><div class="esp-tache-corps"><p class="esp-tache-titre">${echapper(t.titre)}</p>`
    + `<p class="esp-tache-contexte"><span class="esp-initiale" aria-hidden="true">${echapper(initiale(t.par))}</span><span>Demandé par ${echapper(t.par)}</span>`
    + `<button type="button" class="esp-source" data-cible="${echapper(t.id)}">${echapper(t.discussion)}</button><span class="esp-tache-heure">${echapper(t.heure)}</span></p>`
    + (t.citation ? `<p class="esp-tache-citation">« ${echapper(t.citation)} »</p>` : "") + "</div>"
    + `<span class="esp-urgence">${echapper(t.urgence)}</span></li>`).join("")}</ul>`,
  echeances: (items) => `<ol class="esp-echeances">${items.map(htmlEcheance).join("")}</ol>`,
  documents: (items) => `<ul class="esp-liste">${items.map(htmlDocument).join("")}</ul>`,
  // Chaque compteur est un bouton : il ouvre la page Collision filtree sur ces collisions.
  compteurs: (items) => `<ul class="esp-compteurs">${items.map((c) => `<li${c.urgent ? ' class="esp-urgent"' : ""}><button type="button" class="esp-compteur-bouton" data-cible="${echapper(c.id)}" aria-label="Voir les collisions : ${echapper(c.valeur)} ${echapper(c.libelle.toLowerCase())}">`
    + `<strong>${echapper(c.valeur)}</strong><span>${echapper(c.libelle)}</span></button></li>`).join("")}</ul>`
};

export function htmlWidget(widget, rang) {
  const corps = CORPS[widget.type];
  if (!corps) throw new Error(`Type de widget inconnu : ${widget.type}`);
  // « Mes points de vue » n'affiche aucun titre : seules les collisions sont visibles, le nom reste porte par la section (lecteurs d'ecran) et par les boutons stylo et croix.
  const titre = widget.type === "todo"
    ? `<div class="esp-todo-entete"><h2>${echapper(widget.titre)}</h2><span class="esp-compteur">${widget.items.length} à traiter</span></div>`
    : widget.type === "vues" ? "" : `<h2>${echapper(widget.titre)}</h2>`;
  const nomAccessible = widget.type === "vues" ? ` aria-label="${echapper(widget.titre)}"` : "";
  const repere = widget.repereIA ? `<p class="esp-repere-ia">${echapper(widget.repereIA)}</p>` : "";
  return `<section class="esp-widget esp-w-${echapper(widget.zone)}" style="--i:${rang}" data-widget="${echapper(widget.id)}" data-phrase="${echapper(widget.phrase)}" data-nom="${echapper(widget.titre)}"${nomAccessible}>`
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
    + `<div class="esp-grille">${widgets.map((w, i) => htmlWidget(w, i)).join("")}</div>`
    + `<details class="esp-journal"><summary>${echapper(textes.journal)}</summary><ol class="esp-journal-liste"></ol><p class="esp-vide" hidden>${echapper(textes.journalVide)}</p></details>`
    + "</main>";
}
