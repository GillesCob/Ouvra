// Tests de la logique pure de la dictee vocale (src/reglesVoix.js) avec une FAUSSE SpeechRecognition : aucun micro reel. Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { detecterReconnaissance, assemblerTexte, messageErreurVoix, creerDictee, creerSaisie } from "../src/reglesVoix.js";

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
    const m = messageErreurVoix(code);
    assert.equal(typeof m, "string", code);
    assert.ok(m.length > 10, code);
    assert.equal(/—|–/.test(m), false, "tiret long dans " + code);
  }
  assert.equal(messageErreurVoix("aborted"), null);
  assert.match(messageErreurVoix("not-allowed"), /autoris/i);
  assert.match(messageErreurVoix("network"), /taper|saisis|écris/i);
  assert.match(messageErreurVoix("no-speech"), /Envoyer/);
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

// ---- Modes Texte / Vocal (creerSaisie) ----
function saisie(extra = {}) {
  const j = { champ: extra.champ ?? "", modes: [], messages: [], indispo: [], ecoutes: [] };
  const s = creerSaisie({
    Reconnaissance: "Reconnaissance" in extra ? extra.Reconnaissance : FausseReconnaissance,
    lire: () => j.champ,
    ecrire: (t) => { j.champ = t; },
    surMode: (m) => j.modes.push(m),
    surEcoute: (e) => j.ecoutes.push(e),
    surMessage: (t, erreur) => j.messages.push([t, !!erreur]),
    surIndisponible: (t) => j.indispo.push(t),
    longueurMax: 200
  });
  return { s, j };
}
const dernierMessage = (j) => j.messages.at(-1);

test("saisie : mode Texte par defaut, Vocal disponible si l'API existe", () => {
  const { s } = saisie();
  assert.equal(s.mode(), "texte");
  assert.equal(s.vocalDisponible(), true);
  assert.equal(s.ecoute(), false);
});

test("saisie sans API : Vocal indisponible avec explication, choisir Vocal ne fait rien", () => {
  const { s, j } = saisie({ Reconnaissance: null });
  assert.equal(s.vocalDisponible(), false);
  assert.match(s.motifIndisponible(), /navigateur/);
  s.choisirVocal();
  assert.equal(s.mode(), "texte");
  assert.deepEqual(j.modes, []);
});

test("choisir Vocal : l'ecoute demarre tout de suite (geste utilisateur), champ vide, message d'ecoute", () => {
  const { s, j } = saisie({ champ: "ancien texte" });
  s.choisirVocal();
  assert.equal(s.mode(), "vocal");
  assert.equal(FausseReconnaissance.derniere.demarre, true);
  assert.equal(j.champ, "");
  assert.deepEqual(j.modes, ["vocal"]);
  assert.equal(s.ecoute(), true);
  assert.match(dernierMessage(j)[0], /écoute/);
  assert.equal(dernierMessage(j)[1], false);
});

test("choisir Vocal deux fois : une seule ecoute", () => {
  const { s } = saisie();
  s.choisirVocal();
  const premiere = FausseReconnaissance.derniere;
  s.choisirVocal();
  assert.equal(FausseReconnaissance.derniere, premiere);
});

test("dictee en mode Vocal : le texte reconnu remplit le champ, rien n'est envoye", () => {
  const { s, j } = saisie();
  s.choisirVocal();
  FausseReconnaissance.derniere.dire([{ texte: "écarte les diffuseurs", final: false }]);
  assert.equal(j.champ, "écarte les diffuseurs");
  assert.equal(s.mode(), "vocal");
});

test("Envoyer en mode Vocal avec du texte : ecoute coupee, phrase rendue, retour au mode Texte, texte garde", () => {
  const { s, j } = saisie();
  s.choisirVocal();
  const r = FausseReconnaissance.derniere;
  r.dire([{ texte: "  écarte   les diffuseurs ", final: false }]);
  assert.equal(s.preparerEnvoi(), "écarte les diffuseurs");
  assert.equal(r.abandonne, true);
  assert.equal(s.mode(), "texte");
  assert.equal(j.champ.trim(), "écarte les diffuseurs");
  assert.equal(j.modes.at(-1), "texte");
});

