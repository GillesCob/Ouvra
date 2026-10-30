// Retour au rapport (28/10) : depuis une source du rapport, la discussion s'ouvre au message cite ET un bandeau « ← Retour au rapport » rouvre le MEME rapport,
// sur le modele du bandeau « ← Retour a la conversation » (Viewer) : composant commun src/retourContexte.js, un seul bandeau de retour a la fois.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerCoeurRetour } from "../src/retourContexte.js";
import { creerMemoirePosition } from "../src/discussionsIARapportDefilement.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("la vue du rapport donne le rapport courant au rappel de source (le retour rouvre le meme rapport)", () => {
  assert.ok(lire("src/discussionsIARapportVue.js").includes("surSource(mk, rapportCourant)"));
});

test("montage : un clic sur une source ouvre le message puis montre le bandeau « Retour au rapport » qui rouvre le rapport", () => {
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(montage.includes('id: "discussionsRapportBandeauRetour"'));
  assert.ok(montage.includes("messagerie.montrerMessageIA(mk)"));
  assert.ok(montage.includes('libelle: "Retour au rapport"'));
  assert.ok(montage.includes("rapportVue.ouvrir(rapport, { restaurer: true })"));
  assert.ok(montage.includes("effacerRetour"));
});

test("bandeau : un seul bandeau de retour a la fois (le plus recent gagne) et celui de l'IA « Est-ce bien votre demande ? » prend la place", () => {
  const montage = lire("src/discussionsIAMontage.js");
  for (const classe of ["msg-retour-actif", "regles-retour-actif", "quantitatif-retour-actif", "plan3d-retour-actif", "discussions-confirm-actif"]) assert.ok(montage.includes('"' + classe + '"'), classe);
});

test("main : quitter la page Discussions efface le bandeau de retour au rapport", () => {
  assert.ok(lire("src/main.js").includes('viewName !== "discussions"') && lire("src/main.js").includes("discussionsIA.effacerRetour()"));
});

