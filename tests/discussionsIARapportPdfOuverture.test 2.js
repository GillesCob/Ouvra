// PDF du rapport ouvert dans un nouvel onglet (28/10, demande de Gilles) plutot que telecharge : pas de fichier dans Telechargements devant le public,
// le lecteur PDF du navigateur permet de le telecharger. Repli : onglet bloque ou ferme -> telechargement comme avant.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { livrerRapportPdf } from "../src/discussionsIARapportPdf.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const blob = { taille: 1 };

test("livrerRapportPdf : un onglet ouvert recoit l'adresse du PDF, rien n'est telecharge", () => {
  const onglet = { closed: false, location: { href: "about:blank" } };
  const appels = { telecharge: 0, revoque: [] };
  const r = livrerRapportPdf("ouvra-recap.pdf", blob, {
    onglet, telecharger: () => { appels.telecharge += 1; }, creerUrl: () => "blob:ouvra/1", revoquer: (u) => appels.revoque.push(u), delaiRevocationMs: 0
  });
  assert.equal(r, "ouvert");
  assert.equal(onglet.location.href, "blob:ouvra/1");
  assert.equal(appels.telecharge, 0);
});

test("livrerRapportPdf : onglet bloque (null) ou deja ferme -> telechargement, sans toucher a l'onglet", () => {
  for (const onglet of [null, undefined, { closed: true, location: { href: "about:blank" } }]) {
    const noms = [];
    const r = livrerRapportPdf("ouvra-recap.pdf", blob, { onglet, telecharger: (nom) => noms.push(nom), creerUrl: () => { throw new Error("pas d'URL"); } });
    assert.equal(r, "telecharge");
    assert.deepEqual(noms, ["ouvra-recap.pdf"]);
    if (onglet) assert.equal(onglet.location.href, "about:blank");
  }
});

test("vue : l'onglet est ouvert dans le geste du clic (avant l'attente), coupe de la page, et ferme si la generation echoue", () => {
  const vue = lire("src/discussionsIARapportVue.js");
  const exporter = vue.slice(vue.indexOf("async function exporter()"));
  assert.ok(exporter.indexOf('window.open("", "_blank")') > -1 && exporter.indexOf('window.open("", "_blank")') < exporter.indexOf("await exporterPdf"));
  assert.ok(exporter.includes("onglet.opener = null"));
  assert.ok(exporter.includes("onglet.close()"));
  assert.ok(exporter.includes('"PDF ouvert"'));
});

test("montage : l'onglet est transmis a l'export", () => {
  assert.ok(lire("src/discussionsIAMontage.js").includes("exporterRapportPdf(rapport, { telecharger, onglet })"));
});
