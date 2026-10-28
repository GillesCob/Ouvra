// Tests statiques de la page Quantitatif : markup, feuille de style et contrats (pas de DOM disponible sous Node, le rendu se juge a l'ecran).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dateRelative } from "../src/quantitatifRapport.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const html = lire("index.html");
const js = lire("src/quantitatifPage.js");
const css = lire("src/quantitatif.css");

test("index.html : entree de navbar et vue Quantitatif branchees comme les autres pages", () => {
  assert.match(html, /<button type="button" class="nav-link" data-view="quantitatif" data-persona="presentation-globale bim-manager synthese be">Quantitatif<\/button>/);
  assert.match(html, /<div id="view-quantitatif" class="view" hidden>\s*<div id="quantitatifRoot"><\/div>/);
});

test("css : chaque classe qt- creee par la page a une regle, et toute regle est limitee a la page", () => {
  const classesJs = new Set([...js.matchAll(/["' ]qt-[a-z0-9-]+/g)].map((m) => m[0].trim().replace(/["']/g, "")));
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const c of classesJs) assert.ok(sansCommentaires.includes("." + c), "classe sans regle : " + c);
  const selecteurs = sansCommentaires.split("}").map((b) => b.split("{")[0].trim()).filter((s) => s && !s.startsWith("@") && !/^\d/.test(s));
  for (const bloc of selecteurs) for (const sel of bloc.split(",").map((x) => x.trim()).filter(Boolean)) {
    assert.match(sel, /^(#view-quantitatif|\.qt-)/, "selecteur hors de la page : " + sel);
  }
});

test("css : couleurs en dur limitees a celles deja presentes dans l'application, variables pour le reste", () => {
  const appCss = lire("src/style.css");
  const couleurs = new Set(css.replace(/\/\*[\s\S]*?\*\//g, "").match(/#[0-9a-fA-F]{3,8}\b/g) || []);
  for (const c of couleurs) if (!["#fff", "#160b0a"].includes(c)) assert.ok(appCss.toLowerCase().includes(c.toLowerCase()), "couleur absente de l'application : " + c);
  assert.ok(css.includes("var(--surface)") && css.includes("var(--border)") && css.includes("var(--accent)"));
});

test("css : accessibilite et mobile (focus visible, mouvement reduit, cibles tactiles, une seule colonne)", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*min-height: 4[04]px/);
  assert.doesNotMatch(css, /qt-grille|qt-lateral/); // une seule colonne depuis la carte de depart (25/10) : plus de grille a deux colonnes
  assert.match(css, /position: sticky; top: 0/); // en-tete de tableau collant
  assert.match(css, /font-variant-numeric: tabular-nums/);
});

test("page : tableau accessible, exports groupes, historique en cartes, aucun encart « Pose une question » sous la demande, un seul bouton IA qui ouvre la modale commune, aucune injection HTML", () => {
  assert.match(js, /th\.scope = "col"/);
  assert.match(js, /creer\("caption"/);
  assert.match(js, /aria-label", "Exporter ou supprimer ce rapport"/);
  assert.doesNotMatch(js, /Pose une question sur ta maquette/); // encart retire le 25/10 (demande de Gilles)
  assert.doesNotMatch(js, /etatVide|qt-etat-vide/);
  assert.match(js, /qt-histo-item/);
  assert.match(js, /creerIASaisie\(/);
  assert.match(js, /boutonIA\.addEventListener\("click", \(\) => saisie\.ouvrir\(\{\}\)\)/);
  assert.match(js, /saisie\.reformuler\(/); // « Non » : la modale se rouvre en texte, prerenseignee
  // plus de barre de demande en ligne : ni champ, ni micro, ni dictee dans la page (tout est dans src/iaSaisie.js)
  assert.ok(!/creerDictee|qt-champ|qt-micro|quantitatifVocalBtn/.test(js));
  assert.ok(!js.includes("innerHTML"));
});

test("page : Voir dans le Viewer donne un rappel de retour { libelle, surRetour } relisant le meme rapport dans l'historique", () => {
  assert.match(js, /voirDansViewer\(ligne\.criteres, contexteRetour\(\)\)/);
  assert.match(js, /libelle: "Retour au quantitatif"/);
  assert.match(js, /historique\.obtenir\(rapportCourant\.id\)/);
});

test("dateRelative : instant, minutes, heures, hier, jours, date, entree invalide", () => {
  const maintenant = new Date("2026-10-24T12:00:00");
  const il = (min) => new Date(maintenant.getTime() - min * 60000).toISOString();
  assert.equal(dateRelative(il(0), maintenant), "à l'instant");
  assert.equal(dateRelative(il(5), maintenant), "il y a 5 min");
  assert.equal(dateRelative(il(180), maintenant), "il y a 3 h");
  assert.equal(dateRelative(il(60 * 24 + 5), maintenant), "hier");
  assert.equal(dateRelative(il(60 * 24 * 3), maintenant), "il y a 3 jours");
  assert.match(dateRelative(il(60 * 24 * 30), maintenant), /\d{2}\/\d{2}\/\d{4}/);
  assert.equal(dateRelative("pas une date", maintenant), "");
});

test("retours mobile du 28/10 : cartes cliquables, Exporter + Supprimer, pas d'Historique ni de Nouvelle demande dans un quantitatif, un seul name de details", () => {
  assert.match(js, /creer\("button", "qt-histo-carte"\)/);
  assert.doesNotMatch(js, /Supprimer de l'historique|creer\("button", "qt-btn", "Rouvrir"\)/);
  assert.match(js, /creer\("button", "qt-btn", "Exporter"\)/);
  assert.match(js, /"Supprimer ce quantitatif"/);
  assert.match(js, /barre\.appendChild\(boutonRetour\)/);
  assert.doesNotMatch(js, /barre\.append\([^)]*(boutonIA|boutonHistorique)/); // la barre des vues ne porte que « Retour »
  assert.match(js, /const NOM_DETAILS = "qt-infos"/);
  assert.equal((js.match(/setAttribute\("name"/g) || []).length, 1); // un seul name, partage par tous les <details> de la page
  assert.match(css, /\.qt-page\.qt-confirmation \.qt-entete \{ display: none; \}/); // titre retire sous le bandeau de confirmation
});

test("page : « Retour » depuis un quantitatif rouvert de l'historique ramene aux cartes de l'historique, sinon au depart", () => {
  assert.match(js, /let retourVers = "depart"/);
  assert.match(js, /const cible = vue === "resultat" \? retourVers : "depart"/);
  assert.match(js, /retourVers = "historique";\s*await afficherRapport\(rapport, \{ nouveau: false \}\)/); // rouvrir
  assert.match(js, /retourVers = "depart";\s*await afficherRapport\(rapport, \{ nouveau: true \}\)/); // nouvelle demande
});
