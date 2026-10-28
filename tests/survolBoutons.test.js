// Survol des boutons de l'IA (28/10, Gilles) : tout bouton des modales, bandeaux et panneaux IA reagit au passage de la souris, micro compris. Reprend les motifs deja
// valides : bouton neutre -> bordure accent (#reglesIABtn, .regles-ia-bascule), bouton plein -> teinte un peu plus claire (#navbarContact). Seulement sur appareil
// a souris (@media (hover: hover) and (pointer: fine)) : pas de survol colle sur iPhone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const blocsSurvol = (css) => (css.match(/@media \(hover: hover\) and \(pointer: fine\) \{[^]*?\n\}/g) || []).join("\n");

const ATTENDUS = {
  "src/reglesIA.css": [".regles-ia-valider:not(:disabled):hover", ".regles-ia-micro:not(:disabled):not(.ecoute):hover"],
  "src/discussionsIA.css": [".disc-rapport-btn:not(:disabled):hover", ".msg-racine .msg-ia-nouvelle:hover", "#discussionsBandeau button:hover", '#discussionsBandeau button[data-act="oui"]:hover', "#discussionsRapportBandeauRetour button:hover"],
  "src/commandesIA.css": ["#commandesBandeau button:hover", '#commandesBandeau button[data-act="oui"]:hover']
};

test("chaque bouton des modales, bandeaux et panneaux IA a une regle de survol, reservee aux appareils a souris", () => {
  for (const [fichier, selecteurs] of Object.entries(ATTENDUS)) {
    const survol = blocsSurvol(lire(fichier));
    for (const s of selecteurs) assert.ok(survol.includes(s), fichier + " : " + s);
  }
});

test("le micro reagit comme les autres boutons neutres (texte plein, bordure accent), sauf pendant l'ecoute", () => {
  const survol = blocsSurvol(lire("src/reglesIA.css"));
  const bloc = survol.slice(survol.indexOf(".regles-ia-micro:not(:disabled):not(.ecoute):hover"));
  assert.ok(bloc.slice(0, bloc.indexOf("}")).includes("color: var(--text)") && bloc.slice(0, bloc.indexOf("}")).includes("border-color: var(--accent)"));
});

test("un bouton plein s'eclaircit au survol comme « Me contacter » (teinte un peu plus claire de la meme couleur)", () => {
  const valider = blocsSurvol(lire("src/reglesIA.css"));
  assert.match(valider, /\.regles-ia-valider:not\(:disabled\):hover \{ background: color-mix\(in srgb, var\(--accent\) 86%, #fff\); \}/);
  const bandeau = blocsSurvol(lire("src/discussionsIA.css"));
  assert.ok(bandeau.includes("color-mix(in srgb, #7fae84 86%, #fff)"));
});

// Boutons oublies par la premiere passe (28/10, Gilles) : le bouton « Fermer » du rapport (bouton plein dont la bordure est deja a l'accent : « bordure accent » ne
// changeait rien, il faut la teinte plus claire) et tous les autres boutons visibles a la souris sans regle de survol, ou dont le survol ne se voyait pas.
// Laisses volontairement sans survol : boutons mobile seulement (#navbarToggle, #presentationSidebarToggle, #infoPanelToggle, #collisionInfoPanelToggle, .msg-retour,
// .msg-menu > button, .pres-next-btn), cartes a retourner de la presentation (.flip-card) et panneau interne de recolte des vues (messagerie/recolteVues.js).
const PLEIN_ACCENT = "color-mix(in srgb, var(--accent) 86%, #fff)";
const OUBLIES = {
  "src/discussionsIA.css": [".disc-rapport-fermer:not(:disabled):hover", ".msg-racine .msg-ia-retour:hover"],
  "src/style.css": ["#docModalDownload:not(:disabled):hover", "#downloadModalOk:not(:disabled):hover", '#newDiscussionForm > button[type="submit"]:not(:disabled):hover', ".landing-part-btn:hover",
    ".disc-vide button:hover", "#discussionReplyForm button:not(:disabled):hover", ".fil-reponse button:not(:disabled):hover", "#docModalClose:hover", "#newDiscussionClose:hover",
    "#infoPanelCollapse:hover", ".thread-toggle-btn:not(.active):hover", '.collision-niveau-btn:not([aria-pressed="true"]):hover', '#collisionFiltre button:not([aria-pressed="true"]):hover'],
  "src/messagerie/messagerie.css": [".msg-envoyer:not(:disabled):hover", ".msg-primaire:not(:disabled):hover", "#msgBandeauVue button:hover", "#msgBandeauRetour button:hover",
    '#msgBandeauVue button[data-act="valider"]:hover', "button.msg-pastille:not(.actif):hover", '.msg-urgent-bouton:not([aria-pressed="true"]):hover', ".msg-retirer:hover", ".msg-bas:hover"],
  "src/reglesModale.css": ["#reglesBandeauRetour button:hover"],
  "src/retourContexte.css": ["#quantitatifBandeauRetour button:hover", "#plan3dBandeauRetour button:hover"],
  "src/commandesIA.css": [".commandes-zones-actions button:hover", ".commandes-zones-fermer:hover", ".commandes-zones-supprimer:hover"],
  "src/plan3d/plan3d.css": [".p3d-btn-fort:not(:disabled):hover", ".p3d-lien:hover", '.p3d-puce:not([aria-pressed="true"]):hover']
};

test("les boutons oublies par la premiere passe ont une regle de survol reservee aux appareils a souris", () => {
  for (const [fichier, selecteurs] of Object.entries(OUBLIES)) {
    const survol = blocsSurvol(lire(fichier));
    for (const s of selecteurs) assert.ok(survol.includes(s), fichier + " : " + s);
  }
});

test("le bouton « Fermer » du rapport (plein, bordure deja a l'accent) s'eclaircit au survol, bordure comprise", () => {
  const survol = blocsSurvol(lire("src/discussionsIA.css"));
  const debut = survol.indexOf(".disc-rapport-fermer:not(:disabled):hover");
  assert.ok(debut >= 0);
  const regle = survol.slice(debut, survol.indexOf("}", debut));
  assert.ok(regle.includes("background: " + PLEIN_ACCENT) && regle.includes("border-color: " + PLEIN_ACCENT));
});

test("un bouton plein a l'accent s'eclaircit au survol au lieu de changer de bordure (invisible : la bordure est deja a l'accent)", () => {
  const style = blocsSurvol(lire("src/style.css"));
  assert.ok(style.includes("background: " + PLEIN_ACCENT));
  const p3d = blocsSurvol(lire("src/plan3d/plan3d.css"));
  assert.match(p3d, /\.p3d-btn-fort:not\(:disabled\):hover \{[^}]*background: color-mix\(in srgb, var\(--accent\) 86%, #fff\)/);
  const msg = blocsSurvol(lire("src/messagerie/messagerie.css"));
  assert.ok(msg.includes("color-mix(in srgb, var(--msg-accent) 86%, #fff)"));
});
