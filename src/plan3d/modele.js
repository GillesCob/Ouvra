// 2D -> 3D (25/10) : le modele intermediaire, SOURCE DE VERITE de la page. Le plan 2D, la maquette 3D (et plus tard l'IFC) en sont derives.
// Module pur : aucune dependance au DOM ni a Three.js, toutes les fonctions rendent un NOUVEAU modele (le modele recu n'est jamais modifie).
//
// Un modele : { unite: "m", fond, niveau, noeuds, murs, ouvertures, pieces }
//   fond      : { echelle, x, y } position de l'image du plan dans le repere du modele (metres par pixel de l'image), ou null
//   niveau    : { nom, hauteur, epaisseurDalle } (un seul niveau pour la premiere version)
//   noeuds    : [{ id, x, y }] en metres, y vers le bas (comme l'ecran)
//   murs      : [{ id, a, b, epaisseur, type: "exterieur" | "interieur", confiance? }] a et b sont des ids de noeuds : des murs qui
//               partagent un noeud restent connectes quand le noeud bouge (angles et T suivent une modification de cote)
//   ouvertures: [{ id, mur, genre: "porte" | "fenetre" | "coulissante", decalage, largeur, hauteur, allege, confiance? }] decalage = distance en metres
//               depuis le noeud a du mur : l'ouverture suit son mur quand il change
//   pieces    : [{ id, nom, contour: [{x, y}], surfacePlan }] contour = polygone du VIDE de la piece (faces interieures des murs), en metres ;
//               surfacePlan = surface lue sur le plan en m2 (ou null), gardee a cote de la surface calculee pour controle. Une piece devient un
//               IfcSpace a l'export. Son contour est independant des noeuds : deplacer un mur ne deplace pas la piece (a retoucher a la main).
//   infos     : facultatif sur un mur, une ouverture, une piece : [{ cle, valeur }] informations libres
//               ajoutees par l'utilisateur (texte). Elles partent dans l'IFC, jeu de proprietes « Ouvra_Infos » de l'element.

const GENRES = ["porte", "fenetre", "coulissante"];
export const TYPES_MUR = ["exterieur", "interieur"];
const EPAISSEUR_DEFAUT = { exterieur: 0.3, interieur: 0.1 };
const OUVERTURE_DEFAUT = {
  porte: { largeur: 0.9, hauteur: 2.1, allege: 0 },
  fenetre: { largeur: 1.2, hauteur: 1.25, allege: 0.95 },
  coulissante: { largeur: 1.6, hauteur: 2.1, allege: 0 }
};
const LONGUEUR_MIN = 0.05;

export function creerModeleVide() {
  return { unite: "m", fond: null, niveau: { nom: "RDC", hauteur: 2.5, epaisseurDalle: 0.2 }, noeuds: [], murs: [], ouvertures: [], pieces: [] };
}

const copie = (modele) => JSON.parse(JSON.stringify(modele));
const nombreFini = (v) => typeof v === "number" && Number.isFinite(v);

function prochainId(liste, prefixe) {
  let max = 0;
  for (const el of liste) {
    const n = Number(String(el.id).slice(prefixe.length));
    if (String(el.id).startsWith(prefixe) && Number.isInteger(n) && n > max) max = n;
  }
  return prefixe + (max + 1);
}

export const noeudDe = (modele, id) => modele.noeuds.find((n) => n.id === id) || null;
export const murDe = (modele, id) => modele.murs.find((m) => m.id === id) || null;
export const ouvertureDe = (modele, id) => modele.ouvertures.find((o) => o.id === id) || null;

// Extremites d'un mur : { a: {x,y}, b: {x,y} } ou null si un noeud manque.
export function extremites(modele, mur) {
  const a = noeudDe(modele, mur.a);
  const b = noeudDe(modele, mur.b);
  return a && b ? { a, b } : null;
}

export function longueurMur(modele, mur) {
  const e = extremites(modele, mur);
  return e ? Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) : 0;
}

