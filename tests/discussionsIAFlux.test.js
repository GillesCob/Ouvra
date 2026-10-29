// Tests du flux « appliquer puis confirmer ou annuler » (src/discussionsIAFlux.js) avec une FAUSSE messagerie.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerFlux, resumerResultat, MESSAGE_RAPPORT_VIDE } from "../src/discussionsIAFlux.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const retour = (nom, extra = {}) => ({
  ok: true, type: "liste", relecture: "Relecture " + nom, resultat: { fils: [{ cle: nom }], surlignes: ["a", "b"], termes: [] }, ...extra
});
const nouveau = () => {
  const journal = [];
  const messagerie = {
    appliquerFiltreIA: (f) => journal.push(["appliquer", f.relecture, f.type, f.confirme]),
    confirmerFiltreIA: () => journal.push(["confirmer"]),
    retirerFiltreIA: () => journal.push(["retirer"])
  };
  return { flux: creerFlux({ messagerie }), journal };
};

test("proposer : applique tout de suite et rend la relecture et le compte rendu pour le bandeau", () => {
  const { flux, journal } = nouveau();
  const r = flux.proposer(retour("A"), "phrase A");
  assert.deepEqual(r, { ok: true, type: "liste", relecture: "Relecture A", resume: "1 discussion, 2 messages trouvés." });
  assert.deepEqual(journal, [["appliquer", "Relecture A", "liste", false]]); // pas encore confirme : aucun bandeau « Retour » dans la liste
  assert.equal(flux.enAttente(), true);
});

test("proposer : echec ou absence de resultat -> rien n'est applique", () => {
  const { flux, journal } = nouveau();
  assert.deepEqual(flux.proposer({ ok: false, message: "Rien." }), { ok: false, message: "Rien." });
  assert.equal(flux.proposer(null).ok, false);
  assert.deepEqual(journal, []);
  assert.equal(flux.enAttente(), false);
});

test("« Oui » : le filtre reste, plus rien n'attend", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  assert.equal(flux.accepter(), true);
  assert.equal(flux.enAttente(), false);
  assert.equal(flux.accepter(), false);
  assert.deepEqual(journal, [["appliquer", "Relecture A", "liste", false], ["confirmer"]]); // « Oui » : la liste montre alors le bandeau « Retour »
});

test("« Non » sans demande acceptee avant : le filtre est retire et la phrase rendue", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  assert.deepEqual(flux.refuser(), { phrase: "pA" });
  assert.deepEqual(journal.at(-1), ["retirer"]);
  assert.equal(flux.refuser(), null);
});

test("« Non » apres une demande acceptee : la precedente est rappliquee, pas la liste complete", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  flux.accepter();
  flux.proposer(retour("B"), "pB");
  assert.deepEqual(flux.refuser(), { phrase: "pB" });
  assert.deepEqual(journal.at(-1), ["appliquer", "Relecture A", "liste", true]); // deja confirmee : son bandeau « Retour » revient aussitot
});

test("« Tout reafficher » : retire le filtre et oublie le point de retour", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  flux.accepter();
  flux.toutReafficher();
  assert.deepEqual(journal.at(-1), ["retirer"]);
  flux.proposer(retour("B"), "pB");
  flux.refuser();
  assert.deepEqual(journal.at(-1), ["retirer"]); // plus de A a retrouver
});

test("resumerResultat : singulier, pluriel, repli, rapport et rapport vide", () => {
  assert.equal(resumerResultat(retour("A", { resultat: { fils: [{}, {}], surlignes: ["a"] } })), "2 discussions, 1 message trouvé.");
  assert.equal(resumerResultat(retour("A", { resultat: { fils: [{}], surlignes: [] } })), "1 discussion.");
  assert.match(resumerResultat(retour("A", { repli: "Sans l'IA." })), /Sans l'IA\.$/);
  assert.match(resumerResultat(retour("A", { type: "rapport", rapport: { vide: false } })), /Rapport prêt/);
  assert.equal(resumerResultat(retour("A", { type: "rapport", rapport: { vide: true } })), MESSAGE_RAPPORT_VIDE);
});

test("bandeau « Retour » (29/10) : la liste ne le montre qu'apres « Oui » ou « Non », jamais pendant « Est-ce bien votre demande ? »", () => {
  const messagerie = lire("src/messagerie/messagerie.js");
  const bloc = messagerie.slice(messagerie.indexOf("function rendreResultatsIA"), messagerie.indexOf("function appliquerFiltreIA"));
  assert.match(bloc, /!f\.confirme \? "" : '<div class="msg-ia-resume"/);
  assert.ok(messagerie.includes("function confirmerFiltreIA") && /donneesPourIA, appliquerFiltreIA, confirmerFiltreIA/.test(messagerie));
});

test("compte rendu du bandeau « Est-ce bien votre demande ? » (29/10) : sur sa propre ligne, sous la reformulation", () => {
  assert.match(lire("src/discussionsIA.css"), /\.discussions-bandeau-resume \{[^}]*display: block/);
});

test("bandeau « Retour » (29/10) : la demande n'est plus rognee (deux lignes si besoin) et reprend la couleur du texte", () => {
  const css = lire("src/discussionsIA.css");
  const regle = css.match(/\.msg-ia-demande \{[^}]*\}/)[0];
  assert.ok(!/ellipsis|nowrap|overflow: hidden/.test(regle), regle);
  assert.match(regle, /color: var\(--text\)/);
});

test("acceptee() : le retour de la demande validee par « Oui », jamais celui d'une demande refusee", () => {
  const { flux } = nouveau();
  assert.equal(flux.acceptee(), null);
  flux.proposer(retour("A"), "pA");
  assert.equal(flux.acceptee(), null); // en attente : pas encore validee
  flux.accepter();
  assert.equal(flux.acceptee().relecture, "Relecture A");
  flux.proposer(retour("B"), "pB");
  flux.refuser(); // « Non »
  assert.equal(flux.acceptee().relecture, "Relecture A");
});

test("rouvrir : reapplique une recherche gardee, deja confirmee, sans attente ni appel IA", () => {
  const { flux, journal } = nouveau();
  flux.rouvrir({ relecture: "Relecture H", resultat: { fils: [{ cle: "h" }], surlignes: ["a"], termes: [] } });
  assert.deepEqual(journal, [["appliquer", "Relecture H", "liste", true]]);
  assert.equal(flux.enAttente(), false);
  assert.equal(flux.acceptee().relecture, "Relecture H");
});
