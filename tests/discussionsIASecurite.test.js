// Controles statiques de securite de l'interface des Discussions par commande IA : aucun contenu de message ni sortie de l'IA ne doit etre injecte en
// HTML sans echappement, et aucun tiret quadratin ne doit apparaitre dans les fichiers du lot.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("panneau du rapport, bandeau, saisie : aucun innerHTML ni insertAdjacentHTML avec du texte variable", () => {
  for (const f of ["src/discussionsIARapportVue.js", "src/discussionsIABandeau.js"]) {
    assert.equal(/innerHTML|insertAdjacentHTML|outerHTML/.test(lire(f)), false, f);
  }
  // La saisie des Discussions n'a plus de HTML du tout (la modale commune src/iaSaisie.js n'utilise innerHTML que pour l'icone constante du micro).
  assert.equal(/innerHTML|insertAdjacentHTML|outerHTML/.test(lire("src/discussionsIA.js")), false);
});

test("liste filtree de la messagerie : tout texte variable passe par echapper() ou htmlSurligne(..., echapper)", () => {
  const source = lire("src/messagerie/messagerie.js");
  const debut = source.indexOf("function ligneResultatIA");
  const bloc = source.slice(debut, source.indexOf("function appliquerFiltreIA"));
  assert.ok(bloc.includes("echapper(r.convNom)") && bloc.includes("echapper(r.titre)") && bloc.includes("echapper(r.extrait.auteurNom)"));
  assert.ok(bloc.includes("htmlSurligne(r.extrait.texte, r.extrait.plages, echapper)"));
  assert.ok(bloc.includes("echapper(f.relecture"));
  assert.ok(bloc.includes("echapper(compte)"));
  // Les seuls nombres injectes sont des index et des compteurs.
  assert.ok(bloc.includes('data-i="\' + i + \'"'));
});

test("chaque source du rapport porte la cle de SON message (data-mk) et la remet a la messagerie", () => {
  const vue = lire("src/discussionsIARapportVue.js");
  assert.ok(vue.includes("b.dataset.mk = s.mk"));
  assert.ok(vue.includes("closest(\"[data-mk]\")") && vue.includes("surSource(mk)"));
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(montage.includes("surSource: (mk) => messagerie.montrerMessageIA(mk)"));
  assert.ok(lire("src/messagerie/messagerie.js").includes("'[data-mk=\"' + CSS.escape(mk) + '\"]'"));
});

test("aucun tiret quadratin dans les fichiers du lot Discussions IA", () => {
  const fichiers = [
    ...readdirSync(new URL("../src/", import.meta.url)).filter((f) => f.startsWith("discussionsIA")).map((f) => "src/" + f),
    ...readdirSync(new URL("../relais/", import.meta.url)).filter((f) => /Discussions/.test(f)).map((f) => "relais/" + f),
    ...readdirSync(new URL("../tests/", import.meta.url)).filter((f) => /discussionsIA|relaisDiscussions/.test(f)).map((f) => "tests/" + f),
    "api/discussions.js"
  ];
  assert.ok(fichiers.length >= 20);
  for (const f of fichiers) assert.equal(lire(f).includes("\u2014"), false, f);
});

test("fenetre du rapport : cinq blocs dans l'ordre, logo, trois boutons, PDF charge a la demande", () => {
  const vue = lire("src/discussionsIARapportVue.js");
  const ordre = ["rendreContexte, rendreIntervenants, rendreDesaccords, rendreDecision, rendreChronologie"].map((m) => vue.indexOf(m));
  assert.ok(ordre[0] > 0);
  for (const libelle of ['"Copier"', '"Exporter en PDF"', '"Fermer"', 'ouvra-logo.svg']) assert.ok(vue.includes(libelle), libelle);
  assert.equal(/from "\.\/discussionsIARapportPdf\.js"|from "jspdf/.test(vue + lire("src/discussionsIAMontage.js")), false, "le PDF ne se charge qu'au clic");
  assert.ok(lire("src/discussionsIAMontage.js").includes('await import("./discussionsIARapportPdf.js")'));
});
