// PDF du rapport ouvert dans un nouvel onglet (28/10, demande de Gilles) plutot que telecharge : pas de fichier dans Telechargements devant le public,
// le lecteur PDF du navigateur permet de le telecharger. Repli : onglet bloque ou ferme -> telechargement comme avant.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { livrerRapportPdf } from "../src/discussionsIARapportPdf.js";
import { preparerOngletPdf } from "../src/discussionsIARapportOnglet.js";

// Fenetre factice : un document minimal (head, body, createElement) pour verifier ce qui est ecrit dans l'onglet sans navigateur.
function fauxOnglet() {
  const noeud = (tag) => ({ tag, style: {}, enfants: [], appendChild(e) { this.enfants.push(e); }, set textContent(v) { this.enfants = []; this.texte = v; } });
  const document = { title: "", head: noeud("head"), body: noeud("body"), documentElement: noeud("html"), createElement: noeud };
  return { closed: false, location: { href: "about:blank" }, document };
}

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const blob = { taille: 1 };

test("livrerRapportPdf : un onglet ouvert recoit l'adresse du PDF, rien n'est telecharge", () => {
  const onglet = fauxOnglet();
  const appels = { telecharge: 0, revoque: [] };
  const r = livrerRapportPdf("ouvra-recap.pdf", blob, {
    onglet, telecharger: () => { appels.telecharge += 1; }, creerUrl: () => "blob:ouvra/1", revoquer: (u) => appels.revoque.push(u), delaiRevocationMs: 0
  });
  assert.equal(r, "ouvert");
  const cadre = onglet.document.body.enfants[0];
  assert.equal(cadre.tag, "iframe");
  assert.equal(cadre.src, "blob:ouvra/1");
  assert.match(cadre.style.cssText, /width:100%;height:100%/);
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
  assert.ok(lire("src/discussionsIAMontage.js").includes("exporterRapportPdf(rapport, { telecharger, onglet, mobile:"));
});

test("onglet du PDF : titre et logo Ouvra (memes icones que index.html, chemins absolus de meme origine), texte d'attente", () => {
  const onglet = fauxOnglet();
  preparerOngletPdf(onglet, { origine: "https://ouvra.test" });
  assert.equal(onglet.document.title, "Rapport Ouvra");
  const liens = onglet.document.head.enfants;
  assert.deepEqual(liens.map((l) => [l.rel, l.href]), [["icon", "https://ouvra.test/favicon.svg"], ["apple-touch-icon", "https://ouvra.test/icons/apple-touch-icon.png"]]);
  const index = lire("index.html");
  assert.ok(index.includes('rel="icon" type="image/svg+xml" href="/favicon.svg"') && index.includes('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"'));
  assert.equal(onglet.document.body.texte, "Préparation du PDF…");
});
