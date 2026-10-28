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
