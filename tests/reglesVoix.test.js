// Tests de la logique pure de la dictee vocale (src/reglesVoix.js) avec une FAUSSE SpeechRecognition : aucun micro reel. Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { detecterReconnaissance, assemblerTexte, messageErreurVoix, creerDictee, nettoyerPhrase, motifSansAPI, MESSAGE_PHRASE_VIDE, MESSAGE_RIEN_RECONNU } from "../src/reglesVoix.js";

class FausseReconnaissance {
  static derniere = null;
  constructor() { FausseReconnaissance.derniere = this; this.demarre = false; this.options = null; }
  start() { if (this.refuse) throw Object.assign(new Error("deja demarre"), { name: "InvalidStateError" }); this.demarre = true; this.onstart && this.onstart(); }
  stop() { this.arrete = true; this.onend && this.onend(); }
  abort() { this.abandonne = true; this.onend && this.onend(); }
  // Simule une liste de resultats : [{ texte, final }]
  dire(resultats) { this.onresult && this.onresult({ results: resultats.map((r) => Object.assign([{ transcript: r.texte }], { isFinal: !!r.final })) }); }
  erreur(code) { this.onerror && this.onerror({ error: code }); this.onend && this.onend(); }
}
function monter(extra = {}) {
  const journal = { champ: extra.champ ?? "", etats: [], erreurs: [] };
  const dictee = creerDictee({
    Reconnaissance: "Reconnaissance" in extra ? extra.Reconnaissance : FausseReconnaissance,
    lire: () => journal.champ,
    ecrire: (t) => { journal.champ = t; },
    surEtat: (e) => journal.etats.push(e),
    surErreur: (m) => journal.erreurs.push(m),
    longueurMax: extra.longueurMax ?? 200
  });
  return { dictee, journal };
}

test("detection : SpeechRecognition standard, sinon webkitSpeechRecognition, sinon rien", () => {
  const A = function () {}; const B = function () {};
  assert.equal(detecterReconnaissance({ SpeechRecognition: A, webkitSpeechRecognition: B }), A);
  assert.equal(detecterReconnaissance({ webkitSpeechRecognition: B }), B);
  assert.equal(detecterReconnaissance({}), null);
  assert.equal(detecterReconnaissance(null), null);
  assert.equal(detecterReconnaissance(undefined), null);
});

test("detection : contexte non securise (http hors localhost) = indisponible", () => {
  assert.equal(detecterReconnaissance({ webkitSpeechRecognition: function () {}, isSecureContext: false }), null);
  assert.ok(detecterReconnaissance({ webkitSpeechRecognition: function () {}, isSecureContext: true }));
});

test("assemblage : base + transcription, espaces propres, borne de longueur", () => {
  assert.equal(assemblerTexte("", "écarte les diffuseurs", 200), "écarte les diffuseurs");
  assert.equal(assemblerTexte("Passe en urgent", " les gaines ", 200), "Passe en urgent les gaines");
  assert.equal(assemblerTexte("  ", "  ", 200), "");
  assert.equal(assemblerTexte("a".repeat(150), "b".repeat(100), 200).length, 200);
});