test("Envoyer en mode Vocal sans rien de reconnu : aucun envoi, message clair, ecoute reprise", () => {
  const { s, j } = saisie();
  s.choisirVocal();
  const premiere = FausseReconnaissance.derniere;
  assert.equal(s.preparerEnvoi(), null);
  assert.match(dernierMessage(j)[0], /Rien n'a été reconnu/);
  assert.equal(dernierMessage(j)[1], true);
  assert.equal(s.mode(), "vocal");
  assert.notEqual(FausseReconnaissance.derniere, premiere);
  assert.equal(FausseReconnaissance.derniere.demarre, true);
  assert.equal(s.ecoute(), true);
});

test("Annuler en mode Vocal : ecoute coupee, rien envoye, champ restaure, mode Texte", () => {
  const { s, j } = saisie({ champ: "phrase tapee" });
  s.choisirVocal();
  const r = FausseReconnaissance.derniere;
  r.dire([{ texte: "autre chose", final: false }]);
  s.choisirTexte();
  assert.equal(r.abandonne, true);
  assert.equal(j.champ, "phrase tapee");
  assert.equal(s.mode(), "texte");
  assert.equal(s.ecoute(), false);
});

test("choisir Texte alors qu'on est deja en Texte : sans effet", () => {
  const { s, j } = saisie({ champ: "x" });
  s.choisirTexte();
  assert.equal(j.champ, "x");
  assert.deepEqual(j.modes, []);
});

test("permission refusee : retour automatique au mode Texte, champ restaure, Vocal desactive avec explication", () => {
  const { s, j } = saisie({ champ: "phrase tapee" });
  s.choisirVocal();
  FausseReconnaissance.derniere.erreur("not-allowed");
  assert.equal(s.mode(), "texte");
  assert.equal(j.champ, "phrase tapee");
  assert.equal(s.vocalDisponible(), false);
  assert.match(s.motifIndisponible(), /autoris/i);
  assert.match(j.indispo.at(-1), /autoris/i);
  // La raison n'est affichee qu'une fois (sous le choix du mode) : la zone d'etat est videe, jamais dupliquee.
  assert.deepEqual(dernierMessage(j), ["", false]);
  assert.ok(!j.messages.some(([texte]) => texte === j.indispo.at(-1)));
  s.choisirVocal();
  assert.equal(s.mode(), "texte");
});

test("erreur reseau (Brave...) : meme repli, jamais muet", () => {
  const { s, j } = saisie();
  s.choisirVocal();
  FausseReconnaissance.derniere.erreur("network");
  assert.equal(s.mode(), "texte");
  assert.equal(s.vocalDisponible(), false);
  assert.ok(j.indispo.at(-1).length > 10);
  assert.ok(!j.messages.some(([texte]) => texte === j.indispo.at(-1)), "la raison ne doit pas etre affichee deux fois");
});

test("start() qui leve : retour au mode Texte avec explication", () => {
  class Refuse extends FausseReconnaissance { constructor() { super(); this.refuse = true; } }
  const { s, j } = saisie({ Reconnaissance: Refuse });
  s.choisirVocal();
  assert.equal(s.mode(), "texte");
  assert.ok(j.indispo.length >= 1);
});

test("silence (no-speech) : on reste en mode Vocal, message clair, ecoute arretee", () => {
  const { s, j } = saisie();
  s.choisirVocal();
  FausseReconnaissance.derniere.erreur("no-speech");
  assert.equal(s.mode(), "vocal");
  assert.equal(s.ecoute(), false);
  assert.match(dernierMessage(j)[0], /rien entendu/);
  assert.equal(dernierMessage(j)[1], true);
  assert.equal(s.vocalDisponible(), true);
});

test("fin naturelle de l'ecoute avec du texte : on reste en Vocal, le message d'ecoute disparait, envoi possible", () => {
  const { s, j } = saisie();
  s.choisirVocal();
  const r = FausseReconnaissance.derniere;
  r.dire([{ texte: "gaines en urgent", final: true }]);
  r.onend();
  assert.equal(s.mode(), "vocal");
  assert.equal(s.ecoute(), false);
  assert.equal(dernierMessage(j)[0], "");
  assert.equal(s.preparerEnvoi(), "gaines en urgent");
});

test("fermeture du panneau, page en arriere-plan : micro coupe, champ restaure, mode Texte, refus oublie", () => {
  const { s, j } = saisie({ champ: "tapé" });
  s.choisirVocal();
  const r = FausseReconnaissance.derniere;
  s.fermer();
  assert.equal(r.abandonne, true);
  assert.equal(s.mode(), "texte");
  assert.equal(j.champ, "tapé");
  const b = saisie();
  b.s.choisirVocal();
  FausseReconnaissance.derniere.erreur("not-allowed");
  assert.equal(b.s.vocalDisponible(), false);
  b.s.fermer();
  assert.equal(b.s.vocalDisponible(), true);
});

test("fermer sans API ne change pas le motif d'indisponibilite", () => {
  const { s } = saisie({ Reconnaissance: null });
  s.fermer();
  assert.equal(s.vocalDisponible(), false);
});

test("mode Texte : envoi d'une phrase vide = aucun envoi + message ; phrase normale nettoyee", () => {
  const { s, j } = saisie({ champ: "   " });
  assert.equal(s.preparerEnvoi(), null);
  assert.equal(dernierMessage(j)[1], true);
  assert.match(dernierMessage(j)[0], /Écris la règle/);
  j.champ = "  passe   en urgent  ";
  assert.equal(s.preparerEnvoi(), "passe en urgent");
});

test("la dictee n'envoie jamais toute seule : aucun rappel d'envoi n'existe, preparerEnvoi est la seule sortie de phrase", () => {
  const { s } = saisie();
  s.choisirVocal();
  FausseReconnaissance.derniere.dire([{ texte: "a", final: true }]);
  FausseReconnaissance.derniere.onend();
  assert.equal(typeof s.envoyer, "undefined");
});
