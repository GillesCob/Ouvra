// Tests de la recherche par mots (src/discussionsIATexte.js) : mots utiles, racines, synonymes, classement, extrait et surlignage.
import test from "node:test";
import assert from "node:assert/strict";
import { motsUtiles, racine, construireTermes, classer, plagesCorrespondantes, extraitAutour, htmlSurligne } from "../src/discussionsIATexte.js";
import { echapper } from "../src/messagerie/format.js";

const entree = (texte, quand = 0) => ({ texte, quand, mk: "x#" + texte.length });

test("motsUtiles : sans mots vides ni mots de commande, sans accent, sans doublon", () => {
  assert.deepEqual(motsUtiles("Trouve-moi l'échange où on a parlé de la cloison coupe-feu"), ["cloison", "coupe", "feu"]);
  assert.deepEqual(motsUtiles("Fais-moi un rapport sur les Réservations réservations"), ["reservations"]);
  assert.deepEqual(motsUtiles(""), []);
  assert.deepEqual(motsUtiles("   de la  "), []);
});

test("racine : pluriels et suffixes courants, mots courts intacts", () => {
  assert.equal(racine("cloisons"), racine("cloison"));
  assert.equal(racine("reservations"), racine("reservation"));
  assert.equal(racine("poutres"), "poutr");
  assert.equal(racine("axe"), "axe");
  assert.equal(racine("cf"), "cf");
});

test("construireTermes : une racine par mot, synonymes du metier ajoutes, doublons fusionnes", () => {
  const termes = construireTermes(["grue", "grues levage"]);
  assert.equal(termes.filter((t) => t.racine === "grue").length, 1);
  assert.ok(termes.find((t) => t.racine === "grue").voisines.includes("levag"));
  assert.deepEqual(construireTermes([]), []);
  assert.deepEqual(construireTermes(["de la"]), []);
});

test("classer : le message le plus pertinent d'abord, un synonyme compte moins qu'un mot exact, un message sans rapport est ecarte", () => {
  const messages = [
    entree("Le planning de levage est décalé", 1),
    entree("L'accès grue est bloqué mardi", 2),
    entree("Bonjour, tout va bien", 3),
    entree("Les grues arrivent lundi", 4)
  ];
  const r = classer(messages, construireTermes(["grue"]));
  assert.equal(r.length, 3);
  assert.ok(r[0].entree.texte.includes("grue") && r[1].entree.texte.includes("grue"));
  assert.ok(r[2].entree.texte.includes("levage")); // synonyme, a poids reduit
  assert.ok(r[2].score < r[1].score);
});

test("classer : sans terme ou sans message -> liste vide", () => {
  assert.deepEqual(classer([entree("grue")], []), []);
  assert.deepEqual(classer([], construireTermes(["grue"])), []);
});

test("classer : un mot rare pese plus qu'un mot present partout", () => {
  const messages = [entree("chantier chantier"), entree("chantier"), entree("chantier trémie"), entree("chantier")];
  const r = classer(messages, construireTermes(["chantier trémie"]));
  assert.equal(r[0].entree.texte, "chantier trémie");
});

test("plagesCorrespondantes : positions dans le texte d'origine, avec accents et casse", () => {
  const texte = "La Trémie du noyau est décalée, la trémie 2 aussi";
  const plages = plagesCorrespondantes(texte, construireTermes(["tremie"]));
  assert.deepEqual(plages.map(([a, b]) => texte.slice(a, b)), ["Trémie", "trémie"]);
  assert.deepEqual(plagesCorrespondantes("rien ici", construireTermes(["tremie"])), []);
});

test("extraitAutour : texte court intact ; texte long coupe aux espaces autour de la premiere plage, plages decalees", () => {
  assert.deepEqual(extraitAutour("court", [[0, 5]]), { texte: "court", plages: [[0, 5]] });
  const long = "debut ".repeat(40) + "la grue est bloquée " + "fin ".repeat(40);
  const plages = plagesCorrespondantes(long, construireTermes(["grue"]));
  const e = extraitAutour(long, plages, 100);
  assert.ok(e.texte.length <= 110);
  assert.ok(e.texte.startsWith("… ") && e.texte.endsWith(" …"));
  assert.equal(e.plages.length, 1);
  assert.equal(e.texte.slice(e.plages[0][0], e.plages[0][1]), "grue");
});

test("htmlSurligne : <mark> sur les plages, tout le reste echappe (jamais de HTML venant d'un message)", () => {
  const texte = "<b>grue</b> & levage";
  const html = htmlSurligne(texte, [[3, 7]], echapper);
  assert.equal(html, "&lt;b&gt;<mark>grue</mark>&lt;/b&gt; &amp; levage");
  assert.equal(htmlSurligne("rien", [], echapper), "rien");
});

test("synonymes : « coupe » seul ne ramene ni incendie ni feu ; coupe-feu garde ses voisins", () => {
  const seul = construireTermes(["coupe"]);
  assert.deepEqual(seul[0].voisines, []);
  const messages = [entree("Alerte incendie au R+1"), entree("Voir la coupe du plan")];
  assert.equal(classer(messages, seul).length, 1);
  const feu = construireTermes(["coupe-feu"]).find((t) => t.racine === "feu");
  assert.ok(feu.voisines.includes("incendi"));
});
