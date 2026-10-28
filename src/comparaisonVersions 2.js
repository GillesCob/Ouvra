// Comparaison de deux versions d'une maquette par GUID (prototype pour la demo du 3 novembre). Module pur : aucune interface, aucun reseau, aucune IA.
//
// Principe (decision de Gilles, 16/10) : les regles d'abord, la validation humaine ensuite. Chaque element a un GUID (l'identifiant du metaObject xeokit,
// le GlobalId de l'IFC). Entre deux versions :
//  1. meme GUID dans les deux : « inchange », ou « modifie » si la position ou les dimensions ont change au-dela des tolerances ;
//  2. GUID disparu : on cherche un element NOUVEAU (GUID absent de l'ancienne version) de meme classe IFC et de meme niveau, puis on regarde la position,
//     les dimensions et la famille. Un seul candidat net = « remplace » (meme position et dimensions) ou « deplace » (meme famille et dimensions, autre
//     position) ; plusieurs candidats ou ressemblance partielle = « ambigu » (a trancher par un humain, ou par l'IA plus tard) ; aucun = « disparu ».
//  3. GUID nouveau sans correspondance : « ajoute ».
// Toute proposition (disparu, remplace, deplace, ambigu) porte `validation: "à valider"` : rien n'est declare vrai sans l'humain.
// Sans geometrie (metadonnees JSON seules), la position et les dimensions ne sont pas evaluables : jamais de remplacement automatique, seulement des
// candidats par classe, niveau et famille.
//
// Format d'un element : { id, nom, famille, typeIfc, niveau, boite } comme dans src/quantitatifDonnees.js ; boite = null, [xmin, ymin, zmin, xmax, ymax, zmax]
// en metres, ou fonction qui rend l'un des deux (xeokit calcule l'aabb a la demande).

import { TYPES_SPATIAUX } from "./quantitatif.js";

// Tolerances en metres (valeurs du POC, a regler avec un vrai jeu de maquettes) :
//  position : ecart entre centres de boites sous lequel deux elements sont « a la meme position » ;
//  dimensions : ecart de largeur, profondeur ou hauteur sous lequel deux boites ont « les memes dimensions » ;
//  zone : rayon dans lequel un element de dimensions differentes reste un candidat (a valider) plutot qu'un ajout sans lien.
export const TOLERANCES = Object.freeze({ position: 0.1, dimensions: 0.02, zone: 1 });

function lireBoite(element) {
  let b = element.boite;
  if (typeof b === "function") {
    try { b = b(); } catch { return null; }
  }
  return Array.isArray(b) && b.length === 6 && b.every((v) => typeof v === "number" && Number.isFinite(v)) ? b : null;
}

