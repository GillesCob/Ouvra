import test from "node:test";
import assert from "node:assert/strict";
import { WIDGETS, SUGGESTIONS } from "../src/monEspaceDonnees.js";
import { proximite, pastilleDate, trouverCible, creerMemoireDefilement, idVue, phraseModifier, restaurer, widgetsAffiches, widgetDeLaPhrase, lignesJournal, appliquerInstruction, retirerWidget, MESSAGES_ESPACE } from "../src/monEspaceLogique.js";
import { htmlPageEspace } from "../src/monEspaceRendu.js";

const aucun = () => new Set();

test("donnees : six widgets, identifiants et phrases uniques, chaque suggestion rejoue un widget", () => {
  assert.equal(WIDGETS.length, 6);
  assert.equal(new Set(WIDGETS.map((w) => w.id)).size, 6);
  assert.equal(new Set(WIDGETS.map((w) => w.phrase)).size, 6);
  for (const s of SUGGESTIONS) assert.ok(widgetDeLaPhrase(WIDGETS, s), s);
});

test("journal : une ligne par widget affiche, seule la derniere est annulable", () => {
  const l = lignesJournal(WIDGETS, aucun());
  assert.equal(l.length, 6);
  assert.deepEqual(l.map((x) => x.annulable), [false, false, false, false, false, true]);
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
  assert.equal(widgetsAffiches(WIDGETS, a.masques).length, 4);
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

test("rendu : fil d'Ariane interne vers les idees, six widgets, aucun lien vers un fichier .html, aucun marqueur « Mockup », jamais le mot interdit", () => {
  assert.doesNotMatch(htmlPageEspace(), /Ajouté par|Retirer|esp-origine/);
  const h = htmlPageEspace();
  assert.match(h, /<a href="#idees" data-vue="idees">Idées d&#x27;évolution<\/a> › <span aria-current="page">Mon espace<\/span>/);
  assert.equal((h.match(/<section class="esp-widget /g) || []).length, 6);
  assert.doesNotMatch(h, new RegExp("\\.html|Mockup|" + "pe" + "tit", "i"));
  assert.equal((h.match(/data-action="modifier"/g) || []).length, 10, "un stylo par widget et par vue");
  assert.equal((h.match(/data-action="supprimer"/g) || []).length, 10);
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
  assert.equal(phraseModifier("Collision n° 2", true), "Modifie la vue Collision n° 2 : ");
});

test("croix puis Annuler : le retrait d'une vue ne touche pas les widgets et se defait sans modifier l'ancien ensemble", () => {
  assert.equal(idVue("clash-2"), "vue:clash-2");
  const r = retirerWidget(new Set(), idVue("clash-2"));
  assert.equal(lignesJournal(WIDGETS, r.masques).length, 6, "le journal ne liste que des widgets");
  const retabli = restaurer(r.masques, idVue("clash-2"));
  assert.equal(retabli.size, 0);
  assert.equal(r.masques.size, 1);
  assert.equal(restaurer(new Set(), "inconnu").size, 0);
});

test("vues : quatre collisions, rien d'autre que leur identifiant et leur cible", () => {
  const vues = WIDGETS.find((w) => w.id === "vues").items;
  assert.equal(vues.length, 4);
  for (const v of vues) assert.deepEqual(Object.keys(v).sort(), ["cible", "clashId", "id"]);
});

test("rendu : vues sans titre ni instruction ni tuile d'ajout, miniatures JPEG, cartes de collision, todo avec compteur et urgences", () => {
  const h = htmlPageEspace();
  assert.doesNotMatch(h, /Mes points de vue<\/h2>|Instruction (du Viewer|de la page Collision)|Cadrage enregistré|esp-vue-ajout|Ajouter une vue/);
  assert.match(h, /<section class="esp-widget esp-w-vues"[^>]*aria-label="Mes points de vue"/);
  assert.equal((h.match(/<img src="\/images\/vues\/hosp-clash-(2|10|1|5)\.jpg"/g) || []).length, 4);
  assert.equal((h.match(/collision-item collision-item-carte /g) || []).length, 4);
  assert.match(h, /3 à traiter/);
  assert.match(h, /esp-urgence">Aujourd&#x27;hui/);
  assert.match(h, /Demandé par Sophie Lambert/);
  assert.doesNotMatch(h, /esp-vignette|<svg class="esp-vig/);
});

test("rendu : la carte d'une collision reprend la lecture de la liste (types, identifiants, niveau, statut, filet de priorite)", () => {
  const h = htmlPageEspace();
  assert.match(h, /collision-item-carte confirme prio-haute"><span class="collision-num-badge" aria-hidden="true">2<\/span><span class="collision-card-text"><span class="collision-types">Cloison ↔ Gaine<\/span><span class="collision-sub">#753881 ↔ #967393 · Niveau 2<\/span>/);
  assert.match(h, /collision-item-carte confirme prio-urgente"><span class="collision-num-badge" aria-hidden="true">10<\/span>.*Cloison ↔ Prise gaz médicaux.*#564707 ↔ #1129899 · Niveau 3/);
  assert.match(h, /collision-item-carte nouveau prio-haute"><span class="collision-num-badge" aria-hidden="true">1<\/span>/);
  assert.match(h, /collision-item-carte confirme prio-haute"><span class="collision-num-badge" aria-hidden="true">5<\/span>.*Cloison ↔ Tuyau.*#594457 ↔ #1135763 · Niveau 4/);
});

test("donnees : plus aucune personne ni discussion inventee, les noms sont ceux de la messagerie", () => {
  const h = htmlPageEspace();
  assert.doesNotMatch(h, /Camille|Nadir|Inès|Réservations niveau 2|Installation de chantier|Structure et CVC, niveau 3|Notice désenfumage|CCTP lot CVC|Collision n°14/);
  for (const nom of ["Sophie Lambert", "Karim Benali", "Claire Martin", "Collision gaine rectangulaire / cloison, couloir R+2"]) assert.match(h, new RegExp(nom.replace(/[+/]/g, "\\$&")));
  assert.equal((h.match(/class="esp-tache"/g) || []).length, 3);
});

test("donnees : chaque miniature existe, le numero de chaque carte est celui de son identifiant", async () => {
  const { existsSync } = await import("node:fs");
  const { HOSPITAL_CLASHES } = await import("../src/clashesHospital.js");
  for (const v of WIDGETS.find((w) => w.id === "vues").items) {
    assert.ok(existsSync(new URL("../public/images/vues/" + v.clashId + ".jpg", import.meta.url)), v.clashId);
    const clash = HOSPITAL_CLASHES.find((c) => c.id === v.clashId);
    assert.ok(clash, v.clashId);
    assert.equal(HOSPITAL_CLASHES.indexOf(clash) + 1, Number(v.clashId.replace("hosp-clash-", "")));
  }
});

test("donnees : le texte de chaque message cible existe dans le corpus de la messagerie", async () => {
  const { readFileSync } = await import("node:fs");
  const corpus = ["dm", "sujets", "groupes", "coordination"].map((f) => readFileSync(new URL("../src/messagerie/corpus/" + f + ".json", import.meta.url), "utf8")).join("\n");
  const cibles = WIDGETS.flatMap((w) => w.items).filter((i) => i.cible && i.cible.type === "message").map((i) => i.cible);
  assert.equal(cibles.length, 7);
  for (const c of cibles) assert.ok(corpus.includes(c.texte), c.texte);
});

test("alertes : le bouton « Voir » n'existe que sur l'alerte qui a une cible (collision n° 10), jamais sur le document ni la mise a jour de maquette", () => {
  const alertes = WIDGETS.find((w) => w.id === "alertes");
  assert.deepEqual(alertes.items.filter((a) => a.cible).map((a) => a.cible), [{ type: "collision", clashId: "hosp-clash-10" }]);
  const h = htmlPageEspace();
  assert.equal((h.match(/class="esp-btn-voir"/g) || []).length, 1);
  assert.match(h, /Collision n° 10 passée en urgente<\/p><\/div><button type="button" class="esp-btn-voir" data-cible="alerte-collision-10"/);
  assert.match(h, /nomenclature_gaines_R2\.xlsx<\/p><\/div><\/li>/);
  assert.match(h, /passée en V3\.1 par Claire Martin<\/p><\/div><\/li>/);
});

test("documents : les trois pieces jointes citees, aucune GED affirmee", () => {
  const docs = WIDGETS.find((w) => w.id === "documents").items.map((d) => d.texte);
  assert.deepEqual(docs, ["coupe-gaine-cloison-R2.pdf", "nomenclature_gaines_R2.xlsx", "archi-V3.1.ifc"]);
  assert.doesNotMatch(htmlPageEspace(), /\bGED\b/);
});

test("echeances : une seule liste dans l'ordre des dates, quatre lignes, etiquettes Reunion, Modification, Decision, proximite et pastille de date", () => {
  const ech = WIDGETS.find((w) => w.id === "echeances").items;
  assert.equal(ech.length, 4);
  assert.deepEqual(ech.map((e) => e.date), [...ech.map((e) => e.date)].sort());
  const h = htmlPageEspace(WIDGETS, undefined, undefined);
  assert.equal((h.match(/<ol class="esp-echeances">/g) || []).length, 1);
  assert.equal((h.match(/class="esp-echeance"/g) || []).length, 4);
  for (const label of ["Réunion", "Modification", "Décision"]) assert.match(h, new RegExp(">" + label + "</span>"));
  assert.match(h, /esp-label esp-label-decision/);
  assert.equal((h.match(/class="esp-source" data-cible="ech-/g) || []).length, 4, "chaque echeance a une discussion source ouvrable");
});

test("proximite : jours civils, aujourd'hui, demain, passe", () => {
  const lundi = new Date(2026, 10, 2, 23, 30);
  assert.equal(proximite("2026-11-02", lundi), "Aujourd'hui");
  assert.equal(proximite("2026-11-03", lundi), "Demain");
  assert.equal(proximite("2026-11-04", lundi), "Dans 2 jours");
  assert.equal(proximite("2026-11-05", lundi), "Dans 3 jours");
  assert.equal(proximite("2026-11-01", lundi), "Hier");
  assert.equal(proximite("2026-10-30", lundi), "Il y a 3 jours");
  assert.equal(proximite("nimporte", lundi), "");
});

test("pastille de date : jour de la semaine, jour sur deux chiffres, mois abrege", () => {
  assert.deepEqual(pastilleDate("2026-11-05"), { jourSemaine: "jeudi", jour: "05", mois: "nov." });
  assert.deepEqual(pastilleDate("2026-11-02"), { jourSemaine: "lundi", jour: "02", mois: "nov." });
  assert.deepEqual(pastilleDate("x"), { jourSemaine: "", jour: "", mois: "" });
});

test("cibles : retrouvees par identifiant dans tous les widgets, null sans cible", () => {
  assert.deepEqual(trouverCible(WIDGETS, "clash-2"), { type: "collision", clashId: "hosp-clash-2" });
  assert.equal(trouverCible(WIDGETS, "todo-bcf").convId, "karim");
  assert.equal(trouverCible(WIDGETS, "ech-poutre-axe-c").sujetId, "k1");
  assert.equal(trouverCible(WIDGETS, "alerte-document"), null);
  assert.equal(trouverCible(WIDGETS, "inconnu"), null);
});

test("retour : la position memorisee est rendue une seule fois, puis la page s'ouvre en haut ; position invalide ou nulle = haut", () => {
  const m = creerMemoireDefilement();
  assert.equal(m.consommer(), 0);
  m.memoriser(420);
  assert.equal(m.consommer(), 420);
  assert.equal(m.consommer(), 0);
  for (const mauvaise of [0, -5, NaN, undefined, null]) { m.memoriser(mauvaise); assert.equal(m.consommer(), 0); }
});
