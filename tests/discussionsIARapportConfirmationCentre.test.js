// Rapport pendant « Est-ce bien votre demande ? » (30/10) : sur laptop il est deja dans sa forme finale (zone centrale, pleine largeur) ; « Oui » le garde tel quel.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const montage = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
const bloc = (debut, fin) => {
  const a = montage.indexOf(debut);
  assert.ok(a >= 0, "absent : " + debut);
  return montage.slice(a, montage.indexOf(fin, a));
};

test("proposer : sur laptop le rapport en attente s'ouvre au centre, sur mobile en modale", () => {
  const proposer = bloc("proposer: (retour, phrase)", "return { ok: true }");
  assert.match(proposer, /application\.type === "rapport"/);
  assert.match(proposer, /montrerRapportAuCentre\(retour\.rapport\)/);
  assert.match(proposer, /rapportVue\.ouvrir\(retour\.rapport\)/);
  assert.match(proposer, /REQUETE_MOBILE/);
  assert.ok(proposer.indexOf("montrerRapportAuCentre") < proposer.indexOf("rapportEnAttente = retour.rapport"), "le rapport en attente est memorise apres l'ouverture au centre (qui le remet a null)");
});

test("Oui : un rapport deja au centre n'est pas redessine, la carte de l'historique est quand meme ajoutee", () => {
  const oui = bloc("surOui: () =>", "surNon:");
  assert.match(oui, /dejaAuCentre = !!retour && rapportEnAttente === retour\.rapport && rapportVue\.ouvert\(\) && rapportVue\.derniereOuvertureAuCentre\(\)/);
  assert.match(oui, /if \(laptop && entree && !dejaAuCentre\) montrerRapportAuCentre/);
  assert.match(oui, /ajouterSynthese\(retour\.rapport\)/);
});

test("exemple de rapport : reste en modale (inchange)", () => {
  const exemple = bloc("surClic: () =>", "// Historique des syntheses");
  assert.match(exemple, /rapportVue\.ouvrir\(modele\.rapport\)/);
  assert.doesNotMatch(exemple, /Centre/);
});

test("titre du rapport au centre : le focus donne par programme ne dessine pas de bordure", () => {
  const css = readFileSync(new URL("../src/discussionsIA.css", import.meta.url), "utf8");
  assert.match(css, /\.disc-rapport-titre:focus \{ outline: none; \}/);
  const vue = readFileSync(new URL("../src/discussionsIARapportVue.js", import.meta.url), "utf8");
  assert.match(vue, /titre\.tabIndex = -1;/);
});