test("messages d'erreur : jamais muets, sauf l'arret volontaire", () => {
  for (const code of ["not-allowed", "service-not-allowed", "network", "no-speech", "audio-capture", "language-not-supported", "inconnu-xyz"]) {
    for (const ios of [false, true]) {
      const m = messageErreurVoix(code, { ios });
      assert.equal(typeof m, "string", code);
      assert.ok(m.length > 10, code);
      assert.equal(/—|–/.test(m), false, "tiret long dans " + code);
      assert.equal(/, (et|ou) /.test(m), false, "virgule avant et/ou dans " + code);
      assert.equal(m.includes(":"), false, "deux-points dans " + code);
      assert.ok(m.split(/(?<=[.!?])\s+/).length <= 2, "plus de deux phrases dans " + code);
      assert.equal(/\b(error|erreur|code|network|api|SpeechRecognition)\b/i.test(m), false, "jargon dans " + code);
    }
  }
  assert.equal(messageErreurVoix("aborted"), null);
  assert.match(messageErreurVoix("not-allowed"), /autoris/i);
  assert.match(messageErreurVoix("network"), /Chrome/);
  assert.match(messageErreurVoix("no-speech"), /micro/);
  assert.equal(messageErreurVoix("network"), "Ce navigateur n'accepte pas la dictée vocale. Ouvre Ouvra dans Chrome pour l'utiliser.");
  assert.equal(messageErreurVoix("service-not-allowed"), messageErreurVoix("network"));
  assert.equal(messageErreurVoix("not-allowed"), "Le micro est refusé. Autorise-le pour ce site dans le navigateur.");
  assert.doesNotMatch(messageErreurVoix("not-allowed"), /Chrome/); // ouvrir un autre navigateur n'y changerait rien
  // iPhone : tous les navigateurs y utilisent WebKit, proposer Chrome serait trompeur.
  assert.doesNotMatch(messageErreurVoix("network", { ios: true }), /Chrome/);
  assert.match(messageErreurVoix("network", { ios: true }), /réglages/);
});

test("navigateur sans l'API : indisponible, basculer ne fait rien et ne leve rien", () => {
  const { dictee, journal } = monter({ Reconnaissance: null });
  assert.equal(dictee.disponible, false);
  dictee.basculer();
  dictee.arreter();
  assert.deepEqual([journal.etats, journal.erreurs], [[], []]);
});

test("demarrage : etat ecoute, langue fr-FR, resultats provisoires actives, un seul enonce", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  const r = FausseReconnaissance.derniere;
  assert.equal(r.lang, "fr-FR");
  assert.equal(r.interimResults, true);
  assert.equal(r.continuous, false);
  assert.equal(r.demarre, true);
  assert.equal(dictee.ecoute(), true);
  assert.deepEqual(journal.etats, ["ecoute"]);
});

test("texte provisoire puis final remplissent le champ ; rien n'est envoye", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  const r = FausseReconnaissance.derniere;
  r.dire([{ texte: "écarte les", final: false }]);
  assert.equal(journal.champ, "écarte les");
  r.dire([{ texte: "écarte les diffuseurs", final: false }]);
  assert.equal(journal.champ, "écarte les diffuseurs");
  r.dire([{ texte: "écarte les diffuseurs", final: true }]);
  assert.equal(journal.champ, "écarte les diffuseurs");
  r.onend();
  assert.equal(dictee.ecoute(), false);
  assert.deepEqual(journal.etats, ["ecoute", "inactif"]);
  assert.deepEqual(journal.erreurs, []);
});

test("plusieurs segments : finaux puis provisoire concatenes dans l'ordre", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  FausseReconnaissance.derniere.dire([{ texte: "passe en urgent", final: true }, { texte: "les gaines", final: false }]);
  assert.equal(journal.champ, "passe en urgent les gaines");
});

test("le texte deja saisi est conserve (dictee ajoutee a la suite)", () => {
  const { dictee, journal } = monter({ champ: "Passe en urgent" });
  dictee.basculer();
  FausseReconnaissance.derniere.dire([{ texte: "les gaines", final: true }]);
  assert.equal(journal.champ, "Passe en urgent les gaines");
});

test("deux dictees successives repartent du champ courant (pas de cumul fantome)", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  FausseReconnaissance.derniere.dire([{ texte: "un", final: true }]);
  FausseReconnaissance.derniere.onend();
  journal.champ = "un deux"; // l'utilisateur a corrige a la main
  dictee.basculer();
  FausseReconnaissance.derniere.dire([{ texte: "trois", final: true }]);
  assert.equal(journal.champ, "un deux trois");
});

test("second appui pendant l'ecoute : arret (stop), etat inactif", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  const r = FausseReconnaissance.derniere;
  dictee.basculer();
  assert.equal(r.arrete, true);
  assert.equal(dictee.ecoute(), false);
  assert.deepEqual(journal.etats, ["ecoute", "inactif"]);
});

