import test from "node:test";
import assert from "node:assert/strict";
import { WIDGETS, SUGGESTIONS } from "../src/monEspaceDonnees.js";
import { idVue, phraseModifier, restaurer, widgetsAffiches, widgetDeLaPhrase, lignesJournal, appliquerInstruction, retirerWidget, MESSAGES_ESPACE } from "../src/monEspaceLogique.js";
import { htmlPageEspace } from "../src/monEspaceRendu.js";

const aucun = () => new Set();

test("donnees : cinq widgets, identifiants et phrases uniques, chaque suggestion rejoue un widget", () => {
  assert.equal(WIDGETS.length, 5);
  assert.equal(new Set(WIDGETS.map((w) => w.id)).size, 5);
  assert.equal(new Set(WIDGETS.map((w) => w.phrase)).size, 5);
  for (const s of SUGGESTIONS) assert.ok(widgetDeLaPhrase(WIDGETS, s), s);
});

test("journal : une ligne par widget affiche, seule la derniere est annulable", () => {
  const l = lignesJournal(WIDGETS, aucun());
  assert.equal(l.length, 5);
  assert.deepEqual(l.map((x) => x.annulable), [false, false, false, false, true]);
  assert.equal(l[0].phrase, "« Montre mes vues du niveau 2 »");
});

test("journal : tout retire = aucune ligne ; un seul reste = il est annulable", () => {
  const tous = new Set(WIDGETS.map((w) => w.id));
  assert.deepEqual(lignesJournal(WIDGETS, tous), []);
  tous.delete("todo");
  const l = lignesJournal(WIDGETS, tous);
  assert.equal(l.length, 1);
  assert.equal(l[0].annulable, true);
});

test("retirer : ajoute au masque sans modifier l'ancien ensemble ; annuler retire le dernier affiche", () => {
  const avant = aucun();
  const r = retirerWidget(avant, "alertes");
  assert.equal(avant.size, 0);
  assert.ok(r.masques.has("alertes"));
  assert.equal(r.message, MESSAGES_ESPACE.retire);
  const dernier = lignesJournal(WIDGETS, r.masques).filter((x) => x.annulable)[0];
  assert.equal(dernier.id, "collisions");
  const a = retirerWidget(r.masques, dernier.id, MESSAGES_ESPACE.annulee);
  assert.equal(a.message, "Dernière instruction annulée.");
  assert.equal(widgetsAffiches(WIDGETS, a.masques).length, 3);
});

test("instruction : phrase connue = le widget revient (espaces autour ignores) ; vide = message sans vider le champ ; inconnue = message et champ vide", () => {
  const masques = new Set(["vues", "todo"]);
  const ok = appliquerInstruction(WIDGETS, masques, "  Montre mes vues du niveau 2  ");
  assert.equal(ok.masques.has("vues"), false);
  assert.equal(ok.masques.has("todo"), true);
  assert.equal(masques.has("vues"), true, "l'ancien ensemble n'est pas modifie");
  assert.equal(ok.message, "Fait : Montre mes vues du niveau 2");
  assert.equal(ok.vider, true);
  const vide = appliquerInstruction(WIDGETS, masques, "   ");
  assert.equal(vide.message, MESSAGES_ESPACE.vide);
  assert.equal(vide.vider, false);
  assert.equal(vide.masques, masques);
  const inconnue = appliquerInstruction(WIDGETS, masques, "fais du cafe");
  assert.equal(inconnue.message, MESSAGES_ESPACE.inconnue);
  assert.equal(inconnue.vider, true);
  assert.equal(appliquerInstruction(WIDGETS, masques, undefined).message, MESSAGES_ESPACE.vide);
  assert.equal(widgetDeLaPhrase(WIDGETS, null), null);
});

test("instruction deja affichee : rien ne change, message « Fait »", () => {
  const r = appliquerInstruction(WIDGETS, aucun(), "Compte mes collisions par statut");
  assert.equal(r.masques.size, 0);
  assert.match(r.message, /^Fait : /);
});