// Refuse un modele inutilisable (importe d'un fichier, ou rendu un jour par une IA) : on ne dessine jamais un modele casse.
// Rend { valide, erreurs: [texte] }.
export function validerModele(modele) {
  const erreurs = [];
  if (!modele || typeof modele !== "object") return { valide: false, erreurs: ["Le modèle n'est pas un objet."] };
  const { noeuds, murs, ouvertures, niveau } = modele;
  if (!Array.isArray(noeuds) || !Array.isArray(murs) || !Array.isArray(ouvertures)) return { valide: false, erreurs: ["noeuds, murs et ouvertures doivent être des listes."] };
  if (!niveau || !nombreFini(niveau.hauteur) || niveau.hauteur <= 0 || !nombreFini(niveau.epaisseurDalle) || niveau.epaisseurDalle < 0) erreurs.push("Le niveau a une hauteur ou une dalle invalide.");
  const ids = new Set();
  for (const n of noeuds) {
    if (typeof n.id !== "string" || !nombreFini(n.x) || !nombreFini(n.y)) erreurs.push(`Nœud invalide : ${JSON.stringify(n)}`);
    else if (ids.has(n.id)) erreurs.push(`Nœud en double : ${n.id}`);
    else ids.add(n.id);
  }
  const idsMurs = new Set();
  for (const m of murs) {
    if (typeof m.id !== "string" || !ids.has(m.a) || !ids.has(m.b) || m.a === m.b) erreurs.push(`Mur invalide : ${m.id}`);
    else if (!nombreFini(m.epaisseur) || m.epaisseur <= 0) erreurs.push(`Épaisseur invalide : ${m.id}`);
    else if (!TYPES_MUR.includes(m.type)) erreurs.push(`Type de mur inconnu : ${m.id}`);
    else if (idsMurs.has(m.id)) erreurs.push(`Mur en double : ${m.id}`);
    else idsMurs.add(m.id);
  }
  for (const o of ouvertures) {
    if (typeof o.id !== "string" || !idsMurs.has(o.mur) || !GENRES.includes(o.genre)) erreurs.push(`Ouverture invalide : ${o.id}`);
    else if (![o.decalage, o.largeur, o.hauteur, o.allege].every(nombreFini) || o.largeur <= 0 || o.hauteur <= 0 || o.decalage < 0 || o.allege < 0) erreurs.push(`Mesures invalides : ${o.id}`);
    else if (o.decalage + o.largeur > longueurMur(modele, murDe(modele, o.mur)) + 1e-6) erreurs.push(`Ouverture hors du mur : ${o.id}`);
  }
  const infosInvalides = (liste) => liste != null && (!Array.isArray(liste) || liste.some((i) => !i || typeof i.cle !== "string" || !i.cle.trim() || typeof i.valeur !== "string"));
  for (const el of [...murs, ...ouvertures, ...(modele.pieces || [])]) if (infosInvalides(el.infos)) erreurs.push(`Informations invalides : ${el.id}`);
  const idsPieces = new Set();
  for (const pc of modele.pieces || []) {
    const ok = typeof pc.id === "string" && typeof pc.nom === "string" && Array.isArray(pc.contour) && pc.contour.length >= 3 && pc.contour.every((q) => nombreFini(q.x) && nombreFini(q.y));
    if (!ok) erreurs.push(`Pièce invalide : ${pc.id}`);
    else if (idsPieces.has(pc.id)) erreurs.push(`Pièce en double : ${pc.id}`);
    else if (pc.surfacePlan != null && (!nombreFini(pc.surfacePlan) || pc.surfacePlan <= 0)) erreurs.push(`Surface invalide : ${pc.id}`);
    else idsPieces.add(pc.id);
  }
  return { valide: erreurs.length === 0, erreurs };
}

// Surface d'un polygone (formule des lacets), en m2, toujours positive. Moins de 3 points : 0.
export function surfaceContour(contour) {
  if (!Array.isArray(contour) || contour.length < 3) return 0;
  let somme = 0;
  for (let i = 0; i < contour.length; i++) {
    const p = contour[i];
    const q = contour[(i + 1) % contour.length];
    somme += p.x * q.y - q.x * p.y;
  }
  return Math.abs(somme) / 2;
}

// ---- Edition ----

