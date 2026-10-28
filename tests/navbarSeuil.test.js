// Barre de navigation (28/10) : « Me contacter » ne recouvre jamais un onglet ni « Bug ou idée ? ». Il reste centre tant qu'il y a la place, puis s'arrete 16 px apres
// le dernier onglet (placerContactNavbar, meme principe que la pastille placerPastilleNavbar) ; la barre passe au menu hamburger a 960 px (barre seulement : le reste
// de l'application garde son seuil mobile de 768 px). Les rectangles sont mesures dans un navigateur (WebKit) a chaque largeur ; ici, la coherence des seuils.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const SEUIL = "960px";

test("CSS : le bloc du menu hamburger, la pastille masquee et le bouton d'avis changent de forme au meme seuil de 960 px", () => {
  const css = lire("src/style.css");
  assert.ok(css.includes("@media (max-width: " + SEUIL + ") {\n  #navbarToggle { display: block;"), "bloc du hamburger");
  assert.ok(css.includes("@media (max-width: " + SEUIL + ") {\n  #navbarThumb { display: none; }"), "pastille masquee");
  assert.ok(lire("src/retourVisiteur.css").includes("@media (max-width: " + SEUIL + ")"), "bouton d'avis barre / menu");
});

test("CSS : le style des onglets de la barre large (fond de l'onglet actif retire, transition) vaut jusqu'au seuil du hamburger, pas au-dela", () => {
  const css = lire("src/style.css");
  assert.ok(css.includes("@media (min-width: 961px) {\n  .nav-link { transition: color 0.3s ease; }"));
  assert.equal(css.includes("@media (min-width: 769px) {\n  .nav-link { transition"), false);
});

test("JS : la requete du menu hamburger est celle de 960 px ; « Me contacter » est place par mesure (16 px apres le dernier onglet)", () => {
  const js = lire("src/main.js");
  assert.ok(js.includes('const navbarMobileQuery = window.matchMedia("(max-width: ' + SEUIL + ')");'));
  assert.ok(js.includes("function placerContactNavbar"));
  assert.ok(js.includes("--contact-x") && js.includes("ECART_CONTACT_PX = 16"));
  assert.ok(lire("src/style.css").includes("left: var(--contact-x, 50%)"));
  assert.ok(js.includes("placerPastilleNavbar();\n  placerContactNavbar();"), "replace a chaque choix de vue (barre masquee sur l'accueil)");
  assert.ok(js.includes("document.fonts.ready.then(placerContactNavbar)"), "replace quand les polices sont chargees");
});

test("les autres mises en page de l'application gardent leur seuil mobile de 768 px (la barre seule change)", () => {
  assert.ok(lire("src/main.js").includes('const APPAREIL_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia(REQUETE_MOBILE).matches;'));
  assert.ok(lire("src/seuilMobile.js").includes('REQUETE_MOBILE = "(max-width: 768px)"'));
  assert.ok((lire("src/style.css").match(/@media \(max-width: 768px\)/g) || []).length >= 20);
});
