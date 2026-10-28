// Tests de la synthese du journal d'usage (tools/usageResume.js) sur des fichiers d'exemple temporaires.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { lireJournal, synthese, formater, lireArguments, RAPPEL } from "../tools/usageResume.js";

const ligne = (o) => JSON.stringify({ horodatage: "2026-10-24T10:00:00.000Z", route: "regles", etape: null, modele: "claude-sonnet-5-5", jetonsEntree: 1000, jetonsSortie: 200, coutDollars: 0.004, dureeMs: 800, statut: "ok", ...o });
const fichier = (contenu) => {
  const f = join(mkdtempSync(join(tmpdir(), "ouvra-resume-")), "appels.jsonl");
  writeFileSync(f, contenu);
  return f;
};
const exemple = [
  ligne({}),
  ligne({ jetonsEntree: 2000, jetonsSortie: 400, coutDollars: 0.008, dureeMs: 1200, horodatage: "2026-10-25T09:00:00.000Z" }),
  ligne({ statut: "refus", jetonsEntree: 500, jetonsSortie: 10, coutDollars: 0.0011 }),
  ligne({ route: "commande" }),
  ligne({ route: "discussions", etape: "comprendre", jetonsEntree: 1000, jetonsSortie: 150, coutDollars: 0.0035 }),
  ligne({ route: "discussions", etape: "rapport", jetonsEntree: 6000, jetonsSortie: 1500, coutDollars: 0.027, dureeMs: 9000 }),
  ligne({ route: "quantitatif", statut: "ia_indisponible", jetonsEntree: null, jetonsSortie: null, coutDollars: null })
].join("\n") + "\n";

test("synthese par route et etape, total et jours", () => {
  const s = synthese(lireJournal(fichier(exemple)));
  const g = Object.fromEntries(s.parRoute.map((r) => [r.cle, r]));
  assert.deepEqual(Object.keys(g), ["commande", "discussions / comprendre", "discussions / rapport", "quantitatif", "regles"]);
  assert.equal(g.regles.appels, 3);
  assert.equal(g.regles.reussis, 2);
  assert.equal(g.regles.erreurs, 1);
  assert.ok(Math.abs(g.regles.coutTotal - 0.0131) < 1e-9);
  assert.equal(g.regles.coutMin, 0.0011);
  assert.equal(g.regles.coutMax, 0.008);
  assert.ok(Math.abs(g.regles.jetonsEntreeMoyen - 3500 / 3) < 1e-9);
  assert.equal(g.quantitatif.coutTotal, null);
  assert.equal(g.quantitatif.jetonsEntreeMoyen, null);
  assert.equal(s.total.appels, 7);
  assert.equal(s.total.erreurs, 2);
  assert.deepEqual(s.parJour.map((j) => [j.cle, j.appels]), [["2026-10-24", 6], ["2026-10-25", 1]]);
});

test("filtres --depuis et --route", () => {
  const l = lireJournal(fichier(exemple));
  assert.equal(synthese(l, { depuis: "2026-10-25" }).total.appels, 1);
  assert.equal(synthese(l, { route: "discussions" }).total.appels, 2);
  assert.equal(synthese(l, { route: "inconnue" }).total.appels, 0);
});

test("fichier absent ou vide : aucun appel, pas d'erreur", () => {
  const absent = join(mkdtempSync(join(tmpdir(), "ouvra-resume-")), "nope.jsonl");
  assert.deepEqual(lireJournal(absent), []);
  assert.deepEqual(lireJournal(fichier("")), []);
  const texte = formater(synthese([]));
  assert.match(texte, /Aucun appel enregistré/);
  assert.match(texte, /console Anthropic/);
});

test("ligne corrompue ignoree avec avertissement", () => {
  const avert = [];
  const l = lireJournal(fichier(ligne({}) + "\n{pas du json\n[1,2]\n\n" + ligne({ route: "commande" }) + "\n"), (m) => avert.push(m));
  assert.equal(l.length, 2);
  assert.equal(avert.length, 2);
  assert.match(avert[0], /ligne 2/);
});

test("rendu texte en francais : tarif non confirmé, rappel final", () => {
  const texte = formater(synthese(lireJournal(fichier(exemple))));
  assert.match(texte, /discussions \/ rapport : 1 appel/);
  assert.match(texte, /tarif non confirmé/);
  assert.match(texte, /Total général : 7 appel/);
  assert.match(texte, /2026-10-24 : 6 appel/);
  assert.ok(texte.endsWith(RAPPEL));
  assert.match(RAPPEL, /maxRetries/);
  assert.ok(!texte.includes("—"));
});

test("arguments et CLI --json", () => {
  assert.deepEqual({ ...lireArguments(["--depuis", "2026-10-24", "--route", "regles", "--json"]), fichier: 0 }, { depuis: "2026-10-24", route: "regles", json: true, fichier: 0 });
  assert.throws(() => lireArguments(["--depuis", "hier"]));
  assert.throws(() => lireArguments(["--bizarre"]));
  const f = fichier(exemple);
  const sortie = JSON.parse(execFileSync(process.execPath, ["tools/usageResume.js", "--json", "--fichier", f], { encoding: "utf8" }));
  assert.equal(sortie.total.appels, 7);
  assert.match(sortie.avertissement, /console Anthropic/);
});
