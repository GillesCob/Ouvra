// Onglets de la liste des discussions (Individuel | Groupes | IA) : choix de la premiere discussion a ouvrir, onglet IA, et controles statiques du composant.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listeTriee, conversationAOuvrir, ONGLETS } from "../src/messagerie/messagerieDonnees.js";
import { chargerDemo } from "./aide/demoMessagerie.js";
import { fixture } from "./aide/fixtureDiscussions.js";

const demo = await chargerDemo(new Date("2026-10-24T12:00:00"));
const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("onglets : trois, dans l'ordre du groupe de boutons", () => {
  assert.deepEqual(ONGLETS, ["individuel", "groupe", "ia"]);
});

test("listeTriee : non lus d'abord, puis la plus recente ; ne garde que le type demande", () => {
  const individuels = listeTriee(demo.conversations, "individuel");
  assert.ok(individuels.length > 0 && individuels.every((c) => c.type === "individuel"));
  const groupes = listeTriee(demo.conversations, "groupe");
  assert.ok(groupes.length > 0 && groupes.every((c) => c.type === "groupe"));
  assert.equal(listeTriee(demo.conversations, "ia").length, 0);
});

test("conversationAOuvrir : Individuel -> premiere conversation individuelle de la liste (Sophie Lambert dans la demonstration)", () => {
  assert.equal(conversationAOuvrir(demo.conversations, "individuel"), listeTriee(demo.conversations, "individuel")[0].id);
  assert.equal(conversationAOuvrir(demo.conversations, "individuel"), "sophie");
});

test("conversationAOuvrir : Groupes -> premiere conversation de GROUPE de la liste, jamais Sophie Lambert", () => {
  const id = conversationAOuvrir(demo.conversations, "groupe");
  assert.equal(id, listeTriee(demo.conversations, "groupe")[0].id);
  assert.equal(demo.conversations.find((c) => c.id === id).type, "groupe");
  assert.notEqual(id, "sophie");
});

test("conversationAOuvrir : onglet IA, mobile, onglet inconnu ou liste vide -> rien a ouvrir", () => {
  assert.equal(conversationAOuvrir(demo.conversations, "ia"), null);
  assert.equal(conversationAOuvrir(demo.conversations, "individuel", { mobile: true }), null);
  assert.equal(conversationAOuvrir(demo.conversations, "groupe", { mobile: true }), null);
  assert.equal(conversationAOuvrir(demo.conversations, "autre"), null);
  assert.equal(conversationAOuvrir([], "individuel"), null);
  const { conversations } = fixture();
  assert.equal(conversationAOuvrir(conversations.filter((c) => c.type === "individuel"), "groupe"), null);
});

test("conversationAOuvrir : suit l'ordre de la liste (un groupe avec des non lus passe devant)", () => {
  const { conversations } = fixture(); // le groupe « g » a des non lus, pas la conversation « ana »
  assert.equal(conversationAOuvrir(conversations, "groupe"), "g");
  assert.equal(conversationAOuvrir(conversations, "individuel"), "ana");
});

