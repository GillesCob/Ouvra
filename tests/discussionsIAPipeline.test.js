// Tests du pipeline (src/discussionsIAPipeline.js) et de la verification des sources (moteur) avec de FAUX appels au relais : aucun reseau, aucune cle.
// Regle du proprietaire : aucune information non sourcee. Un numero de message invente est ecarte, un point sans source valide aussi.
import test from "node:test";
import assert from "node:assert/strict";
import { creerPipeline } from "../src/discussionsIAPipeline.js";
import { indexer } from "../src/discussionsIAIndex.js";
import { preparerAnalyse, conclureClassement, conclureRapport, rapportEnTexte, EXTRAIT_MAX, MESSAGE_RIEN, selectionner } from "../src/discussionsIAMoteur.js";
import { fixture, MAINTENANT } from "./aide/fixtureDiscussions.js";

const donnees = fixture();
const index = indexer(donnees.conversations, donnees.personnes);
const nouveau = (surcharge = {}) => {
  const appels = { comprendre: [], analyser: [] };
  const pipeline = creerPipeline({
    lireIndex: () => index,
    maintenant: () => MAINTENANT,
    comprendre: async (corps) => { appels.comprendre.push(corps); return surcharge.comprendre ? surcharge.comprendre(corps) : { ok: false, code: "ia_indisponible", message: "hors ligne" }; },
    analyser: async (corps) => { appels.analyser.push(corps); return surcharge.analyser ? surcharge.analyser(corps) : { ok: false, code: "ia_indisponible", message: "hors ligne" }; }
  });
  return { pipeline, appels };
};
const commande = (action, parametres, relecture = "Relecture.") => async () => ({ ok: true, resultat: "commande", commande: { action, parametres }, relecture });

// ---------- Comprehension ----------
test("pipeline : une phrase exemple est reconnue en local, sans aucun appel", async () => {
  const { pipeline, appels } = nouveau();
  const r = await pipeline.traiter("Montre-moi les discussions non lues");
  assert.equal(r.ok, true);
  assert.equal(appels.comprendre.length + appels.analyser.length, 0);
  assert.deepEqual(r.resultat.fils.map((f) => f.cle).sort(), ["g/", "g/s2"]);
});

test("pipeline : une phrase libre passe par la comprehension ; le relais ne recoit que la phrase et les NOMS", async () => {
  const { pipeline, appels } = nouveau({ comprendre: commande("echanges_avec", { personne: "bob lenoir" }, "Afficher les échanges avec Bob Lenoir.") });
  const r = await pipeline.traiter("tous mes echanges avec Bob");
  assert.equal(r.ok, true);
  assert.equal(r.relecture, "Afficher les échanges avec Bob Lenoir.");
  assert.deepEqual(appels.comprendre[0], { phrase: "tous mes echanges avec Bob", valeurs: { personnes: ["Ana Roux", "Bob Lenoir"] } });
  assert.deepEqual(r.commande.parametres.personne, "Bob Lenoir");
});

test("pipeline : commande inventee par le modele (personne ou action inexistante) -> refusee, rien d'applique", async () => {
  for (const c of [commande("echanges_avec", { personne: "Zoé Inconnue" }), commande("supprimer_tout", {})]) {
    const { pipeline } = nouveau({ comprendre: c });
    const r = await pipeline.traiter("phrase libre");
    assert.equal(r.ok, false);
    assert.ok(r.message);
  }
});

test("pipeline : critere introuvable, non comprise, echec du relais -> message, jamais d'exception", async () => {
  let { pipeline } = nouveau({ comprendre: async () => ({ ok: true, resultat: "critere_introuvable", message: "Personne inconnue." }) });
  assert.match((await pipeline.traiter("x")).message, /Critère introuvable\. Personne inconnue\./);
  ({ pipeline } = nouveau({ comprendre: async () => ({ ok: true, resultat: "non_comprise", message: "Je ne sais pas faire." }) }));
  assert.equal((await pipeline.traiter("x")).message, "Je ne sais pas faire.");
  ({ pipeline } = nouveau());
  assert.deepEqual(await pipeline.traiter("x"), { ok: false, message: "hors ligne" });
  ({ pipeline } = nouveau({ comprendre: async () => { throw new Error("boom"); } }));
  assert.equal((await pipeline.traiter("x")).ok, false);
});

