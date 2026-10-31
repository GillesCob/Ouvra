// Retour de demo (31/10) : depuis une discussion, « Ouvrir dans le Viewer » sur un point de vue enregistre, puis « Recentrer » montrait toute la maquette
// au lieu du point de vue. Cause : activateView("viewer") remet recenterTarget a null, et ouvrirViewerSurVue ne le reposait pas.
// Ici on verifie le CABLAGE : apres activateView, « Recentrer » est dirige vers la camera du point de vue (comme pour une collision ou un fil de discussion).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const debut = main.indexOf("function ouvrirViewerSurVue(vue) {");
const corps = main.slice(debut, main.indexOf("\n}\n", debut));

test("ouvrirViewerSurVue : « Recentrer » est pose APRES activateView (qui le remet a null)", () => {
  assert.ok(debut > 0 && corps.length > 100, "fonction trouvee");
  const posActivation = corps.indexOf('activateView("viewer")');
  const posCible = corps.indexOf("recenterTarget =");
  assert.ok(posActivation >= 0, "activateView present");
  assert.ok(posCible > posActivation, "recenterTarget est pose apres activateView");
});

test("ouvrirViewerSurVue : « Recentrer » vole vers la camera du point de vue enregistre", () => {
  const cible = corps.slice(corps.indexOf("recenterTarget ="));
  assert.match(cible, /cameraFlight\.flyTo\(/);
  assert.match(cible, /vue\.etat\.camera\.eye/);
  assert.match(cible, /vue\.etat\.camera\.look/);
  assert.match(cible, /vue\.etat\.camera\.up/);
});

test("ouvrirViewerSurVue : une vue sans camera enregistree reste sur le chemin du bouton Viewer (aucune cible posee avant le retour anticipe)", () => {
  const retour = corps.indexOf("return;");
  const cible = corps.indexOf("recenterTarget =");
  assert.ok(retour >= 0 && retour < cible, "la cible n'est posee qu'apres le retour anticipe");
});

test("clic navbar depuis une vue de discussion : la cible de « Recentrer » est remise a null AVANT activateView (pas de cible perimee sur Collision)", () => {
  const bloc = main.slice(main.indexOf("const depuisVueDiscussion = viewerDepuisVueDiscussion;"));
  const posRaz = bloc.indexOf("if (depuisVueDiscussion) recenterTarget = null;");
  const posActivation = bloc.indexOf("activateView(page, { garder3D: true });");
  assert.ok(posRaz >= 0, "remise a null presente");
  assert.ok(posRaz < posActivation, "avant l'activation de la page");
});
