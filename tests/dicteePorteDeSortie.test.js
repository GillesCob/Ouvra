// Porte de sortie plus propre quand la dictee echoue (31/10) : texte du message, micro qui reste utilisable apres un echec passager, bouton
// « Écrire ma demande » mis en avant pendant une erreur. Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MESSAGE_RIEN_RECONNU } from "../src/reglesVoix.js";
import { erreurDefinitive } from "../src/iaSaisieLogique.js";

const source = readFileSync(new URL("../src/iaSaisie.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/iaSaisie.css", import.meta.url), "utf8");

test("le message « rien reconnu » indique la sortie : le micro ou l'ecriture", () => {
  assert.equal(MESSAGE_RIEN_RECONNU, "Rien n'a été reconnu. Appuyer sur le micro, ou écrire la demande.");
});

test("erreurs definitives (micro refuse, absent, langue) = micro desactive ; echecs passagers = micro reste actif", () => {
  for (const code of ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]) assert.equal(erreurDefinitive(code), true, code);
  for (const code of ["no-speech", "network", "inconnu", "aborted", undefined]) assert.equal(erreurDefinitive(code), false, String(code));
});

test("cablage : le micro n'est desactive que pour une erreur definitive", () => {
  assert.match(source, /if \(erreurDefinitive\(code\)\)/);
  assert.ok(!/code !== "no-speech"\) \{ motifVocal/.test(source));
});

test("cablage : « Écrire ma demande » est mis en avant pendant un message d'erreur de la vue vocale", () => {
  assert.match(source, /ecrire\.classList\.toggle\("en-avant"/);
  assert.match(css, /\.regles-ia-bascule\.en-avant/);
});

test("cablage : la fermeture reactive le micro, une erreur du serveur ne met pas l'ecriture en avant", () => {
  assert.match(source, /motifVocal = null; micro\.disabled = false;/);
  assert.match(source, /afficherEtat\(message, true\);\n\s+ecrire\.classList\.remove\("en-avant"\)/);
});