test("pipeline : messagerie vide -> message clair", async () => {
  const pipeline = creerPipeline({ lireIndex: () => indexer([], {}), comprendre: async () => ({ ok: false, message: "x" }), analyser: async () => ({ ok: false, message: "x" }) });
  const r = await pipeline.traiter("Montre-moi les discussions non lues");
  assert.equal(r.ok, false);
  assert.match(r.message, /aucune discussion/);
});

test("pipeline : aucun resultat local -> message, sans appel d'analyse", async () => {
  const { pipeline, appels } = nouveau({ comprendre: commande("echanges_avec", { personne: "Ana Roux", periode: { type: "avant", date: "2020-01-01" } }) });
  const r = await pipeline.traiter("vieux echanges");
  assert.equal(r.ok, false);
  assert.match(r.message, /Aucun échange/);
  assert.equal(appels.analyser.length, 0);
});

// ---------- Recherche par sujet ----------
test("retrouver_echange : l'IA classe, seuls les messages choisis (et existants) sont rendus, extrait surligne", async () => {
  const { pipeline, appels } = nouveau({
    comprendre: commande("retrouver_echange", { sujet: "grue", mots: ["levage"] }),
    analyser: async ({ extraits }) => {
      const premier = extraits.find((e) => e.texte.includes("accès grue"));
      return { ok: true, sortie: { resultats: [{ id: premier.id, pertinence: "forte" }, { id: "M999", pertinence: "forte" }] } };
    }
  });
  const r = await pipeline.traiter("trouve l'echange sur la grue");
  assert.equal(r.ok, true);
  assert.equal(r.type, "liste");
  assert.deepEqual(r.resultat.fils.map((f) => f.cle), ["g/s2"]); // M999 inventé, écarté
  assert.deepEqual(r.resultat.surlignes, ["g/s2#0"]);
  assert.ok(r.resultat.fils[0].extrait.plages.length > 0);
  // Ce qui part vers l'IA : numeros, discussion, auteur, date, texte. Aucune cle de message.
  const envoye = JSON.stringify(appels.analyser[0]);
  assert.equal(envoye.includes("g/s2"), false);
  assert.equal(envoye.includes('"mk"'), false);
  assert.deepEqual(Object.keys(appels.analyser[0].extraits[0]).sort(), ["auteur", "discussion", "id", "quand", "texte"]);
});

test("retrouver_echange : aucun message ne contient le sujet -> pas d'appel a l'IA", async () => {
  const { pipeline, appels } = nouveau({ comprendre: commande("retrouver_echange", { sujet: "piscine olympique" }) });
  const r = await pipeline.traiter("trouve piscine olympique");
  assert.equal(r.ok, false);
  assert.match(r.message, /Aucun message ne parle/);
  assert.equal(appels.analyser.length, 0);
});

test("retrouver_echange : l'IA ne retient rien -> message ; analyse en echec -> repli local signale", async () => {
  let { pipeline } = nouveau({ comprendre: commande("retrouver_echange", { sujet: "grue" }), analyser: async () => ({ ok: true, sortie: { resultats: [] } }) });
  let r = await pipeline.traiter("grue");
  assert.equal(r.ok, false);
  assert.match(r.message, /Aucun échange ne parle clairement/);
  ({ pipeline } = nouveau({ comprendre: commande("retrouver_echange", { sujet: "grue" }), analyser: async () => ({ ok: false, code: "delai", message: "Trop long." }) }));
  r = await pipeline.traiter("grue");
  assert.equal(r.ok, true);
  assert.match(r.repli, /Trop long\. Résultat par mots seulement/);
  assert.ok(r.resultat.fils.length > 0);
});

// ---------- Rapport ----------
const rapportBrut = (ids) => ({
  rien_a_dire: false,
  sections: [
    { titre: "Constat", points: [{ texte: "Le levage est décalé.", confirme: true, sources: [ids[0]] }] },
    { titre: "Inventé", points: [{ texte: "Point sans source valide.", confirme: true, sources: ["M999"] }] },
    { titre: "Incertain", points: [{ texte: "Un report est envisagé.", confirme: false, sources: [ids[1], "M888"] }] }
  ]
});