test("composant : IA est le troisieme onglet du meme groupe, sans mise en forme propre", () => {
  const js = lire("src/messagerie/messagerie.js");
  const tablist = js.slice(js.indexOf('<div class="msg-onglets" role="tablist"'), js.indexOf('<div class="msg-ia-panneau"'));
  assert.equal((tablist.match(/role="tab"/g) || []).length, 3);
  assert.ok(tablist.includes('id="discussionsIABtn" data-act="onglet" data-v="ia" aria-selected="false" aria-controls="msgListe"'));
  assert.equal(js.includes("msg-onglets-ligne"), false);
  const css = lire("src/discussionsIA.css") + lire("src/messagerie/messagerie.css");
  assert.equal(css.includes("msg-onglets-ligne"), false);
  assert.equal(/#discussionsIABtn\s*[{,:]/.test(css), false, "aucune regle propre a l'onglet IA");
  assert.equal(css.includes(".msg-filtre-ia"), false);
});

test("composant : l'onglet IA vide le centre, Individuel et Groupes ouvrent leur premiere conversation par clic seulement", () => {
  const js = lire("src/messagerie/messagerie.js");
  assert.ok(js.includes('if (change && onglet === "ia") fermerConversationCourante();'));
  assert.ok(js.includes('choisirOnglet(cible.dataset.v, { ouvrirPremiere: true });'));
  assert.ok(js.includes('if (cible.dataset.v === "ia" && surOngletIA) surOngletIA();')); // clic sur l'onglet IA, meme deja choisi : la saisie s'ouvre
  // Les autres appels (creation d'une conversation ou d'un groupe) ne forcent pas l'ouverture de la premiere conversation.
  assert.equal((js.match(/choisirOnglet\("(individuel|groupe)"\)/g) || []).length >= 3, true);
});

test("panneau IA : plus de choix Texte / Vocal, seulement « Nouvelle demande » (les phrases toutes faites vivent dans la modale)", () => {
  const ia = lire("src/discussionsIA.js");
  const css = lire("src/discussionsIA.css");
  for (const mort of ["discussionsIAChoix", "msg-ia-choix", "choixTexte", "choixVocal", "noteVocal", "majChoixVocal", "rangee"]) {
    assert.equal(ia.includes(mort), false, mort);
    assert.equal(css.includes(mort), false, mort);
  }
  assert.ok(ia.includes('creer("button", "msg-ia-nouvelle", "Nouvelle demande")'));
  assert.ok(ia.includes("panneau.append(nouvelle)"));
  // 28/10 : plus de menu de phrases toutes faites dans le tiroir, ni dans son CSS.
  for (const mort of ["msg-ia-phrases", "msg-ia-phrase\""]) assert.equal(ia.includes(mort), false, mort);
  assert.equal(css.includes(".msg-ia-phrases"), false);
  assert.ok(ia.includes('nouvelle.addEventListener("click", () => { if (!saisie.ouvert()) saisie.ouvrir(); })'));
});

test("modale de demande : la modale COMMUNE des IA (vocal d'abord, bascule texte), pas de copie locale", () => {
  const ia = lire("src/discussionsIA.js");
  assert.ok(ia.includes('import { creerIASaisie, PHRASE_MAX } from "./iaSaisie.js"'));
  assert.ok(ia.includes("saisie.ouvrir()"));
  // Aucune copie de la dictee ni de la modale dans le module des Discussions.
  for (const mort of ["creerDictee", "regles-ia-fond", "micro.focus", "ICONE_MICRO"]) assert.equal(ia.includes(mort), false, mort);
  // L'ecoute ne demarre jamais toute seule a l'ouverture (comportement de la modale commune, garde par tests/iaSaisie.test.js).
  assert.equal(ia.includes("dictee"), false);
  // « Non » du bandeau rouvre la modale en mode texte avec la phrase ecrite (montage) ; les phrases toutes faites sont dans la modale commune.
  assert.ok(ia.includes("reformuler: (phrase) => saisie.reformuler(phrase)"));
  assert.ok(lire("src/discussionsIAMontage.js").includes("ia.reformuler(retour.phrase)"));
});

test("cibles tactiles : « Nouvelle demande » fait au moins 44 px", () => {
  const css = lire("src/discussionsIA.css");
  for (const regle of [".msg-racine .msg-ia-nouvelle {"]) {
    const bloc = css.slice(css.indexOf(regle), css.indexOf("}", css.indexOf(regle)));
    assert.match(bloc, /min-height: 44px/, regle);
  }
});

test("clic sur l'onglet IA : la saisie s'ouvre aussi quand l'onglet est deja choisi, et le montage la rouvre depuis « Nouvelle demande »", () => {
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(montage.includes("function ouvrirSaisie()") && montage.includes("ia.ouvrir()"));
  assert.ok(lire("src/main.js").includes("surOngletIA: () => discussionsIA.ouvrirSaisie()"));
});

test("specificite : les boutons du panneau IA battent « .msg-racine button » (sinon leur couleur est ecrasee selon l'ordre de chargement)", () => {
  const css = lire("src/discussionsIA.css");
  for (const bouton of ["msg-ia-nouvelle"]) {
    assert.equal(new RegExp("(^|\\n)\\." + bouton + "\\s*[{,:]").test(css), false, bouton + " sans .msg-racine");
    assert.ok(css.includes(".msg-racine ." + bouton), bouton);
  }
  assert.match(lire("src/messagerie/messagerie.css"), /\.msg-racine button \{[^}]*color: inherit/);
});
