// Envoi automatique du journal de la dictee par mail (31/10) : reutilise POST /api/retour (Resend), type « diagnostic ». Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { corpsDiagnostic, creerEnvoiDiagnostic } from "../src/diagnosticDicteeEnvoi.js";

const LIGNES = ["--- nouvelle ecoute 15:40:01 ---", "+0.00s demarrage continu=true", "+0.02s start", "+3.10s second appui sur le micro", "+3.11s stop demande", "+3.15s end", "+3.16s fin d'ecoute termineParUtilisateur=true car=0 suite=rien"];

test("corps : type diagnostic, motif, navigateur et lignes de la derniere ecoute, borne a 1000 caracteres, e-mail vide", () => {
  const c = corpsDiagnostic({ lignes: LIGNES, motif: "rien reconnu", navigateur: "Mozilla/5.0 Chrome/130" });
  assert.equal(c.type, "diagnostic");
  assert.equal(c.contact, "");
  assert.equal(c.site, "");
  assert.ok(c.message.length <= 1000);
  assert.match(c.message, /rien reconnu/);
  assert.match(c.message, /Chrome\/130/);
  assert.match(c.message, /second appui/);
  const long = corpsDiagnostic({ lignes: Array.from({ length: 400 }, (_, i) => "+" + i + ".00s ligne " + i), motif: "m", navigateur: "n".repeat(500) });
  assert.ok(long.message.length <= 1000);
  assert.match(long.message, /ligne 399/, "les dernieres lignes sont gardees");
});

test("corps : seule la derniere ecoute est envoyee", () => {
  const c = corpsDiagnostic({ lignes: ["--- nouvelle ecoute a ---", "+0s ancienne", "--- nouvelle ecoute b ---", "+0s recente"], motif: "m", navigateur: "n" });
  assert.match(c.message, /recente/);
  assert.doesNotMatch(c.message, /ancienne/);
});

test("envoi : au plus un mail par minute et 5 par session, un echec d'envoi ne leve jamais", async () => {
  let t = 0; const envoyes = [];
  const envoi = creerEnvoiDiagnostic({ envoyer: async (c) => { envoyes.push(c); return { ok: true }; }, maintenant: () => t, navigateur: () => "nav" });
  await envoi.signaler({ lignes: LIGNES, motif: "a" });
  await envoi.signaler({ lignes: LIGNES, motif: "b" });
  assert.equal(envoyes.length, 1, "deuxieme appel dans la minute ignore");
  for (let i = 0; i < 8; i += 1) { t += 61000; await envoi.signaler({ lignes: LIGNES, motif: "c" + i }); }
  assert.equal(envoyes.length, 5, "plafond de 5 par session");
  const casse = creerEnvoiDiagnostic({ envoyer: async () => { throw new Error("reseau"); }, maintenant: () => 0, navigateur: () => "n" });
  await assert.doesNotReject(casse.signaler({ lignes: LIGNES, motif: "x" }));
});

test("envoi : rien a envoyer sans lignes", async () => {
  const envoyes = [];
  const envoi = creerEnvoiDiagnostic({ envoyer: async (c) => { envoyes.push(c); return { ok: true }; }, maintenant: () => 0, navigateur: () => "n" });
  await envoi.signaler({ lignes: [], motif: "x" });
  assert.equal(envoyes.length, 0);
});

test("cablage : un seul compteur pour tous les panneaux IA, envoi de l'erreur differe apres l'evenement de fin", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/iaSaisie.js", import.meta.url), "utf8");
  assert.match(src, /envoiDiag = envoiDiagnosticSession/);
  assert.ok(!src.includes("creerEnvoiDiagnostic()"));
  assert.match(src, /setTimeout\(\(\) => signalerBlocage\("erreur de dictee "/);
});
