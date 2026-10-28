import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationsDuType, TYPES_CONVERSATION } from "../src/messagerie/groupesConversations.js";

const c = (id, type) => ({ id, type });
const liste = [c("g1", "groupe"), c("i1", "individuel"), c("g2", "groupe"), c("i2", "individuel")];

test("les conversations du type choisi, ordre conserve", () => {
  assert.deepEqual(conversationsDuType(liste, "individuel").map((x) => x.id), ["i1", "i2"]);
  assert.deepEqual(conversationsDuType(liste, "groupe").map((x) => x.id), ["g1", "g2"]);
});

test("type absent ou inconnu : aucune conversation proposee ; liste vide : rien", () => {
  assert.deepEqual(conversationsDuType(liste, ""), []);
  assert.deepEqual(conversationsDuType(liste, null), []);
  assert.deepEqual(conversationsDuType(liste, "autre"), []);
  assert.deepEqual(conversationsDuType([], "groupe"), []);
});

test("deux types, individuelle puis de groupe", () => {
  assert.deepEqual(TYPES_CONVERSATION.map((t) => t.libelle), ["Conversation individuelle", "Conversation de groupe"]);
});

test("dialogue Nouveau sujet : bascule a pastille et zone defilante dans une carte de taille fixe", async () => {
  const fs = await import("node:fs");
  const js = fs.readFileSync(new URL("../src/messagerie/messagerie.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/messagerie/messagerie.css", import.meta.url), "utf8");
  assert.match(js, /msg-bascule-pastille/);
  assert.match(js, /msg-zone/);
  assert.match(css, /\.msg-carte-sujet\s*\{[^}]*height:/);
  assert.match(css, /\.msg-corps\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.msg-bascule-pastille\s*\{[^}]*transition:\s*transform 0\.3s ease, width 0\.3s ease/);
  assert.match(css, /prefers-reduced-motion[^}]*msg-bascule-pastille/);
  assert.doesNotMatch(css, /\.msg-bascule \.msg-pastille/); // la pastille de la bascule n'a plus la classe des pastilles de sujet
});