export function ajouterNoeud(modele, x, y) {
  const m = copie(modele);
  const id = prochainId(m.noeuds, "N");
  m.noeuds.push({ id, x, y });
  return { modele: m, id };
}

export function deplacerNoeud(modele, id, x, y) {
  const m = copie(modele);
  const n = noeudDe(m, id);
  if (n) { n.x = x; n.y = y; }
  return m;
}

// Ajoute un mur entre deux noeuds existants. Rend { modele, id } ou { modele, id: null } si le mur existe deja ou est degenere.
export function ajouterMur(modele, a, b, options = {}) {
  if (a === b || !noeudDe(modele, a) || !noeudDe(modele, b)) return { modele, id: null };
  if (modele.murs.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return { modele, id: null };
  const m = copie(modele);
  const type = TYPES_MUR.includes(options.type) ? options.type : "interieur";
  const id = prochainId(m.murs, "M");
  m.murs.push({ id, a, b, epaisseur: options.epaisseur || EPAISSEUR_DEFAUT[type], type });
  return { modele: m, id };
}

// Pose un noeud sur un mur existant (jonction en T) en le coupant en deux : le premier tronçon garde l'id du mur, le second reçoit un nouvel id.
// Les ouvertures suivent le tronçon qui les contient (celle qui chevauche le point est rognée). Un point a moins de 5 cm d'une extremite ne coupe
// rien : on rend le noeud existant. Rend { modele, id } (id du noeud) ou { modele, id: null } si le mur n'existe pas.
export function scinderMur(modele, murId, x, y) {
  const w = murDe(modele, murId);
  const e = w && extremites(modele, w);
  if (!e) return { modele, id: null };
  const L = longueurMur(modele, w);
  if (L < LONGUEUR_MIN * 2) return { modele, id: null };
  const ux = (e.b.x - e.a.x) / L;
  const uy = (e.b.y - e.a.y) / L;
  const t = Math.min(Math.max((x - e.a.x) * ux + (y - e.a.y) * uy, 0), L);
  if (t < LONGUEUR_MIN) return { modele, id: w.a };
  if (L - t < LONGUEUR_MIN) return { modele, id: w.b };
  const m = copie(modele);
  const idNoeud = prochainId(m.noeuds, "N");
  m.noeuds.push({ id: idNoeud, x: e.a.x + ux * t, y: e.a.y + uy * t });
  const mur = murDe(m, murId);
  const idSuite = prochainId(m.murs, "M");
  m.murs.push({ ...mur, id: idSuite, a: idNoeud, b: mur.b });
  mur.b = idNoeud;
  for (const o of m.ouvertures.filter((p) => p.mur === murId)) {
    const fin = o.decalage + o.largeur;
    if (fin <= t) continue;
    if (o.decalage >= t) { o.mur = idSuite; o.decalage -= t; continue; }
    // chevauche le point : elle reste du cote ou se trouve son centre, rognée
    if (o.decalage + o.largeur / 2 < t) o.largeur = t - o.decalage;
    else { o.mur = idSuite; o.largeur = fin - t; o.decalage = 0; }
  }
  return { modele: m, id: idNoeud };
}

// Supprime un mur, ses ouvertures et les noeuds qui ne servent plus.
export function supprimerMur(modele, id) {
  const m = copie(modele);
  m.murs = m.murs.filter((w) => w.id !== id);
  m.ouvertures = m.ouvertures.filter((o) => o.mur !== id);
  const utilises = new Set(m.murs.flatMap((w) => [w.a, w.b]));
  m.noeuds = m.noeuds.filter((n) => utilises.has(n.id));
  return m;
}

export function modifierMur(modele, id, champs) {
  const m = copie(modele);
  const w = murDe(m, id);
  if (!w) return m;
  if (nombreFini(champs.epaisseur) && champs.epaisseur > 0) w.epaisseur = champs.epaisseur;
  if (TYPES_MUR.includes(champs.type)) w.type = champs.type;
  return m;
}

// Change la cote d'un mur : le noeud b se deplace le long de la direction du mur, les murs connectes a b suivent (ils partagent le noeud).
// Une longueur invalide (nulle, negative, non numerique) ne change rien.
export function definirLongueur(modele, id, longueur) {
  const w = murDe(modele, id);
  const e = w && extremites(modele, w);
  if (!e || !nombreFini(longueur) || longueur < LONGUEUR_MIN) return modele;
  const courante = longueurMur(modele, w);
  if (courante === 0) return modele;
  const k = longueur / courante;
  return deplacerNoeud(modele, w.b, e.a.x + (e.b.x - e.a.x) * k, e.a.y + (e.b.y - e.a.y) * k);
}

// Ajoute une ouverture sur un mur, centree sur `centre` (metres depuis le noeud a) et rabotee pour tenir dans le mur.
export function ajouterOuverture(modele, murId, genre, centre) {
  const w = murDe(modele, murId);
  if (!w || !GENRES.includes(genre)) return { modele, id: null };
  const longueur = longueurMur(modele, w);
  const base = OUVERTURE_DEFAUT[genre];
  const largeur = Math.min(base.largeur, longueur);
  if (largeur <= 0) return { modele, id: null };
  const decalage = Math.min(Math.max(centre - largeur / 2, 0), longueur - largeur);
  const m = copie(modele);
  const id = prochainId(m.ouvertures, "O");
  m.ouvertures.push({ id, mur: murId, genre, decalage, largeur, hauteur: Math.min(base.hauteur, m.niveau.hauteur - base.allege), allege: base.allege });
  return { modele: m, id };
}

export function modifierOuverture(modele, id, champs) {
  const m = copie(modele);
  const o = ouvertureDe(m, id);
  if (!o) return m;
  for (const cle of ["decalage", "largeur", "hauteur", "allege"]) {
    if (nombreFini(champs[cle]) && champs[cle] >= (cle === "largeur" || cle === "hauteur" ? 0.05 : 0)) o[cle] = champs[cle];
  }
  if (GENRES.includes(champs.genre)) o.genre = champs.genre;
  return m;
}

export function supprimerOuverture(modele, id) {
  const m = copie(modele);
  m.ouvertures = m.ouvertures.filter((o) => o.id !== id);
  return m;
}

// ---- Informations libres des elements (cle / valeur, texte) ----
const TYPES_ELEMENT = ["mur", "ouverture", "piece"];
const LONGUEUR_CLE_MAX = 60;
const LONGUEUR_VALEUR_MAX = 500;

// Liste d'informations d'un element ; [] si l'element n'existe pas ou n'en a aucune.
export function infosDe(modele, type, id) {
  const el = type === "mur" ? murDe(modele, id) : type === "ouverture" ? ouvertureDe(modele, id) : type === "piece" ? (modele.pieces || []).find((p) => p.id === id) : null;
  return (el && el.infos) || [];
}

function modifierInfos(modele, type, id, transformer) {
  if (!TYPES_ELEMENT.includes(type)) return modele;
  const m = copie(modele);
  const el = type === "mur" ? murDe(m, id) : type === "ouverture" ? ouvertureDe(m, id) : (m.pieces || []).find((p) => p.id === id);
  if (!el) return modele;
  el.infos = transformer(el.infos || []);
  return m;
}

// Ajoute ou remplace (meme cle) une information. Cle vide ou valeur non texte : rien ne change. Cle et valeur sont rognees a une longueur raisonnable.
export function definirInfo(modele, type, id, cle, valeur) {
  if (typeof cle !== "string" || typeof valeur !== "string" || !cle.trim()) return modele;
  const c = cle.trim().slice(0, LONGUEUR_CLE_MAX);
  const v = valeur.slice(0, LONGUEUR_VALEUR_MAX);
  return modifierInfos(modele, type, id, (liste) => (liste.some((i) => i.cle === c) ? liste.map((i) => (i.cle === c ? { cle: c, valeur: v } : i)) : [...liste, { cle: c, valeur: v }]));
}

export function supprimerInfo(modele, type, id, cle) {
  return modifierInfos(modele, type, id, (liste) => liste.filter((i) => i.cle !== cle));
}

const nomPropre = (nom) => (typeof nom === "string" && nom.trim() ? nom.trim() : "Pièce");

// Pieces de meme nom (« Chambre » x3) : numerotees « Chambre 1 », « Chambre 2 »... dans l'ordre des id. Un nom unique reste tel quel. Idempotent.
export function numeroterDoublons(modele) {
  const m = copie(modele);
  const base = (nom) => nom.replace(/\s+\d+$/, "");
  const groupes = new Map();
  for (const pc of m.pieces || []) groupes.set(base(pc.nom), [...(groupes.get(base(pc.nom)) || []), pc]);
  for (const [b, liste] of groupes) if (liste.length > 1) liste.forEach((pc, i) => { pc.nom = `${b} ${i + 1}`; });
  return m;
}

// Ajoute une piece (contour d'au moins 3 points, fini). Rend { modele, id } ou { modele, id: null }.
export function ajouterPiece(modele, nom, contour, surfacePlan = null) {
  if (!Array.isArray(contour) || contour.length < 3 || !contour.every((q) => q && nombreFini(q.x) && nombreFini(q.y))) return { modele, id: null };
  const m = copie(modele);
  m.pieces = m.pieces || [];
  const id = prochainId(m.pieces, "P");
  m.pieces.push({ id, nom: nomPropre(nom), contour: contour.map((q) => ({ x: q.x, y: q.y })), surfacePlan: nombreFini(surfacePlan) && surfacePlan > 0 ? surfacePlan : null });
  return { modele: numeroterDoublons(m), id };
}

export function modifierPiece(modele, id, champs) {
  const m = copie(modele);
  const pc = (m.pieces || []).find((p) => p.id === id);
  if (!pc) return m;
  if (typeof champs.nom === "string") pc.nom = nomPropre(champs.nom);
  if (champs.surfacePlan === null || (nombreFini(champs.surfacePlan) && champs.surfacePlan > 0)) pc.surfacePlan = champs.surfacePlan;
  return numeroterDoublons(m);
}

export function supprimerPiece(modele, id) {
  const m = copie(modele);
  m.pieces = (m.pieces || []).filter((p) => p.id !== id);
  return m;
}

// Calibration d'echelle : deux points du plan (en metres du repere courant) dont la distance reelle est connue. Tout ce qui est une longueur
// du plan est mis a l'echelle autour de l'origine ; epaisseurs, hauteurs et allèges (cotes verticales) ne bougent pas.
export function calibrer(modele, p, q, distanceReelle) {
  const mesuree = Math.hypot(q.x - p.x, q.y - p.y);
  if (!nombreFini(distanceReelle) || distanceReelle <= 0 || mesuree === 0) return modele;
  const k = distanceReelle / mesuree;
  const m = copie(modele);
  for (const n of m.noeuds) { n.x *= k; n.y *= k; }
  for (const o of m.ouvertures) { o.decalage *= k; o.largeur *= k; }
  for (const pc of m.pieces || []) for (const q of pc.contour) { q.x *= k; q.y *= k; }
  if (m.fond) { m.fond.echelle *= k; m.fond.x *= k; m.fond.y *= k; }
  return m;
}

// Contour exterieur (pour la dalle) : chaine les murs de type « exterieur » en une boucle fermee. Rend la liste ordonnee des ids de noeuds,
// ou null si les murs exterieurs ne forment pas une seule boucle simple.
export function contourExterieur(modele) {
  const exterieurs = modele.murs.filter((w) => w.type === "exterieur");
  if (exterieurs.length < 3) return null;
  const voisins = new Map();
  for (const w of exterieurs) {
    if (!voisins.has(w.a)) voisins.set(w.a, []);
    if (!voisins.has(w.b)) voisins.set(w.b, []);
    voisins.get(w.a).push(w.b);
    voisins.get(w.b).push(w.a);
  }
  for (const liste of voisins.values()) if (liste.length !== 2) return null;
  const depart = exterieurs[0].a;
  const ordre = [depart];
  let precedent = null;
  let courant = depart;
  for (;;) {
    const [v1, v2] = voisins.get(courant);
    const suivant = v1 !== precedent ? v1 : v2;
    if (suivant === depart) break;
    if (ordre.includes(suivant)) return null;
    ordre.push(suivant);
    precedent = courant;
    courant = suivant;
  }
  return ordre.length === voisins.size ? ordre : null;
}
