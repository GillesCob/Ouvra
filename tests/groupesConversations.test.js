import { test } from "node:test";
import assert from "node:assert/strict";
import { regrouperConversations, GROUPES_CONVERSATIONS } from "../src/messagerie/groupesConversations.js";

const c = (id, type) => ({ id, type });

test("deux groupes, libelles des onglets de Discussions, ordre conserve dans chaque groupe", () => {
  const r = regrouperConversations([c("g1", "groupe"), c("i1", "individuel"), c("g2", "groupe"), c("i2", "individuel")]);
  assert.deepEqual(r.map((g) => g.libelle), ["Individuel", "Groupes"]);
  assert.deepEqual(r[0].conversations.map((x) => x.id), ["i1", "i2"]);
  assert.deepEqual(r[1].conversations.map((x) => x.id), ["g1", "g2"]);
});

test("un groupe vide n'est pas rendu, liste vide donne aucun groupe", () => {
  assert.deepEqual(regrouperConversations([c("g1", "groupe")]).map((g) => g.type), ["groupe"]);
  assert.deepEqual(regrouperConversations([c("i1", "individuel")]).map((g) => g.type), ["individuel"]);
  assert.deepEqual(regrouperConversations([]), []);
});

test("les libelles sont ceux des onglets de la messagerie", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/messagerie/messagerie.js", import.meta.url), "utf8");
  for (const { libelle } of GROUPES_CONVERSATIONS) assert.ok(src.includes(">" + libelle + " <span"), libelle);
});

test("dialogue Nouveau sujet : bascule a pastille et zone defilante dans une carte de taille fixe", async () => {
  const fs = await import("node:fs");
  const js = fs.readFileSync(new URL("../src/messagerie/messagerie.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/messagerie/messagerie.css", import.meta.url), "utf8");
  assert.match(js, /msg-pastille/);
  assert.match(js, /msg-zone/);
  assert.match(css, /\.msg-carte-sujet\s*\{[^}]*height:/);
  assert.match(css, /\.msg-corps\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.msg-pastille\s*\{[^}]*transition:\s*transform 0\.3s ease, width 0\.3s ease/);
  assert.match(css, /prefers-reduced-motion[^}]*msg-pastille/);
});
