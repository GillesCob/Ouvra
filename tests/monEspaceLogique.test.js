import test from "node:test";
import assert from "node:assert/strict";
import { WIDGETS, TEXTES_ESPACE } from "../src/monEspaceDonnees.js";
import { trouverCible, creerMemoireDefilement, idVue, restaurer, widgetsAffiches, lignesJournal, retirerWidget, MESSAGES_ESPACE } from "../src/monEspaceLogique.js";
import { htmlPageEspace } from "../src/monEspaceRendu.js";

const aucun = () => new Set();

test("donnees : six widgets, identifiants et phrases uniques", () => {
  assert.equal(WIDGETS.length, 6);
  assert.equal(new Set(WIDGETS.map((w) => w.id)).size, 6);
  assert.equal(new Set(WIDGETS.map((w) => w.phrase)).size, 6);
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

test("rendu : fil d'Ariane interne vers les idees, six widgets, aucun lien vers un fichier .html, aucun marqueur « Mockup », jamais le mot interdit", () => {
  assert.doesNotMatch(htmlPageEspace(), /Ajouté par|Retirer|esp-origine/);
  const h = htmlPageEspace();
  assert.match(h, /<a href="#idees" data-vue="idees">Idées d&#x27;évolution<\/a> › <span aria-current="page">Mon espace<\/span>/);
  assert.equal((h.match(/<section class="esp-widget /g) || []).length, 6);
  assert.doesNotMatch(h, new RegExp("\\.html|Mockup|" + "pe" + "tit", "i"));
  assert.equal((h.match(/aria-label="Modifier [^"]*"/g) || []).length, 10, "un stylo par widget et par vue (affiche, fige)");
  assert.doesNotMatch(h, /data-action="modifier"/);
  assert.equal((h.match(/data-action="supprimer"/g) || []).length, 10);
  assert.match(h, /aria-label="Modifier Ma todo"/);
  assert.match(h, /aria-label="Supprimer Ma todo"/);
  assert.match(h, /<button type="button" class="esp-btn-principal" disabled aria-disabled="true">Valider<\/button>/);
  assert.match(h, /<details class="esp-journal">/);
});

test("rendu : un widget de type inconnu est refuse", async () => {
  const { htmlWidget } = await import("../src/monEspaceRendu.js");
  assert.throws(() => htmlWidget({ type: "x", id: "a", zone: "a", titre: "t", phrase: "p", items: [] }, 0), /Type de widget inconnu/);
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

test("vues : quatre points de vue enregistres (titre, miniature, cadrage camera), aucune donnee de collision a afficher", () => {
  const vues = WIDGETS.find((w) => w.id === "vues").items;
  assert.equal(vues.length, 4);
  for (const v of vues) assert.deepEqual(Object.keys(v).sort(), ["cible", "id", "miniature", "titre"]);
});

test("rendu : titre de la carte et tuile d'ajout presents, vues sans vocabulaire de collision, miniatures JPEG, todo avec compteur et urgences", () => {
  const h = htmlPageEspace();
  assert.match(h, /<h2>Mes points de vue<\/h2>/);
  assert.match(h, /<button type="button" class="esp-vue-ajout">.*Ajouter une vue<\/button>/);
  assert.equal((h.match(/class="esp-vue-ajout"/g) || []).length, 1);
  assert.doesNotMatch(h, /Instruction (du Viewer|de la page Collision)|Cadrage enregistré/);
  const vues = h.slice(h.indexOf('data-widget="vues"'), h.indexOf('data-widget="alertes"'));
  assert.doesNotMatch(vues, /collision|Collision|statut|Priorité|Urgente|Confirmé|Nouveau/);
  assert.equal((vues.match(/<span class="esp-vue-titre">Point de vue [1-4]<\/span>/g) || []).length, 4);
  assert.equal((vues.match(/<img src="\/images\/mon-espace\/point-de-vue-[1-4]\.jpg"/g) || []).length, 4);
  assert.match(h, /3 à traiter/);
  assert.match(h, /esp-urgence">Aujourd&#x27;hui/);
  assert.match(h, /Demandé par Sophie Lambert/);
  assert.doesNotMatch(h, /esp-vignette|<svg class="esp-vig/);
});

test("rendu : trois taches dans la todo", () => {
  const h = htmlPageEspace();
  assert.equal((h.match(/class="esp-tache"/g) || []).length, 3);
});

test("donnees : chaque miniature existe et chaque point de vue est un cadrage du Viewer sans lien avec une collision", async () => {
  const { existsSync } = await import("node:fs");
  for (const v of WIDGETS.find((w) => w.id === "vues").items) {
    assert.ok(existsSync(new URL("../public" + v.miniature, import.meta.url)), v.miniature);
    assert.equal(v.cible.type, "vue3d");
    assert.deepEqual(Object.keys(v.cible).sort(), ["camera", "type"]);
    assert.deepEqual(Object.keys(v.cible.camera).sort(), ["eye", "look", "up"]);
    for (const k of ["eye", "look", "up"]) assert.ok(v.cible.camera[k].length === 3 && v.cible.camera[k].every(Number.isFinite), k);
    assert.doesNotMatch(JSON.stringify(v), /clash|collision/i, "aucune trace de collision dans " + v.id);
    assert.doesNotMatch(v.miniature, /clash/);
  }
});

test("donnees : le texte de chaque message cible existe dans le corpus de la messagerie", async () => {
  const { readFileSync } = await import("node:fs");
  const corpus = ["dm", "sujets", "groupes", "coordination"].map((f) => readFileSync(new URL("../src/messagerie/corpus/" + f + ".json", import.meta.url), "utf8")).join("\n");
  const cibles = WIDGETS.flatMap((w) => w.items).filter((i) => i.cible && i.cible.type === "message").map((i) => i.cible);
  assert.equal(cibles.length, 11);
  for (const c of cibles) assert.ok(corpus.includes(c.texte), c.texte);
});

test("alertes : « Voir » sur la collision n° 10 et sur le document mis a jour, jamais sur la mise a jour de maquette", () => {
  const alertes = WIDGETS.find((w) => w.id === "alertes");
  assert.deepEqual(alertes.items.filter((a) => a.cible).map((a) => a.id), ["alerte-document", "alerte-collision-10"]);
  const h = htmlPageEspace();
  assert.match(h, /Collision n° 10 passée en urgente<\/p><\/div><button type="button" class="esp-btn-voir" disabled aria-disabled="true"/);
  assert.match(h, /Document mis à jour : nomenclature_gaines_R2\.xlsx<\/p><\/div><button type="button" class="esp-btn-voir" disabled aria-disabled="true" aria-label="Voir : Document mis à jour : nomenclature_gaines_R2\.xlsx">Voir<\/button>/);
  assert.match(h, /passée en V3\.1 par Claire Martin<\/p><\/div><\/li>/);
});

test("documents : les trois pieces jointes citees, aucune GED affirmee, chacune avec un bouton « Voir » vers le message qui la porte", () => {
  const docs = WIDGETS.find((w) => w.id === "documents").items;
  assert.deepEqual(docs.map((d) => d.texte), ["coupe-gaine-cloison-R2.pdf", "nomenclature_gaines_R2.xlsx", "archi-V3.1.ifc"]);
  for (const d of docs) {
    assert.equal(d.cible.type, "message");
    assert.ok(d.cible.texte.includes("[fichier : " + d.texte + "]"), d.texte);
    assert.deepEqual(trouverCible(WIDGETS, d.id), d.cible);
  }
  const h = htmlPageEspace();
  assert.doesNotMatch(h, /\bGED\b/);
  assert.equal((h.match(/class="esp-btn-voir" disabled aria-disabled="true" aria-label="Voir : (coupe|nomenclature|archi)/g) || []).length, 3);
  assert.match(h, /archi-V3\.1\.ifc<\/p><p class="esp-meta">[^<]*<\/p><\/div><span class="esp-heure esp-heure-large">28\/10<\/span><button type="button" class="esp-btn-voir" disabled aria-disabled="true" aria-label="Voir : archi-V3\.1\.ifc">Voir<\/button>/);
});

test("documents : un document sans cible n'a pas de bouton « Voir »", async () => {
  const { htmlWidget } = await import("../src/monEspaceRendu.js");
  const h = htmlWidget({ type: "documents", id: "d", zone: "docs", titre: "Docs", phrase: "p", items: [{ id: "x", texte: "a.pdf", quand: "Hier" }] }, 0);
  assert.doesNotMatch(h, /esp-btn-voir/);
});

test("echeances : une seule liste dans l'ordre des dates, quatre lignes, chacune = un titre et le lien vers sa conversation, rien d'autre", () => {
  const ech = WIDGETS.find((w) => w.id === "echeances").items;
  assert.equal(ech.length, 4);
  assert.deepEqual(ech.map((e) => e.date), [...ech.map((e) => e.date)].sort());
  const h = htmlPageEspace(WIDGETS, undefined, undefined);
  assert.equal((h.match(/<ol class="esp-echeances">/g) || []).length, 1);
  const lignes = h.match(/<li class="esp-echeance">.*?<\/li>/g) || [];
  assert.equal(lignes.length, 4);
  for (const l of lignes) assert.match(l, /^<li class="esp-echeance"><p class="esp-ech-titre">[^<]+<\/p><button type="button" class="esp-source" data-cible="ech-[a-z-]+">[^<]+<\/button><\/li>$/);
  assert.doesNotMatch(h, /esp-label|esp-date|esp-ech-contexte|Réunion<|Modification<|Décision<|Dans \d jours|Aujourd&#x27;hui<\/span><span class="esp-date/);
  assert.match(h, /<button type="button" class="esp-source" data-cible="ech-synthese">Synthèse hebdomadaire<\/button>/);
});

test("compteurs : chaque compteur ouvre la page Collision filtree sur son statut (filtre connu de la page Collision), l'effectif annonce est celui des collisions du filtre", async () => {
  const { FILTRES_COLLISIONS, filtrerCollisions, compterSuivies, resoudreFavoris } = await import("../src/collisionsFavoris.js");
  const { htmlCompteurs } = await import("../src/monEspaceRendu.js");
  const { HOSPITAL_CLASHES } = await import("../src/clashesHospital.js");
  const compteurs = WIDGETS.find((w) => w.id === "collisions").items;
  assert.deepEqual(compteurs.map((c) => c.cible.filtre), ["nouvelles", "en-cours", "urgentes", "resolues"]);
  for (const c of compteurs) {
    assert.equal(c.cible.type, "collisions");
    assert.ok(FILTRES_COLLISIONS.some((f) => f.id === c.cible.filtre), c.cible.filtre);
    assert.deepEqual(trouverCible(WIDGETS, c.id), c.cible);
    assert.equal("valeur" in c, false, "aucune valeur ecrite en dur : " + c.libelle);
  }
  const effectifs = compterSuivies(HOSPITAL_CLASHES, resoudreFavoris([]));
  const h = htmlPageEspace(WIDGETS, undefined, undefined, effectifs);
  for (const c of compteurs) assert.match(h, new RegExp('data-cible="' + c.id + '" aria-label="Voir les collisions suivies : ' + effectifs[c.cible.filtre] + " "), c.libelle);
  // Une etoile retiree change le compteur affiche (meme source : les favoris).
  const moins = compterSuivies(HOSPITAL_CLASHES, resoudreFavoris([{ id: "hosp-clash-1", favori: false }]));
  assert.match(htmlCompteurs(compteurs, moins), /Voir les collisions suivies : 8 nouvelles"><strong>8<\/strong>/);
  assert.equal((h.match(/class="esp-compteur-bouton" data-cible="compteur-/g) || []).length, 4);
  assert.match(h, /<li><button type="button" class="esp-compteur-bouton" data-cible="compteur-en-cours" aria-label="Voir les collisions suivies : 4 en cours"><strong>4<\/strong><span>En cours<\/span><\/button><\/li>/);
  assert.match(h, /<li class="esp-urgent"><button type="button" class="esp-compteur-bouton" data-cible="compteur-urgentes"/);
});

test("cibles : retrouvees par identifiant dans tous les widgets, null sans cible", () => {
  const cadrage1 = trouverCible(WIDGETS, "vue-1");
  assert.equal(cadrage1.type, "vue3d");
  assert.deepEqual(Object.keys(cadrage1).sort(), ["camera", "type"], "aucun identifiant de collision");
  assert.equal(trouverCible(WIDGETS, "todo-bcf").convId, "karim");
  assert.equal(trouverCible(WIDGETS, "ech-poutre-axe-c").sujetId, "k1");
  assert.equal(trouverCible(WIDGETS, "alerte-maquette"), null);
  assert.equal(trouverCible(WIDGETS, "alerte-document").convId, "g-fluides");
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

test("main.js : l'ouverture d'un point de vue ouvre le Viewer et ne touche a aucun element de collision", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const debut = src.indexOf("function ouvrirVue3dDepuisEspace(");
  const corps = src.slice(debut, src.indexOf("\n}\n", debut));
  assert.ok(debut > 0 && corps.includes('l.dataset.view === "viewer"') && corps.includes("cameraFlight.flyTo"));
  assert.doesNotMatch(corps, /activateClash|selectClash|openDetection|openCollision|CLASHES|DETECTIONS|clashId|collisionInfoPanel|Drawer|"collision"/);
  assert.match(src, /if \(cible\.type === "vue3d" \|\| cible\.type === "viewer"\) \{ ouvrirVue3dDepuisEspace\(cible, position\); return; \}/);
});

test("tuile « Ajouter une vue » : ouvre le Viewer tel quel (cible viewer), ne prepare plus aucune phrase dans la barre", async () => {
  const { readFileSync } = await import("node:fs");
  const lire = (f) => readFileSync(new URL("../src/" + f, import.meta.url), "utf8");
  const espace = lire("monEspace.js");
  const ligne = espace.split("\n").find((l) => l.includes('closest(".esp-vue-ajout")'));
  assert.match(ligne, /ouvrir\(\{ type: "viewer" \}/);
  assert.doesNotMatch(ligne, /preparerPhrase/);
  assert.doesNotMatch(lire("monEspaceDonnees.js"), /ajoutVuePhrase|Ajoute une vue :/);
  const main = lire("main.js");
  assert.match(main, /cible\.type === "vue3d" \|\| cible\.type === "viewer"/);
  // Sans cadrage : aucun vol de camera, le bandeau de retour est montre.
  const corps = main.slice(main.indexOf("function ouvrirVue3dDepuisEspace"), main.indexOf("function ouvrirCollisionsFiltrees") );
  assert.match(corps, /if \(!c\) \{\s*retourEspace\.montrer/);
});

test("page figee : barre d'instruction affichee mais desactivee (champ, Valider, micro, suggestions), sans formulaire", () => {
  const h = htmlPageEspace();
  assert.doesNotMatch(h, /<form|type="submit"/);
  assert.match(h, /<input class="esp-champ" type="text" disabled aria-disabled="true" /);
  assert.match(h, /class="esp-micro" disabled aria-disabled="true"/);
  assert.doesNotMatch(h, /aria-pressed/);
  const puces = h.match(/<button type="button" class="esp-puce"[^>]*>/g) || [];
  assert.ok(puces.length > 0);
  for (const b of puces) assert.match(b, /disabled aria-disabled="true"/);
});

test("page figee : aucun bouton « Voir » ni stylo n'est cible d'un clic ; restent actifs les vues, la tuile +, les compteurs, les puces de discussion et la croix", () => {
  const h = htmlPageEspace();
  for (const b of h.match(/<button[^>]*esp-(btn-voir|rond)[^>]*>/g) || []) {
    if (/data-action="supprimer"/.test(b)) continue;
    assert.match(b, /disabled aria-disabled="true"/, b);
    assert.doesNotMatch(b, /data-cible|data-action/, b);
  }
  assert.equal((h.match(/class="esp-vue" data-cible="vue-/g) || []).length, 4);
  assert.equal((h.match(/class="esp-vue-ajout"/g) || []).length, 1);
  assert.equal((h.match(/class="esp-compteur-bouton" data-cible="compteur-/g) || []).length, 4);
  assert.equal((h.match(/class="esp-source" data-cible="/g) || []).length, 7);
  assert.equal((h.match(/data-action="supprimer"/g) || []).length, 10);
});

test("page figee : aucun chemin de code de Mon espace n'atteint l'IA (aucun fetch, XMLHttpRequest, WebSocket, import d'un module IA)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["monEspace.js", "monEspaceRendu.js", "monEspaceLogique.js", "monEspaceDonnees.js"]) {
    const code = readFileSync(new URL("../src/" + f, import.meta.url), "utf8");
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|\/api\/|iaSaisie|discussionsIA|reglesIA|anthropic/i, f);
    assert.doesNotMatch(code, /addEventListener\("(submit|input|keydown)"/, f);
  }
});

test("page : le sous-titre ne promet plus de composer la page en le disant ou en l'ecrivant", () => {
  assert.equal(TEXTES_ESPACE.sousTitre, "Ce que tu consultes souvent, au même endroit.");
  assert.doesNotMatch(htmlPageEspace(), /composes/);
});