const centre = (b) => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
const dimensions = (b) => [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const memesDimensions = (d1, d2, tol) => d1.every((v, i) => Math.abs(v - d2[i]) <= tol);

// Elements utilisables : objets avec un id, hors objets spatiaux, GUID en double ignores (le premier est garde).
function preparer(liste) {
  const parId = new Map();
  for (const e of Array.isArray(liste) ? liste : []) {
    if (!e || typeof e !== "object" || e.id === undefined || e.id === null || TYPES_SPATIAUX.has(e.typeIfc) || parId.has(e.id)) continue;
    const boite = lireBoite(e);
    parId.set(e.id, { element: e, boite, centre: boite ? centre(boite) : null, dim: boite ? dimensions(boite) : null });
  }
  return parId;
}

// Compare un element disparu (o) a un element nouveau (n) : null si ce n'est pas un candidat, sinon { sorte, raisons, distance }.
// sorte : « remplace » (position et dimensions), « deplace » (famille et dimensions), « proche » ou « famille » (ressemblance partielle).
function apparier(o, n, tolerances) {
  if (o.element.typeIfc !== n.element.typeIfc) return null;
  const niveaux = [o.element.niveau, n.element.niveau];
  if (niveaux[0] && niveaux[1] && niveaux[0] !== niveaux[1]) return null;
  const famille = !!o.element.famille && o.element.famille === n.element.famille;
  const raisons = ["classe", "niveau"];
  if (!o.boite || !n.boite) {
    if (!famille) return null;
    return { sorte: "famille", raisons: [...raisons, "famille"], distance: null };
  }
  const ecart = distance(o.centre, n.centre);
  const dims = memesDimensions(o.dim, n.dim, tolerances.dimensions);
  const position = ecart <= tolerances.position;
  if (position) raisons.push("position");
  if (dims) raisons.push("dimensions");
  if (famille) raisons.push("famille");
  if (position && dims) return { sorte: "remplace", raisons, distance: ecart };
  if (!position && dims && famille) return { sorte: "deplace", raisons, distance: ecart };
  if (ecart <= tolerances.zone) return { sorte: "proche", raisons, distance: ecart };
  return null;
}

const FORCE = { remplace: 3, deplace: 2, proche: 1, famille: 1 };

// anciens, nouveaux : listes d'elements. Rend { inchanges, modifies, propositions, ajoutes, resume, geometrie }.
export function comparerVersions(anciens, nouveaux, { tolerances = TOLERANCES } = {}) {
  const tol = { ...TOLERANCES, ...tolerances };
  const v1 = preparer(anciens);
  const v2 = preparer(nouveaux);
  const inchanges = [];
  const modifies = [];
  const disparus = [];
  for (const [id, o] of v1) {
    const n = v2.get(id);
    if (!n) { disparus.push(o); continue; }
    const changements = [];
    if (o.boite && n.boite) {
      if (distance(o.centre, n.centre) > tol.position) changements.push("position");
      if (!memesDimensions(o.dim, n.dim, tol.dimensions)) changements.push("dimensions");
    }
    if (changements.length) modifies.push({ id, ancien: o.element, nouveau: n.element, changements });
    else inchanges.push(n.element);
  }
  const nouveauxSeuls = Array.from(v2.values()).filter((n) => !v1.has(n.element.id));

  // Candidats de chaque disparu, indexes par classe pour ne pas croiser toute la maquette.
  const parClasse = new Map();
  for (const n of nouveauxSeuls) {
    if (!parClasse.has(n.element.typeIfc)) parClasse.set(n.element.typeIfc, []);
    parClasse.get(n.element.typeIfc).push(n);
  }
  const candidatsDe = disparus.map((o) => {
    const liste = [];
    for (const n of parClasse.get(o.element.typeIfc) || []) {
      const lien = apparier(o, n, tol);
      if (lien) liste.push({ n, ...lien });
    }
    liste.sort((a, b) => FORCE[b.sorte] - FORCE[a.sorte] || (a.distance ?? 0) - (b.distance ?? 0));
    return liste;
  });
  // Resolution par force decroissante : les remplacements nets d'abord, puis les deplacements, sur les elements nouveaux restants. Un nouvel element deja
  // pris par un lien plus fort n'est plus propose aux autres (sinon un disparu lointain « deplacerait » vers un element deja remplace).
  const pris = new Set();
  const resolus = new Map();
  const libres = (i) => candidatsDe[i].filter((c) => !pris.has(c.n));
  for (const force of [FORCE.remplace, FORCE.deplace]) {
    const lot = [];
    disparus.forEach((_, i) => {
      if (resolus.has(i)) return;
      const liste = libres(i);
      const meilleur = liste[0];
      if (!meilleur || FORCE[meilleur.sorte] !== force) return;
      if (liste.filter((c) => FORCE[c.sorte] === force).length !== 1) return;
      const concurrent = disparus.some((_, j) => j !== i && !resolus.has(j) && libres(j).some((c) => c.n === meilleur.n && FORCE[c.sorte] >= force));
      if (!concurrent) lot.push([i, meilleur]);
    });
    lot.forEach(([i, meilleur]) => { resolus.set(i, meilleur); pris.add(meilleur.n); });
  }

  const propositions = [];
  const appariesAuNouveau = new Set(pris);
  disparus.forEach((o, i) => {
    const retenu = resolus.get(i);
    const liste = retenu ? [retenu] : libres(i);
    const meilleur = liste[0];
    const sorte = retenu ? retenu.sorte : meilleur ? "ambigu" : "disparu";
    liste.forEach((c) => appariesAuNouveau.add(c.n));
    propositions.push({
      sorte,
      ancien: o.element,
      nouveaux: liste.map((c) => c.n.element),
      raisons: meilleur ? meilleur.raisons : [],
      distance: meilleur ? meilleur.distance : null,
      validation: "à valider"
    });
  });

  const ajoutes = nouveauxSeuls.filter((n) => !appariesAuNouveau.has(n)).map((n) => n.element);
  const compte = (s) => propositions.filter((p) => p.sorte === s).length;
  const tous = [...v1.values(), ...v2.values()];
  return {
    inchanges,
    modifies,
    propositions,
    ajoutes,
    geometrie: tous.length > 0 && tous.every((e) => e.boite),
    resume: {
      inchanges: inchanges.length,
      modifies: modifies.length,
      disparus: compte("disparu"),
      remplaces: compte("remplace"),
      deplaces: compte("deplace"),
      ambigus: compte("ambigu"),
      ajoutes: ajoutes.length
    }
  };
}