test("css : le bandeau a le meme placement que les autres bandeaux de retour et la page Discussions descend d'autant", () => {
  const css = lire("src/discussionsIA.css");
  assert.match(css, /#discussionsRapportBandeauRetour,\n#msgBandeauRetourEchanges \{[^}]*position: fixed; top: 52px;[^}]*height: 44px/);
  assert.match(css, /body\.disc-rapport-retour-actif #view-discussions,\nbody\.msg-echanges-retour-actif #view-discussions \{[^}]*padding-top: 44px/);
});

test("coeur : « Retour au rapport » appelle le rappel une seule fois et disparait", () => {
  const coeur = creerCoeurRetour();
  let appels = 0;
  coeur.montrer({ libelle: "Retour au rapport", surRetour: () => { appels += 1; } });
  assert.equal(coeur.actif(), true);
  coeur.declencher();
  coeur.declencher();
  assert.equal(appels, 1);
  assert.equal(coeur.actif(), false);
});

test("panneau de gauche (28/10) : aucun bouton « Voir le rapport » ni action « rapport » ; le rapport s'ouvre seul a la fin de la demande", () => {
  const messagerie = lire("src/messagerie/messagerie.js");
  assert.ok(!messagerie.includes("Voir le rapport</button>") && !messagerie.includes('data-act="ia-rapport"') && !messagerie.includes('case "ia-rapport"'));
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(!montage.includes('nom === "rapport"'));
  assert.match(montage, /application\.type === "rapport"\) \{ rapportEnAttente = retour\.rapport; rapportVue\.ouvrir\(retour\.rapport\); \}/);
  assert.ok(montage.includes('libelle: "Retour au rapport"'));
});

// 29/10 : depuis une source, l'echange s'ouvre directement avec « Retour au rapport » ; jamais la liste des echanges du rapport.
test("source : la question « Est-ce bien votre demande ? » en attente est mise en pause (elle effacait le bandeau « Retour au rapport ») et revient avec le rapport", () => {
  const montage = lire("src/discussionsIAMontage.js");
  const source = montage.slice(montage.indexOf("surSource: (mk, rapport)"), montage.indexOf("retourRapport = creerRetourContexte"));
  assert.ok(source.indexOf("bandeau.masquer(false)") > 0 && source.indexOf("bandeau.masquer(false)") < source.indexOf("retourRapport.montrer"));
  const retour = montage.slice(montage.indexOf("function retourAuRapport"), montage.indexOf("function surRetourSysteme"));
  assert.ok(retour.includes("bandeau.montrer(questionEnPause)") && retour.includes("rapportVue.ouvrir(rapport, { restaurer: true })"));
});

test("retour : la discussion se referme (aucune liste d'echanges intermediaire) puis le meme rapport se rouvre", () => {
  const montage = lire("src/discussionsIAMontage.js");
  const retour = montage.slice(montage.indexOf("function retourAuRapport"), montage.indexOf("function surRetourSysteme"));
  assert.ok(retour.indexOf("messagerie.fermerConversationIA()") < retour.indexOf("rapportVue.ouvrir(rapport, { restaurer: true })"));
  assert.ok(lire("src/messagerie/messagerie.js").includes("fermerConversationIA: fermerConversationCourante"));
});

test("retour du systeme : une entree d'historique est posee a l'ouverture d'une source, popstate ramene au rapport, le bandeau consomme l'entree", () => {
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(montage.includes("history.pushState"));
  assert.ok(montage.includes('addEventListener("popstate", surRetourSysteme)'));
  assert.ok(montage.includes("retourRapport.declencher()"));
  assert.ok(montage.includes("history.back()"));
});

test("mobile : la fleche vers la liste des echanges disparait tant que « Retour au rapport » est visible", () => {
  assert.match(lire("src/discussionsIA.css"), /@media \(max-width: 768px\) \{ body\.disc-rapport-retour-actif \.msg-retour, body\.msg-echanges-retour-actif \.msg-retour \{ display: none; \} \}/);
});

// 29/10, laptop (>= 769 px) : la liste des echanges filtres vit au CENTRE ; un echange ouvert porte « ← Retour aux echanges de ma demande ».
test("laptop : la liste filtree se rend au centre (jamais dans le drawer, ni « Retour » ni titre de la demande) ; mobile garde son bandeau", () => {
  const m = lire("src/messagerie/messagerie.js");
  const bloc = m.slice(m.indexOf("function rendreResultatsIA"), m.indexOf("function appliquerFiltreIA"));
  assert.ok(bloc.includes("if (!mobile())") && bloc.includes("rendreCentreIA()"));
  assert.ok(bloc.includes('data-act="ia-tout"'), "le bandeau Retour reste pour le mobile");
  assert.ok(m.includes("function rendreCentreIA"));
});

test("laptop : un clic sur un echange l'ouvre et pose « ← Retour aux echanges de ma demande » ; le retour rend la liste au centre", () => {
  const m = lire("src/messagerie/messagerie.js");
  assert.ok(m.includes('libelle: "Retour aux échanges de ma demande"'));
  const ouvrir = m.slice(m.indexOf("function ouvrirResultatIA"), m.indexOf("function donneesPourIA") > 0 ? m.indexOf("// Donnees lues par la commande IA") : undefined);
  assert.ok(ouvrir.includes("retourEchanges.montrer") && !ouvrir.includes("if (mobile()) return"), "mobile aussi : meme bandeau");
  assert.ok(m.includes('id: "msgBandeauRetourEchanges"'));
  assert.match(lire("src/discussionsIA.css"), /#msgBandeauRetourEchanges/);
});

test("laptop : les onglets restent visibles en mode resultat (plus de « Retour » pour en sortir), mobile inchange", () => {
  assert.match(lire("src/discussionsIA.css"), /@media \(max-width: 768px\) \{ \.msg-lateral\.msg-ia-resultat \.msg-onglets \{ display: none; \} \}/);
});

test("laptop : la question « Est-ce bien votre demande ? » se met en pause le temps de lire un echange et revient (actions echange-ouvert / echanges-retour)", () => {
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(montage.includes('"echange-ouvert"') && montage.includes('"echanges-retour"'));
  assert.ok(lire("src/messagerie/messagerie.js").includes('surActionIA("echange-ouvert")'));
});

// 30/10 : un rapport n'entre dans « Recherches IA précédentes » qu'après « Oui », comme une recherche d'échanges ; « Non » ou l'abandon n'ajoutent rien.
test("historique : le rapport est ajouté au « Oui » seulement, jamais à l'affichage ni au « Non »", () => {
  const montage = lire("src/discussionsIAMontage.js");
  const proposer = montage.slice(montage.indexOf("proposer: (retour, phrase)"));
  assert.ok(!proposer.includes("ajouterSynthese"));
  const oui = montage.slice(montage.indexOf("surOui: () =>"), montage.indexOf("surNon: () =>"));
  assert.match(oui, /retour\.type === "rapport"\) \{\s*const entree = ajouterSynthese\(retour\.rapport\)[^;]*;\s*ia\.majHistorique\(\);/);
  const non = montage.slice(montage.indexOf("surNon: () =>"), montage.indexOf("const pipeline"));
  assert.ok(!non.includes("ajouterSynthese"));
});

test("flux : seule la demande confirmée expose son rapport (Non et abandon laissent acceptee() vide)", async () => {
  const { creerFlux } = await import("../src/discussionsIAFlux.js");
  const messagerie = { appliquerFiltreIA() {}, confirmerFiltreIA() {}, retirerFiltreIA() {} };
  const rapport = { vide: false };
  const retour = { ok: true, type: "rapport", rapport, resultat: { fils: [], surlignes: [] }, relecture: "r" };
  const non = creerFlux({ messagerie });
  non.proposer(retour, "p"); non.refuser();
  assert.equal(non.acceptee(), null);
  const abandon = creerFlux({ messagerie });
  abandon.proposer(retour, "p");
  assert.equal(abandon.acceptee(), null);
  const oui = creerFlux({ messagerie });
  oui.proposer(retour, "p"); assert.equal(oui.accepter(), true);
  assert.equal(oui.acceptee().rapport, rapport);
});

// 30/10 : « Retour au rapport » retrouve la position de lecture (le rapport est reconstruit, le defilement repartait a zero).
test("position : memorisee au depart vers une source, rendue au retour pour le meme rapport, une seule fois", () => {
  const rapport = { titre: "A" };
  const m = creerMemoirePosition();
  m.memoriser(rapport, 840);
  assert.equal(m.restituer(rapport), 840);
  assert.equal(m.restituer(rapport), 0);
});

test("position : nulle, invalide ou d'un autre rapport = haut", () => {
  const m = creerMemoirePosition();
  m.memoriser({ titre: "A" }, 0);
  assert.equal(m.restituer({ titre: "A" }), 0);
  const a = { titre: "A" };
  m.memoriser(a, 500);
  assert.equal(m.restituer({ titre: "B" }), 0);
  m.memoriser(a, NaN);
  assert.equal(m.restituer(a), 0);
  m.memoriser(a, -20);
  assert.equal(m.restituer(a), 0);
  assert.equal(m.restituer(null), 0);
});

test("position : la vue memorise avant la fermeture et restaure apres le redessin, mobile (ouvrir) et laptop (ouvrirAuCentre) ; ouverture normale = haut", () => {
  const vue = lire("src/discussionsIARapportVue.js");
  const clic = vue.slice(vue.indexOf("const mk = source.dataset.mk"), vue.indexOf("surSource(mk, rapportCourant)"));
  assert.ok(clic.indexOf("memoirePosition.memoriser(rapportCourant, zoneDefilante().scrollTop)") > 0 && clic.indexOf("memoriser") < clic.indexOf("fermer(false)"));
  assert.ok(vue.includes("function ouvrir(rapport, { restaurer = false } = {})"));
  assert.ok(vue.includes("function ouvrirAuCentre(rapport, conteneur, { restaurer = false } = {})"));
  assert.ok(vue.includes("surlignerSource(zoneDefilante(), positionDeLecture(rapport, restaurer))"));
  assert.ok(vue.includes("surlignerSource(corps, positionDeLecture(rapport, restaurer))"));
  const montage = lire("src/discussionsIAMontage.js");
  const retour = montage.slice(montage.indexOf("function retourAuRapport"), montage.indexOf("function surRetourSysteme"));
  assert.ok(retour.includes("montrerRapportAuCentre(rapport, { restaurer: true })") && retour.includes("rapportVue.ouvrir(rapport, { restaurer: true })"));
});

test("source cliquee (30/10) : memorisee avec la position, rendue une seule fois et pour le meme rapport seulement", () => {
  const a = { titre: "A" };
  const m = creerMemoirePosition();
  m.memoriser(a, 300);
  m.memoriserSource(4);
  assert.deepEqual(m.restituerDetail(a), { top: 300, source: 4 });
  assert.deepEqual(m.restituerDetail(a), { top: 0, source: -1 });
  m.memoriser(a, 300);
  m.memoriserSource(2);
  assert.deepEqual(m.restituerDetail({ titre: "B" }), { top: 0, source: -1 });
  m.memoriser(a, 0);
  m.memoriserSource(1);
  m.memoriser(a, 100); // un nouveau depart efface la source precedente
  assert.deepEqual(m.restituerDetail(a), { top: 100, source: -1 });
  m.memoriserSource(-3);
  m.memoriserSource(NaN);
  assert.equal(m.restituerDetail(a).source, -1);
});

test("source cliquee : le clic memorise son rang, le retour la surligne (meme animation que le message source), jamais a l'ouverture normale", () => {
  const vue = lire("src/discussionsIARapportVue.js");
  const clic = vue.slice(vue.indexOf("const mk = source.dataset.mk"), vue.indexOf("surSource(mk, rapportCourant)"));
  assert.ok(clic.includes("memoirePosition.memoriserSource(") && clic.indexOf("memoriserSource") < clic.indexOf("fermer(false)"));
  assert.ok(vue.includes("function positionDeLecture(rapport, restaurer)"));
  assert.ok(vue.includes("memoirePosition.restituerDetail(rapport)"));
  assert.match(vue, /if \(!restaurer\) \{[^}]*memoriser\(null, 0\)/);
  assert.ok(vue.includes("function surlignerSource("));
  const css = lire("src/discussionsIA.css");
  assert.match(css, /\.disc-rapport-source-flash \{[^}]*animation: msg-ia-flash 1\.6s ease-out/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^}]*\.disc-rapport-source-flash/);
});

test("source cliquee : le menu deroulant rouvert au retour ne deplace pas la lecture (toggle ignore une fois)", () => {
  const vue = lire("src/discussionsIARapportVue.js");
  assert.ok(vue.includes("if (menuRouvert) { menuRouvert = false; return; }"));
  assert.ok(vue.includes("menuRouvert = true; menu.open = true;"));
});
