// Rendu HTML de la page « Mon espace » (02/11) : fonctions pures (sans DOM, testables sous Node). Reproduit le HTML du mockup ouvra-mon-espace.html,
// classes prefixees esp- (voir src/monEspace.css). Toutes les valeurs passent par echapper().
import { WIDGETS, SUGGESTIONS, TEXTES_ESPACE, PAGES_INSTRUCTION } from "./monEspaceDonnees.js";
import { proximite, pastilleDate } from "./monEspaceLogique.js";
import { HOSPITAL_CLASHES } from "./clashesHospital.js";
import { decrireCarteCollision, LIBELLES_STATUT_COLLISION, LIBELLES_PRIORITE_COLLISION } from "./collisionCarte.js";

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

const LABELS_ECHEANCE = { reunion: "Réunion", modification: "Modification", decision: "Décision" };

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
    + `<span class="esp-vue-prio">Priorité ${echapper(LIBELLES_PRIORITE_COLLISION[prio].toLowerCase())}</span></span></span>`;
}

const clashParId = (id, clashes = HOSPITAL_CLASHES) => clashes.find((c) => c.id === id) || null;
export const urlMiniature = (clashId) => `/images/vues/${clashId}.jpg`;
export const nomVue = (clash, clashes = HOSPITAL_CLASHES) => "Collision n° " + (clashes.indexOf(clash) + 1);

function htmlVue(v) {
  const clash = clashParId(v.clashId);
  if (!clash) throw new Error(`Collision inconnue : ${v.clashId}`);
  const nom = nomVue(clash);
  const instruction = v.instruction
    ? `<span class="esp-vue-instr"><span class="esp-vue-etiquette">Instruction ${echapper(PAGES_INSTRUCTION[v.page] || "")}</span><span class="esp-vue-phrase">« ${echapper(v.instruction)} »</span></span>`
    : "";
  return `<li class="esp-vue-item" data-vue-id="${echapper(v.id)}" data-nom="${echapper(nom)}">`
    + `<button type="button" class="esp-vue" data-cible="${echapper(v.id)}" aria-label="Ouvrir ${echapper(nom.toLowerCase())} sur la page Collision">`
    + `<span class="esp-vue-image"><img src="${echapper(urlMiniature(v.clashId))}" alt="" width="640" height="400" loading="lazy" decoding="async"></span>`
    + `${htmlCarteCollision(clash)}${instruction}<span class="esp-vue-cadrage">Cadrage enregistré</span></button>${htmlActions(nom, true)}</li>`;
}

// Bouton « Voir » seulement quand l'alerte a une cible reelle (collision, discussion) : une mise a jour de maquette ou un document sans lien n'en ont pas.
const htmlAlerte = (a) => `<li><span class="esp-heure">${echapper(a.heure)}</span><div class="esp-corps"><p>${echapper(a.texte)}</p></div>`
  + (a.cible ? `<button type="button" class="esp-btn-voir" data-cible="${echapper(a.id)}" aria-label="Voir : ${echapper(a.texte)}">Voir</button>` : "") + "</li>";

function htmlEcheance(e, maintenant) {
  const p = pastilleDate(e.date);
  const label = LABELS_ECHEANCE[e.label] || e.label;
  return `<li class="esp-echeance"><div class="esp-date"><span class="esp-date-prox">${echapper(proximite(e.date, maintenant))}</span>`
    + `<span class="esp-date-jour">${echapper(p.jour)}</span><span class="esp-date-mois">${echapper(p.mois)}</span></div>`
    + `<div class="esp-ech-corps"><p class="esp-ech-titre">${echapper(e.titre)}</p>`
    + `<p class="esp-ech-contexte"><span class="esp-label esp-label-${echapper(e.label)}">${echapper(label)}</span><span>${echapper(e.personne)}</span>`
    + `<button type="button" class="esp-source" data-cible="${echapper(e.id)}">${echapper(e.discussion)}</button></p></div></li>`;
}

const CORPS = {
  vues: (items) => `<ul class="esp-vues">${items.map(htmlVue).join("")}`
    + `<li><button type="button" class="esp-vue-ajout"><span class="esp-vue-plus" aria-hidden="true">+</span>${echapper(TEXTES_ESPACE.ajoutVue)}</button></li></ul>`,
  alertes: (items) => `<ul class="esp-liste">${items.map(htmlAlerte).join("")}</ul>`,
  todo: (items) => `<ul class="esp-taches">${items.map((t) => `<li class="esp-tache"><span class="esp-etat" aria-hidden="true"></span><div class="esp-tache-corps"><p class="esp-tache-titre">${echapper(t.titre)}</p>`
    + `<p class="esp-tache-contexte"><span class="esp-initiale" aria-hidden="true">${echapper(initiale(t.par))}</span><span>Demandé par ${echapper(t.par)}</span>`
    + `<button type="button" class="esp-source" data-cible="${echapper(t.id)}">${echapper(t.discussion)}</button><span class="esp-tache-heure">${echapper(t.heure)}</span></p>`
    + (t.citation ? `<p class="esp-tache-citation">« ${echapper(t.citation)} »</p>` : "") + "</div>"
    + `<span class="esp-urgence">${echapper(t.urgence)}</span></li>`).join("")}</ul>`,
  echeances: (items, maintenant) => `<ol class="esp-echeances">${items.map((e) => htmlEcheance(e, maintenant)).join("")}</ol>`,
  documents: (items) => `<ul class="esp-liste">${items.map((d) => `<li><div class="esp-corps"><p>${echapper(d.texte)}</p>${d.meta ? `<p class="esp-meta">${echapper(d.meta)}</p>` : ""}</div><span class="esp-heure esp-heure-large">${echapper(d.quand)}</span></li>`).join("")}</ul>`,
  compteurs: (items) => `<ul class="esp-compteurs">${items.map((c) => `<li${c.urgent ? ' class="esp-urgent"' : ""}><strong>${echapper(c.valeur)}</strong><span>${echapper(c.libelle)}</span></li>`).join("")}</ul>`
};

export function htmlWidget(widget, rang, maintenant = new Date()) {
  const corps = CORPS[widget.type];
  if (!corps) throw new Error(`Type de widget inconnu : ${widget.type}`);
  const titre = widget.type === "todo"
    ? `<div class="esp-todo-entete"><h2>${echapper(widget.titre)}</h2><span class="esp-compteur">${widget.items.length} à traiter</span></div>`
    : `<h2>${echapper(widget.titre)}</h2>`;
  const repere = widget.repereIA ? `<p class="esp-repere-ia">${echapper(widget.repereIA)}</p>` : "";
  return `<section class="esp-widget esp-w-${echapper(widget.zone)}" style="--i:${rang}" data-widget="${echapper(widget.id)}" data-phrase="${echapper(widget.phrase)}" data-nom="${echapper(widget.titre)}">`
    + `${htmlActions(widget.titre)}<div class="esp-widget-tete">${titre}${repere}</div>${corps(widget.items, maintenant)}</section>`;
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