test("permission refusee : message clair, etat inactif", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  FausseReconnaissance.derniere.erreur("not-allowed");
  assert.equal(journal.erreurs.length, 1);
  assert.match(journal.erreurs[0], /autoris/i);
  assert.equal(dictee.ecoute(), false);
});

test("erreur reseau (Brave, hors ligne) : message clair", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  FausseReconnaissance.derniere.erreur("network");
  assert.equal(journal.erreurs.length, 1);
});

test("arret volontaire (aborted) : aucune erreur affichee", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  FausseReconnaissance.derniere.erreur("aborted");
  assert.deepEqual(journal.erreurs, []);
});

test("start() qui leve (deja demarre) : message, etat inactif, pas d'exception", () => {
  class Refuse extends FausseReconnaissance { constructor() { super(); this.refuse = true; } }
  const { dictee, journal } = monter({ Reconnaissance: Refuse });
  assert.doesNotThrow(() => dictee.basculer());
  assert.equal(journal.erreurs.length, 1);
  assert.equal(dictee.ecoute(), false);
});

test("arreter() (panneau ferme) coupe l'ecoute sans message", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  const r = FausseReconnaissance.derniere;
  dictee.arreter();
  assert.equal(r.abandonne, true);
  assert.equal(dictee.ecoute(), false);
  assert.deepEqual(journal.erreurs, []);
});

test("texte dicte borne a la longueur maximale du champ", () => {
  const { dictee, journal } = monter({ longueurMax: 30 });
  dictee.basculer();
  FausseReconnaissance.derniere.dire([{ texte: "x".repeat(100), final: true }]);
  assert.equal(journal.champ.length, 30);
});

test("resultats tardifs apres l'arret ignores (ne reecrivent pas le champ)", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  const r = FausseReconnaissance.derniere;
  dictee.arreter();
  journal.champ = "corrigé à la main";
  r.dire([{ texte: "fantôme", final: true }]);
  assert.equal(journal.champ, "corrigé à la main");
});

// ---- Dictee continue (modale Vocal : l'utilisateur termine en recliquant sur le micro) ----
test("option continu : la reconnaissance ne s'arrete pas d'elle-meme apres une pause", () => {
  const journal = { champ: "", etats: [] };
  const dictee = creerDictee({
    Reconnaissance: FausseReconnaissance, lire: () => journal.champ, ecrire: (t) => { journal.champ = t; },
    surEtat: (e) => journal.etats.push(e), surErreur: () => {}, longueurMax: 200, continu: true
  });
  dictee.basculer();
  assert.equal(FausseReconnaissance.derniere.continuous, true);
});

test("second appui avec du texte reconnu : stop, les resultats finaux arrivent, puis etat inactif", () => {
  const { dictee, journal } = monter();
  dictee.basculer();
  FausseReconnaissance.derniere.dire([{ texte: "ignore les diffuseurs", final: true }]);
  dictee.basculer();
  assert.equal(FausseReconnaissance.derniere.arrete, true);
  assert.equal(journal.champ, "ignore les diffuseurs");
  assert.deepEqual(journal.etats, ["ecoute", "inactif"]);
});

test("phrase : espaces nettoyes, vide devient chaine vide", () => {
  assert.equal(nettoyerPhrase("  passe   en urgent  "), "passe en urgent");
  assert.equal(nettoyerPhrase(null), "");
  assert.equal(nettoyerPhrase("   "), "");
});

test("messages de la modale : ni « Envoyer » ni « Traduire » (boutons qui n'existent plus)", () => {
  for (const m of [MESSAGE_PHRASE_VIDE, MESSAGE_RIEN_RECONNU]) {
    assert.doesNotMatch(m, /Envoyer|Traduire/);
    assert.equal(/—|–/.test(m), false);
  }
  assert.match(MESSAGE_RIEN_RECONNU, /micro/);
});

test("navigateur sans API : un seul motif, message navigateur ; sur iPhone, message sans Chrome", () => {
  assert.equal(motifSansAPI(), "Ce navigateur n'accepte pas la dictée vocale. Ouvre Ouvra dans Chrome pour l'utiliser.");
  assert.doesNotMatch(motifSansAPI(true), /Chrome/);
});
