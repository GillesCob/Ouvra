// PDF du Quantitatif ouvert dans un nouvel onglet (28/10, demande de Gilles), comme le rapport des discussions. La mise en page du PDF ne change pas.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preparerOngletPdf, afficherPdfDansOnglet } from "../src/discussionsIARapportOnglet.js";

function fauxOnglet() {
  const noeud = (tag) => ({ tag, style: {}, enfants: [], appendChild(e) { this.enfants.push(e); }, set textContent(v) { this.enfants = []; this.texte = v; } });
  return { closed: false, document: { title: "", head: noeud("head"), body: noeud("body"), documentElement: noeud("html"), createElement: noeud } };
}
const lire = (c) => readFileSync(new URL("../" + c, import.meta.url), "utf8");

test("onglet parametrable : titre « Quantitatif Ouvra », memes icones, iframe au meme titre", () => {
  const o = fauxOnglet();
  preparerOngletPdf(o, { origine: "https://ouvra.test", titre: "Quantitatif Ouvra" });
  assert.equal(o.document.title, "Quantitatif Ouvra");
  assert.deepEqual(o.document.head.enfants.map((l) => l.href), ["https://ouvra.test/favicon.svg", "https://ouvra.test/icons/apple-touch-icon.png"]);
  afficherPdfDansOnglet(o, "blob:x");
  assert.equal(o.document.body.enfants[0].title, "Quantitatif Ouvra");
});

test("onglet par defaut : « Rapport Ouvra » inchange", () => {
  const o = fauxOnglet();
  preparerOngletPdf(o, { origine: "" });
  assert.equal(o.document.title, "Rapport Ouvra");
});

test("page Quantitatif : onglet ouvert dans le geste du clic avant l'attente, seulement pour le PDF ; Excel et CSV restent des telechargements", () => {
  const page = lire("src/quantitatifPage.js");
  const f = page.slice(page.indexOf("async function exporter("));
  assert.ok(f.indexOf('window.open("", "_blank")') > -1 && f.indexOf('window.open("", "_blank")') < f.indexOf("await (await import"));
  assert.ok(f.includes('if (format === "pdf") {\n      onglet = window.open'));
  assert.ok(f.includes("onglet.opener = null") && f.includes("onglet.close()") && f.includes("TITRE_ONGLET_QUANTITATIF"));
  assert.ok(f.includes("exporterXlsx(rapport, statut, { telecharger: (n, c) => telecharger(n, c) })"));
  assert.ok(f.includes('telecharger(nomFichier(rapport, "csv")'));
  assert.ok(!lire("src/quantitatifPage.js").includes("Quantitatif Ouvra —"));
});

test("export PDF : onglet transmis a la livraison, repli telechargement", () => {
  assert.ok(lire("src/quantitatifExportPdf.js").includes("livrerRapportPdf(def.nomFichier, doc.output(\"blob\"), { onglet, telecharger })"));
});