test("rendu : fil d'Ariane interne vers les idees, cinq widgets, aucun lien vers un fichier .html, aucun marqueur « Mockup », jamais le mot interdit", () => {
  assert.doesNotMatch(htmlPageEspace(), /Ajouté par|Retirer|esp-origine/);
  const h = htmlPageEspace();
  assert.match(h, /<a href="#idees" data-vue="idees">Idées d&#x27;évolution<\/a> › <span aria-current="page">Mon espace<\/span>/);
  assert.equal((h.match(/<section class="esp-widget /g) || []).length, 5);
  assert.doesNotMatch(h, new RegExp("\\.html|Mockup|" + "pe" + "tit", "i"));
  assert.equal((h.match(/data-action="modifier"/g) || []).length, 8, "un stylo par widget et par vue");
  assert.equal((h.match(/data-action="supprimer"/g) || []).length, 8);
  assert.match(h, /aria-label="Modifier Ma todo"/);
  assert.match(h, /aria-label="Supprimer Ma todo"/);
  assert.match(h, /<button type="submit" class="esp-btn-principal">Valider<\/button>/);
  assert.match(h, /<details class="esp-journal">/);
});

test("rendu : un widget de type inconnu est refuse", async () => {
  const { htmlWidget } = await import("../src/monEspaceRendu.js");
  assert.throws(() => htmlWidget({ type: "x", id: "a", zone: "a", titre: "t", phrase: "p", items: [] }, 0), /Type de widget inconnu/);
});

test("stylo : la phrase preparee nomme le widget ou la vue et se termine par deux points et une espace", () => {
  assert.equal(phraseModifier("Ma todo"), "Modifie Ma todo : ");
  assert.equal(phraseModifier("Gaines niveau 2", true), "Modifie la vue Gaines niveau 2 : ");
});

test("croix puis Annuler : le retrait d'une vue ne touche pas les widgets et se defait sans modifier l'ancien ensemble", () => {
  assert.equal(idVue("gaines"), "vue:gaines");
  const r = retirerWidget(new Set(), idVue("gaines"));
  assert.equal(lignesJournal(WIDGETS, r.masques).length, 5, "le journal ne liste que des widgets");
  const retabli = restaurer(r.masques, idVue("gaines"));
  assert.equal(retabli.size, 0);
  assert.equal(r.masques.size, 1);
  assert.equal(restaurer(new Set(), "inconnu").size, 0);
});

test("vues : chaque instruction est une phrase deja acceptee par le Viewer (src/commandesExemples.js)", async () => {
  const { EXEMPLES_COMMANDES } = await import("../src/commandesExemples.js");
  const phrases = new Set(EXEMPLES_COMMANDES.map((e) => e.demande));
  const vues = WIDGETS.find((w) => w.id === "vues").items;
  assert.ok(vues.length >= 3 && vues.length <= 4);
  for (const v of vues) assert.ok(phrases.has(v.instruction), v.instruction);
});

test("rendu : tuile d'ajout sans boutons, vignettes SVG, mentions de chaque vue, todo avec compteur et urgences", () => {
  const h = htmlPageEspace();
  assert.match(h, /<button type="button" class="esp-vue-ajout">.*Ajouter une vue<\/button>/);
  assert.equal((h.match(/class="esp-vue-ajout"/g) || []).length, 1);
  assert.equal((h.match(/<svg class="esp-vignette"/g) || []).length, 3);
  assert.equal((h.match(/Instruction du Viewer/g) || []).length, 3);
  assert.equal((h.match(/Cadrage enregistré/g) || []).length, 3);
  assert.match(h, /3 à traiter/);
  assert.match(h, /esp-urgence">Aujourd&#x27;hui/);
  assert.match(h, /Demandé par Camille/);
  assert.doesNotMatch(h, new RegExp("<img|" + "pe" + "tit", "i"));
});
