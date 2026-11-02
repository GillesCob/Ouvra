import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, ICONES, TYPES_NOEUD } from "../src/ideesEvolutionDonnees.js";
import { echapper, htmlNoeud, htmlScenario, htmlPage, htmlSprite, htmlLegende } from "../src/ideesEvolutionRendu.js";
import { indicesDebutDeLigne } from "../src/ideesEvolution.js";

const tousLesNoeuds = () => SCENARIOS.flatMap((s) => s.noeuds);

test("donnees : quatre frises, la derniere avec le lien interne vers Mon espace, aucune trace des idees retirees", () => {
  assert.equal(SCENARIOS.length, 4);
  assert.deepEqual(SCENARIOS.map((s) => s.noeuds.length), [6, 6, 4, 6]);
  assert.deepEqual(SCENARIOS[3].lien, { vue: "espace", texte: "Voir la page personnelle →" });
  assert.equal(SCENARIOS.filter((s) => s.lien).length, 1);
  assert.deepEqual(SCENARIOS.map((s) => s.titre), ["Réunion de synthèse", "Mise à jour des maquettes", "Le bon document, là où je regarde", "Une page qui s'adapte à moi, à la voix"]);
  assert.doesNotMatch(htmlPage(), /BCF|Autres idées|enchaînement|À évoquer|ide-autres|ide-isoles|ide-lead/);
});

test("donnees : chaque noeud a un type connu, une icone du sprite et un libelle (ou un texte pour lecteur d'ecran seulement)", () => {
  for (const n of tousLesNoeuds()) {
    assert.ok(TYPES_NOEUD.includes(n.type), n.type);
    assert.ok(ICONES[n.icone], "icone " + n.icone);
    assert.ok(n.label || n.srSeul);
  }
  assert.ok(ICONES.gear, "l'icone de la pastille « Automatique »");
});

test("donnees : un seul noeud « suite non definie », sans libelle visible", () => {
  const ouverts = tousLesNoeuds().filter((n) => n.type === "ouvert");
  assert.equal(ouverts.length, 1);
  assert.equal(ouverts[0].srSeul, "Suite non définie");
  assert.equal(ouverts[0].label, undefined);
});

test("rendu : le noeud IA porte la pastille IA, l'automatique la pastille engrenage, l'humain aucune", () => {
  const ia = htmlNoeud({ type: "ia", icone: "text", label: "Retranscription" }, 2);
  assert.match(ia, /^<li class="ide-node ide-ia" style="--n:2">/);
  assert.match(ia, /<span class="ide-ia-tag">IA<\/span>/);
  const auto = htmlNoeud({ type: "auto", icone: "wave", label: "Écoute" }, 1);
  assert.match(auto, /ide-auto-tag" title="Automatique"/);
  assert.match(auto, /#ide-i-gear/);
  const humain = htmlNoeud({ type: "humain", icone: "mic", label: "Réunion" }, 0);
  assert.match(humain, /^<li class="ide-node" /);
  assert.doesNotMatch(humain, /ide-ia-tag|ide-auto-tag/);
});

test("rendu : suite non definie reservee aux lecteurs d'ecran, type inconnu refuse", () => {
  const o = htmlNoeud({ type: "ouvert", icone: "dots", srSeul: "Suite non définie" }, 5);
  assert.match(o, /<span class="ide-lab"><span class="ide-sr">Suite non définie<\/span><\/span>/);
  assert.throws(() => htmlNoeud({ type: "inconnu", icone: "mic", label: "x" }, 0), /Type de noeud inconnu/);
});

test("rendu : tout texte est echappe", () => {
  assert.equal(echapper(`<b>"a" & 'b'</b>`), "&lt;b&gt;&quot;a&quot; &amp; &#x27;b&#x27;&lt;/b&gt;");
  const h = htmlNoeud({ type: "humain", icone: "mic", label: "<img src=x onerror=alert(1)>" }, 0);
  assert.doesNotMatch(h, /<img/);
});

test("rendu : la page contient quatre sections, des liens internes seulement (aucun fichier .html), et chaque icone utilisee existe dans le sprite", () => {
  const page = htmlPage();
  assert.equal((page.match(/<section class="ide-scn"/g) || []).length, 4);
  assert.doesNotMatch(page, /\.html/);
  assert.match(page, /<a href="#espace" data-vue="espace">Voir la page personnelle →<\/a>/);
  const sprite = htmlSprite();
  for (const m of page.matchAll(/<use href="#(ide-i-[a-z]+)"/g)) assert.ok(sprite.includes(`id="${m[1]}"`), m[1]);
  for (const m of page.matchAll(/src="([^"]+)"/g)) assert.match(m[1], /^\/images\/idees\/batiment-estime-[a-z0-9-]+\.svg$/);
});

test("rendu : jamais le mot interdit dans un texte visible", () => {
  assert.doesNotMatch(htmlPage() + htmlLegende(), new RegExp("pe" + "tit", "i"));
});

test("rendu : la legende donne les quatre cas, chaque frise relie son titre a sa section", () => {
  assert.match(htmlLegende(), /IA<\/li><li>.*Automatique<\/li><li>.*Humain<\/li><li>.*Suite non définie<\/li>/);
  const s = htmlScenario(SCENARIOS[0], 0);
  assert.match(s, /aria-labelledby="ide-scn1"/);
  assert.match(s, /<h3 id="ide-scn1">Réunion de synthèse<\/h3>/);
});

test("debuts de ligne : un rond dont le haut depasse de plus de 2 px celui du precedent ouvre une ligne (vide, un seul rond, une seule ligne, plusieurs lignes)", () => {
  assert.deepEqual(indicesDebutDeLigne([]), []);
  assert.deepEqual(indicesDebutDeLigne([0]), []);
  assert.deepEqual(indicesDebutDeLigne([0, 0, 0]), []);
  assert.deepEqual(indicesDebutDeLigne([0, 1, 2]), []); // 2 px de tolerance
  assert.deepEqual(indicesDebutDeLigne([0, 0, 90, 90, 180]), [2, 4]);
});