test("rapport : chaque source est verifiee ; point sans source valide ecarte ; incertain marque ; chronologie triee", async () => {
  let ids = [];
  const { pipeline } = nouveau({
    comprendre: commande("rapport", { sujet: "levage grue" }),
    analyser: async ({ extraits }) => { ids = extraits.map((e) => e.id); return { ok: true, sortie: rapportBrut(ids) }; }
  });
  const r = await pipeline.traiter("fais-moi un rapport sur le levage");
  assert.equal(r.ok, true);
  assert.equal(r.type, "rapport");
  const { rapport } = r;
  assert.equal(rapport.vide, false);
  assert.deepEqual(rapport.sections.map((s) => s.titre), ["Constat", "Incertain"]);
  assert.equal(rapport.ecartes.points, 1);
  assert.equal(rapport.ecartes.sources, 2); // M999 et M888
  assert.equal(rapport.sections[1].points[0].confirme, false);
  assert.equal(rapport.sections[1].points[0].sources.length, 1);
  const quand = rapport.chronologie.map((c) => c.quand);
  assert.deepEqual(quand, quand.slice().sort((a, b) => a - b));
  for (const s of rapport.sections.flatMap((x) => x.points.flatMap((p) => p.sources))) assert.ok(index.parCle.get(s.mk), "source inexistante : " + s.mk);
  // Les discussions citees sont celles des sources.
  assert.ok(r.resultat.fils.every((f) => rapport.chronologie.some((c) => c.mk.startsWith(f.cle + "#"))));
});

test("rapport : rien_a_dire, ou aucun point source -> « Rien n'a ete dit a ce sujet. »", async () => {
  for (const sortie of [{ rien_a_dire: true, sections: [] }, { rien_a_dire: false, sections: [{ titre: "T", points: [{ texte: "x", confirme: true, sources: ["M404"] }] }] }, { rien_a_dire: false, sections: [] }]) {
    const { pipeline } = nouveau({ comprendre: commande("rapport", { sujet: "grue" }), analyser: async () => ({ ok: true, sortie }) });
    const r = await pipeline.traiter("rapport grue");
    assert.equal(r.ok, true);
    assert.equal(r.rapport.vide, true);
    assert.equal(r.rapport.message, MESSAGE_RIEN);
    assert.deepEqual(r.resultat.fils, []);
  }
});

test("rapport : aucun message candidat -> rapport vide SANS appel a l'IA", async () => {
  const { pipeline, appels } = nouveau({ comprendre: commande("rapport", { sujet: "piscine olympique" }) });
  const r = await pipeline.traiter("rapport sur la piscine olympique");
  assert.equal(r.ok, true);
  assert.equal(r.rapport.vide, true);
  assert.equal(r.rapport.message, "Rien n'a été dit à ce sujet.");
  assert.equal(appels.analyser.length, 0);
});

test("rapport : analyse en echec -> erreur, aucun rapport invente ; reponse mal formee -> erreur", async () => {
  let { pipeline } = nouveau({ comprendre: commande("rapport", { sujet: "grue" }), analyser: async () => ({ ok: false, code: "refus", message: "Refusé." }) });
  let r = await pipeline.traiter("rapport grue");
  assert.deepEqual(r, { ok: false, message: "Refusé." });
  ({ pipeline } = nouveau({ comprendre: commande("rapport", { sujet: "grue" }), analyser: async () => ({ ok: true, sortie: { texte: "libre" } }) }));
  r = await pipeline.traiter("rapport grue");
  assert.equal(r.ok, false);
});

// ---------- Moteur : preparation et conclusions ----------
test("preparerAnalyse : numeros M1.., ordre chronologique, texte coupe, aucune cle ni identifiant", () => {
  const long = { ...index.messages[0], mk: "z/#0", texte: "mot ".repeat(300), quand: MAINTENANT + 1000 };
  const s = { messages: [long, ...index.messages.slice(0, 3)], mis: new Set(), scores: null, termes: [], voisins: new Set() };
  const { extraits, table } = preparerAnalyse(s, index);
  assert.deepEqual(extraits.map((e) => e.id), ["M1", "M2", "M3", "M4"]);
  assert.equal(extraits[3].texte.length <= EXTRAIT_MAX + 2, true); // le plus recent, coupe
  assert.ok(extraits.every((e, i) => i === 0 || e.quand >= extraits[i - 1].quand));
  assert.ok(extraits.every((e) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(e.quand)));
  assert.equal(table.get("M4"), long);
  assert.equal(JSON.stringify(extraits).includes("z/#0"), false);
});

