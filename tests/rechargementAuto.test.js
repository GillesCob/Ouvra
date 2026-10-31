// Page d'erreur propre (31/10) : (1) rechargement automatique, une seule fois, quand un fichier charge a la demande a disparu apres un deploiement
// (evenement `vite:preloadError`, methode documentee par Vite) ; (2) message de la page 2D -> 3D avec un bouton « Recharger la page » ; (3) page 404 propre. Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installerRechargementAuto, DELAI_GARDE_MS } from "../src/rechargementAuto.js";

function monter({ maintenant = () => 1000, stockage = {} } = {}) {
  const ecouteurs = {}; let recharges = 0;
  const fenetre = { addEventListener: (n, f) => { ecouteurs[n] = f; }, location: { reload: () => { recharges += 1; } } };
  const magasin = { getItem: (k) => (k in stockage ? stockage[k] : null), setItem: (k, v) => { stockage[k] = String(v); } };
  installerRechargementAuto({ fenetre, stockage: magasin, maintenant });
  const declencher = () => { let evite = false; ecouteurs["vite:preloadError"]({ preventDefault: () => { evite = true; } }); return evite; };
  return { declencher, recharges: () => recharges, stockage };
}

test("premier echec de chargement : la page se recharge une fois et l'erreur est evitee", () => {
  const m = monter();
  assert.equal(m.declencher(), true);
  assert.equal(m.recharges(), 1);
});

test("deuxieme echec juste apres le rechargement : pas de boucle, l'erreur remonte (message de la page)", () => {
  let t = 1000;
  const m = monter({ maintenant: () => t });
  m.declencher();
  t += DELAI_GARDE_MS - 1;
  assert.equal(m.declencher(), false);
  assert.equal(m.recharges(), 1);
});

test("un nouvel echec bien plus tard recharge de nouveau", () => {
  let t = 1000;
  const m = monter({ maintenant: () => t });
  m.declencher();
  t += DELAI_GARDE_MS + 1;
  assert.equal(m.declencher(), true);
  assert.equal(m.recharges(), 2);
});

test("stockage indisponible (navigation privee) : ni exception ni boucle", () => {
  const ecouteurs = {}; let recharges = 0;
  const fenetre = { addEventListener: (n, f) => { ecouteurs[n] = f; }, location: { reload: () => { recharges += 1; } } };
  const casse = { getItem: () => { throw new Error("bloque"); }, setItem: () => { throw new Error("bloque"); } };
  installerRechargementAuto({ fenetre, stockage: casse, maintenant: () => 5 });
  assert.doesNotThrow(() => ecouteurs["vite:preloadError"]({ preventDefault() {} }));
  assert.equal(recharges, 0, "sans moyen de memoriser, on ne recharge pas (risque de boucle)");
});

test("cablage : installe au demarrage ; la page 2D -> 3D affiche un message avec un bouton « Recharger la page »", () => {
  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /installerRechargementAuto\(\{ fenetre: window, stockage: sessionStorage \}\)/);
  assert.match(main, /Recharger la page/);
  assert.ok(!main.includes("n'a pas pu se charger. Recharge la page."), "ancien texte brut retire");
});

test("page 404 : logo Ouvra en grand, onglet, message, retour au Viewer, aucun tiret quadratin ni ressource externe", () => {
  const html = readFileSync(new URL("../public/404.html", import.meta.url), "utf8");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>Page introuvable · Ouvra<\/title>/);
  assert.match(html, /rel="icon"[^>]*href="\/favicon\.svg"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /<img[^>]*src="\/images\/ouvra-logo\.svg"[^>]*alt="Ouvra/);
  assert.match(html, /Oups, un souci/);
  assert.match(html, /Cette page est introuvable\./);
  assert.match(html, /<a[^>]*href="\/#viewer"[^>]*>Retour au Viewer<\/a>/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="robots" content="noindex"/);
  assert.equal(html.includes(String.fromCharCode(0x2014)), false);
  assert.equal(/https?:\/\//.test(html), false, "aucune ressource externe");
});
