// 2D -> 3D, IA du plan (25/10) : le flux phrase -> commandes -> plan modifie -> bandeau (src/plan3d/ia/planIAFlux.js), sans navigateur.
import test from "node:test";
import assert from "node:assert/strict";
import { creerFluxPlanIA } from "../src/plan3d/ia/planIAFlux.js";
import { creerModeleVide, ajouterNoeud, ajouterMur, ajouterOuverture, ajouterPiece, ouvertureDe } from "../src/plan3d/modele.js";

function plan() {
  let m = creerModeleVide();
  const n = [];
  for (const [x, y] of [[0, 0], [4, 0], [4, 3], [0, 3]]) { const r = ajouterNoeud(m, x, y); m = r.modele; n.push(r.id); }
  for (let i = 0; i < 4; i++) m = ajouterMur(m, n[i], n[(i + 1) % 4], { type: "exterieur" }).modele;
  m = ajouterOuverture(m, "M1", "fenetre", 1.0).modele;
  m = ajouterPiece(m, "Séjour", [{ x: 0.15, y: 0.15 }, { x: 3.85, y: 0.15 }, { x: 3.85, y: 2.85 }, { x: 0.15, y: 2.85 }]).modele;
  return m;
}
const COMMANDE = { action: "modifier_ouverture", piece: "Séjour", cote: "nord", rang: 1, largeur_cm: 150, hauteur_cm: null, allege_cm: null, genre: null };

// Faux contexte de page : un modele courant, un historique a un niveau, un bandeau.
function contexte(demander, depart = plan()) {
  const etat = { modele: depart, pile: [], bandeau: { visible: false, texte: "" }, appels: 0 };
  const flux = creerFluxPlanIA({
    obtenirModele: () => etat.modele,
    appliquer: (m) => { etat.pile.push(etat.modele); etat.modele = m; flux.surChangement(m); },
    annuler: () => { etat.modele = etat.pile.pop(); flux.surChangement(etat.modele); },
    demander: async (...a) => { etat.appels += 1; return demander(...a); },
    surBandeau: (b) => { etat.bandeau = b; }
  });
  return { flux, etat };
}
const commandes = (liste = [COMMANDE]) => async () => ({ ok: true, resultat: "commandes", commandes: liste });

test("une demande reussie modifie le plan tout de suite (un pas d'historique) et montre le compte rendu du moteur", async () => {
  const { flux, etat } = contexte(commandes());
  const r = await flux.traiter("la fenêtre nord fait 150");
  assert.deepEqual(r, { ok: true });
  assert.equal(ouvertureDe(etat.modele, "O1").largeur, 1.5);
  assert.equal(etat.pile.length, 1);
  assert.equal(etat.bandeau.visible, true);
  assert.match(etat.bandeau.texte, /Fenêtre n°1, côté nord de « Séjour » : largeur 120 → 150 cm\./);
  assert.equal(flux.enAttente(), true);
});

test("« Oui » garde la modification et cache le bandeau", async () => {
  const { flux, etat } = contexte(commandes());
  await flux.traiter("x");
  flux.confirmer();
  assert.equal(etat.bandeau.visible, false);
  assert.equal(etat.pile.length, 1);
  assert.equal(ouvertureDe(etat.modele, "O1").largeur, 1.5);
  assert.equal(flux.enAttente(), false);
});

test("« Non » defait le pas d'historique, cache le bandeau et rend la phrase a redire", async () => {
  const depart = plan();
  const { flux, etat } = contexte(commandes(), depart);
  await flux.traiter("la fenêtre nord fait 150");
  assert.equal(flux.refuser(), "la fenêtre nord fait 150");
  assert.strictEqual(etat.modele, depart);
  assert.equal(etat.bandeau.visible, false);
  assert.equal(flux.refuser(), "", "rien en attente : rien a defaire");
  assert.strictEqual(etat.modele, depart);
});

test("une modification du plan qui n'est pas la notre rend la question sans objet : le bandeau se cache, « Non » ne defait rien", async () => {
  const { flux, etat } = contexte(commandes());
  await flux.traiter("x");
  const apresIA = etat.modele;
  flux.surChangement({ ...apresIA }); // l'utilisateur edite avec un outil
  assert.equal(etat.bandeau.visible, false);
  assert.equal(flux.enAttente(), false);
  assert.equal(flux.refuser(), "");
});

test("refus clairs, plan intact, bandeau cache : sans piece, IA qui ne comprend pas, element introuvable, erreur du relais, commandes impossibles", async () => {
  const sansPiece = contexte(commandes(), creerModeleVide());
  assert.match((await sansPiece.flux.traiter("x")).message, /pas encore de pièce/);
  assert.equal(sansPiece.etat.appels, 0, "aucun appel reseau sans piece");
  for (const reponse of [
    { ok: true, resultat: "non_comprise", message: "Quelle pièce ?" },
    { ok: true, resultat: "element_introuvable", message: "Il n'y a pas de cuisine." },
    { ok: false, code: "ia_indisponible", message: "L'IA est injoignable pour le moment." }
  ]) {
    const { flux, etat } = contexte(async () => reponse);
    const avant = etat.modele;
    const r = await flux.traiter("x");
    assert.deepEqual(r, { ok: false, message: reponse.message });
    assert.strictEqual(etat.modele, avant);
    assert.equal(etat.bandeau.visible, false);
  }
  const impossible = contexte(commandes([{ ...COMMANDE, rang: 9 }]));
  const avant = impossible.etat.modele;
  assert.match((await impossible.flux.traiter("x")).message, /pas d'ouverture n°9/);
  assert.strictEqual(impossible.etat.modele, avant);
  const casse = contexte(async () => { throw new Error("boum"); });
  assert.match((await casse.flux.traiter("x")).message, /injoignable/);
});

test("modale fermee pendant l'attente : rien n'est applique ; plan change pendant l'attente : refus", async () => {
  const ferme = contexte(commandes());
  const r = await ferme.flux.traiter("x", { annule: () => true });
  assert.deepEqual(r, { ok: false, message: "" });
  assert.equal(ferme.etat.pile.length, 0);
  const { flux, etat } = contexte(async () => { etat.modele = { ...etat.modele }; return { ok: true, resultat: "commandes", commandes: [COMMANDE] }; });
  const avant = etat.modele;
  const r2 = await flux.traiter("x");
  assert.match(r2.message, /Le plan a changé pendant la demande/);
  assert.notStrictEqual(etat.modele, avant);
  assert.equal(etat.pile.length, 0);
});

test("une nouvelle demande ferme le bandeau de la precedente", async () => {
  let largeur = 150;
  const { flux, etat } = contexte(async () => ({ ok: true, resultat: "commandes", commandes: [{ ...COMMANDE, largeur_cm: largeur }] }));
  await flux.traiter("x");
  etat.bandeau = { visible: true, texte: "ancien" };
  largeur = 160;
  const r = await flux.traiter("y");
  assert.equal(r.ok, true);
  assert.equal(etat.pile.length, 2);
  assert.notEqual(etat.bandeau.texte, "ancien");
  assert.match(etat.bandeau.texte, /150 → 160 cm/);
});