test("conclureClassement : doublons et numeros inconnus ecartes, pertinence inconnue -> moyenne, forme invalide -> erreur", () => {
  const table = new Map([["M1", index.messages[0]], ["M2", index.messages[1]]]);
  const r = conclureClassement({ resultats: [{ id: "M2", pertinence: "forte" }, { id: "M2", pertinence: "forte" }, { id: "M7", pertinence: "forte" }, { id: "M1", pertinence: "?" }, null] }, table);
  assert.equal(r.ok, true);
  assert.deepEqual(r.classes.map((c) => [c.entree.mk, c.pertinence]), [[index.messages[1].mk, "forte"], [index.messages[0].mk, "moyenne"]]);
  assert.equal(r.ecartes, 3);
  for (const mauvais of [null, {}, { resultats: "x" }, []]) assert.equal(conclureClassement(mauvais, table).ok, false);
});

test("conclureRapport : texte vide, trop long, titre vide, trop de sources -> ecartes ; sources plafonnees", () => {
  const table = new Map(index.messages.slice(0, 8).map((m, i) => ["M" + (i + 1), m]));
  const ids = Array.from(table.keys());
  const { rapport } = conclureRapport({
    rien_a_dire: false,
    sections: [
      { titre: "Bon", points: [{ texte: "ok", confirme: true, sources: ids }, { texte: "", confirme: true, sources: ["M1"] }, { texte: "x".repeat(401), confirme: true, sources: ["M1"] }] },
      { titre: "   ", points: [{ texte: "titre vide", confirme: true, sources: ["M1"] }] },
      { points: [] }
    ]
  }, table, index, { sujet: "essai" });
  assert.equal(rapport.sections.length, 1);
  assert.equal(rapport.sections[0].points.length, 1);
  assert.equal(rapport.sections[0].points[0].sources.length, 5);
  assert.equal(rapport.titre, "Rapport : essai");
});

test("conclureRapport : confirme absent = non confirme (on ne suppose jamais une certitude)", () => {
  const table = new Map([["M1", index.messages[0]]]);
  const { rapport } = conclureRapport({ rien_a_dire: false, sections: [{ titre: "T", points: [{ texte: "p", sources: ["M1"] }] }] }, table, index, { sujet: "s" });
  assert.equal(rapport.sections[0].points[0].confirme, false);
});

test("rapportEnTexte : sources entre crochets, mention « non confirme », rapport vide", () => {
  const table = new Map([["M1", index.messages[0]], ["M2", index.messages[1]]]);
  const { rapport } = conclureRapport({ rien_a_dire: false, sections: [{ titre: "T", points: [{ texte: "alpha", confirme: true, sources: ["M1"] }, { texte: "beta", confirme: false, sources: ["M2"] }] }] }, table, index, { sujet: "s" });
  const texte = rapportEnTexte(rapport);
  assert.match(texte, /^Rapport : s\n/);
  assert.match(texte, /- alpha \[.+, .+, .+\]/);
  assert.match(texte, /- beta \(non confirmé\) \[/);
  assert.match(texte, /Chronologie des sources/);
  assert.equal(rapportEnTexte({ titre: "Rapport : s", vide: true, message: MESSAGE_RIEN }).trim(), "Rapport : s\n\n" + MESSAGE_RIEN);
});

test("selection par mots : la preselection de rapport reste bornee et ajoute le contexte sans le mettre en evidence", () => {
  const s = selectionner({ action: "rapport", parametres: { sujet: "grue", mots: [], periode: null, personne: null } }, index, { maintenant: MAINTENANT });
  assert.ok(s.messages.length <= 40);
  for (const mk of s.voisins) assert.equal(s.mis.has(mk), false);
  const filtre = selectionner({ action: "retrouver_echange", parametres: { sujet: "grue", mots: [], periode: null, personne: "Ana Roux" } }, index, { maintenant: MAINTENANT });
  assert.ok(filtre.messages.length > 0);
});

test("conclureRapport : un chiffre ou un mois absent des messages cites rend le point non confirme (jamais supprime)", () => {
  const entree = { ...index.messages[0], texte: "La trémie fait 12 cm de trop.", quand: new Date("2026-10-20T10:00:00").getTime() };
  const table = new Map([["M1", entree]]);
  const point = (texte) => ({ texte, confirme: true, sources: ["M1"] });
  const { rapport } = conclureRapport({ rien_a_dire: false, sections: [{ titre: "T", points: [point("La trémie est trop grande de 12 cm."), point("La trémie dépasse de 15 cm."), point("Constaté en octobre."), point("Constaté en mars."), point("Constaté le 20.")] }] }, table, index, { sujet: "s" });
  assert.deepEqual(rapport.sections[0].points.map((p) => p.confirme), [true, false, true, false, true]);
});
