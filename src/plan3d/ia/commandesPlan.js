// 2D -> 3D, IA du plan (25/10) : le REGISTRE des commandes que l'IA peut demander sur le plan, et leur moteur. Module pur (aucun reseau, aucun DOM), meme esprit que
// src/commandesViewer.js : l'IA ne fait que traduire une phrase en commandes a valeurs fermees, le moteur applique avec les fonctions de src/plan3d/modele.js.
//
// UNE action = un nom, des parametres decrits, une resolution de sa cible (sur la description du plan AVANT toute modification, donc les rangs ecrits par l'IA
// restent justes meme si une commande precedente ajoute ou retire une ouverture) et une application qui rend le nouveau modele et un compte rendu ECRIT PAR LE MOTEUR
// (jamais le texte libre du modele). Ajouter une commande = une entree dans ACTIONS : le schema du relais (relais/schemaPlan.js), la consigne et la validation
// la prennent seuls.
//
// Parametres : { nom, genre, description, facultatif?, options? } avec genre = piece | cote | entier | nombre | texte | enum.
// Les longueurs sont donnees en centimetres par l'IA (comme sur le plan), le moteur travaille en metres. Tout est verifie ici, rien n'est suppose du modele.
// Application « tout ou rien » : si une commande d'une phrase echoue, le plan reste exactement comme avant.

import { murDe, ouvertureDe, extremites, longueurMur, modifierOuverture, ajouterOuverture, supprimerOuverture, modifierPiece, modifierMur } from "../modele.js";
import { decrirePlan, COTES } from "./descriptionPlan.js";

export const GENRES_OUVERTURE = ["porte", "fenetre", "coulissante"];
const DEFAUTS = { porte: { largeur: 0.9, hauteur: 2.1, allege: 0 }, fenetre: { largeur: 1.2, hauteur: 1.25, allege: 0.95 }, coulissante: { largeur: 1.6, hauteur: 2.1, allege: 0 } };
const NOM_GENRE = { porte: "Porte", fenetre: "Fenêtre", coulissante: "Porte coulissante" };
const HAUTEUR_BAIE = 1.8; // metres : a partir de cette hauteur, une ouverture sans allege precisee descend au sol
const MIN = 0.2; // metres : une ouverture plus etroite ou plus basse n'est pas une ouverture
const TOLERANCE = 1e-6;
const cm = (m) => Math.round(m * 100);
const enM = (v) => v / 100;

const P_PIECE = { nom: "piece", genre: "piece", description: "pièce visée, exactement comme dans la liste des pièces" };
const P_COTE = { nom: "cote", genre: "cote", description: "côté de la pièce : nord (haut du plan), sud (bas), est (droite), ouest (gauche)" };
const P_RANG = { nom: "rang", genre: "entier", description: "numéro de l'ouverture sur ce côté, comme dans la liste (1 = la plus à l'ouest ou la plus au nord)" };

// ---------- Resolution des cibles (sur la description initiale) ----------

function resoudrePiece(description, p) {
  const piece = description.parLibelle.get(p.piece);
  return piece ? { ok: true, piece } : { ok: false, message: `Je ne trouve pas la pièce « ${p.piece} ».` };
}

function resoudreCote(description, p) {
  const r = resoudrePiece(description, p);
  if (!r.ok) return r;
  const cote = r.piece.cotes[p.cote];
  if (!cote || cote.murs.length === 0) return { ok: false, message: `La pièce « ${r.piece.libelle} » n'a pas de mur du côté ${p.cote}.` };
  return { ok: true, piece: r.piece, cote };
}

function resoudreOuverture(description, p) {
  const r = resoudreCote(description, p);
  if (!r.ok) return r;
  const o = r.cote.ouvertures.find((x) => x.rang === p.rang);
  if (!o) {
    const n = r.cote.ouvertures.length;
    return { ok: false, message: n === 0 ? `Il n'y a aucune ouverture du côté ${p.cote} de « ${r.piece.libelle} ».` : `Il n'y a pas d'ouverture n°${p.rang} du côté ${p.cote} de « ${r.piece.libelle} » (il y en a ${n}).` };
  }
  return { ok: true, piece: r.piece, ouverture: o, cote: p.cote };
}

// Une ouverture rentre-t-elle sur son mur sans en chevaucher une autre (hors elle-meme) ? Rend un message d'erreur ou null.
function conflit(modele, murId, decalage, largeur, ignorer = null) {
  const L = longueurMur(modele, murDe(modele, murId));
  if (largeur > L + TOLERANCE) return `Le mur ne fait que ${cm(L)} cm, l'ouverture de ${cm(largeur)} cm n'y tient pas.`;
  if (decalage < -TOLERANCE || decalage + largeur > L + TOLERANCE) return "L'ouverture sortirait du mur.";
  const autre = modele.ouvertures.find((o) => o.mur === murId && o.id !== ignorer && decalage < o.decalage + o.largeur - TOLERANCE && o.decalage < decalage + largeur - TOLERANCE);
  return autre ? `L'ouverture chevaucherait ${autre.genre === "fenetre" ? "la fenêtre" : "la porte"} voisine.` : null;
}

function verifierDimensions(modele, hauteur, allege) {
  if (hauteur < MIN) return `Une hauteur de ${cm(hauteur)} cm est trop petite.`;
  if (allege < 0) return "L'allège ne peut pas être négative.";
  if (allege + hauteur > modele.niveau.hauteur + TOLERANCE) return `L'allège et la hauteur dépassent la hauteur du niveau (${cm(modele.niveau.hauteur)} cm).`;
  return null;
}

const lieu = (piece, cote) => `côté ${cote} de « ${piece.libelle} »`;

// ---------- Actions ----------

const ACTIONS = [
  {
    nom: "modifier_ouverture",
    libelle: "Modifier une porte ou une fenêtre",
    description: "change la largeur, la hauteur, l'allège ou le genre (porte, fenêtre ou porte coulissante) d'une ouverture existante ; les mesures non citées restent nulles",
    parametres: [
      P_PIECE, P_COTE, P_RANG,
      { nom: "largeur_cm", genre: "nombre", facultatif: true, description: "nouvelle largeur en centimètres, null si la phrase n'en parle pas" },
      { nom: "hauteur_cm", genre: "nombre", facultatif: true, description: "nouvelle hauteur en centimètres, null si la phrase n'en parle pas" },
      { nom: "allege_cm", genre: "nombre", facultatif: true, zeroPermis: true, description: "nouvelle allège (distance du sol au bas de l'ouverture) en centimètres, null si la phrase n'en parle pas" },
      { nom: "genre", genre: "enum", options: () => GENRES_OUVERTURE, facultatif: true, description: "porte, fenetre ou coulissante si la phrase change la nature de l'ouverture, sinon null" }
    ],
    resoudre: resoudreOuverture,
    appliquer(modele, cible, p) {
      const o = ouvertureDe(modele, cible.ouverture.id);
      if (!o) return { ok: false, message: "Cette ouverture a déjà été retirée par une commande précédente." };
      const w = murDe(modele, o.mur);
      const L = longueurMur(modele, w);
      const genre = p.genre || o.genre;
      const change = genre !== o.genre;
      const largeur = p.largeur_cm != null ? enM(p.largeur_cm) : o.largeur;
      const hauteur = p.hauteur_cm != null ? enM(p.hauteur_cm) : change ? DEFAUTS[genre].hauteur : o.hauteur;
      let allege = p.allege_cm != null ? enM(p.allege_cm) : change ? DEFAUTS[genre].allege : o.allege;
      // Une ouverture de 1,80 m de haut ou plus, dont l'allege n'est pas precisee et qui depasserait le plafond, descend jusqu'au sol (baie vitree, porte-fenetre).
      if (p.allege_cm == null && hauteur >= HAUTEUR_BAIE && allege + hauteur > modele.niveau.hauteur + TOLERANCE) allege = 0;
      if (!change && largeur === o.largeur && hauteur === o.hauteur && allege === o.allege) return { ok: false, message: "Cette ouverture a déjà ces mesures, rien à changer." };
      if (largeur < MIN) return { ok: false, message: `Une largeur de ${cm(largeur)} cm est trop petite.` };
      const dim = verifierDimensions(modele, hauteur, allege);
      if (dim) return { ok: false, message: dim };
      // La largeur change autour du milieu de l'ouverture ; si elle debordait du mur, elle est decalee pour rester dans le mur.
      const decalage = Math.min(Math.max(o.decalage + o.largeur / 2 - largeur / 2, 0), Math.max(L - largeur, 0));
      const erreur = conflit(modele, o.mur, decalage, largeur, o.id);
      if (erreur) return { ok: false, message: erreur };
      const parties = [];
      if (change) parties.push(`${NOM_GENRE[o.genre].toLowerCase()} devient ${NOM_GENRE[genre].toLowerCase()}`);
      if (cm(largeur) !== cm(o.largeur)) parties.push(`largeur ${cm(o.largeur)} → ${cm(largeur)} cm`);
      if (cm(hauteur) !== cm(o.hauteur)) parties.push(`hauteur ${cm(o.hauteur)} → ${cm(hauteur)} cm`);
      if (cm(allege) !== cm(o.allege)) parties.push(`allège ${cm(o.allege)} → ${cm(allege)} cm`);
      return {
        ok: true,
        modele: modifierOuverture(modele, o.id, { genre, largeur, hauteur, allege, decalage }),
        compteRendu: `${NOM_GENRE[o.genre]} n°${cible.ouverture.rang}, ${lieu(cible.piece, cible.cote)} : ${parties.join(", ")}.`
      };
    }
  },
  {
    nom: "ajouter_ouverture",
    libelle: "Ajouter une porte ou une fenêtre",
    description: "pose une nouvelle porte ou fenêtre sur un côté d'une pièce, repérée par sa distance depuis le début du côté (ouest ou nord), depuis la fin, ou centrée",
    parametres: [
      P_PIECE, P_COTE,
      { nom: "genre", genre: "enum", options: () => GENRES_OUVERTURE, description: "porte, fenetre ou coulissante (cloison ou placard coulissant)" },
      { nom: "largeur_cm", genre: "nombre", facultatif: true, description: "largeur en centimètres, null pour la largeur habituelle (porte 90, fenêtre 120, coulissante 160)" },
      { nom: "ancrage", genre: "enum", options: () => ["debut", "centre", "fin"], description: "debut : distance mesurée depuis l'ouest (côtés nord et sud) ou le nord (côtés est et ouest) ; fin : depuis l'est ou le sud ; centre : au milieu du côté" },
      { nom: "distance_cm", genre: "nombre", facultatif: true, description: "distance en centimètres entre le bord de la pièce et le bord de l'ouverture, null pour 0 ou si l'ancrage est centre" }
    ],
    resoudre: resoudreCote,
    appliquer(modele, cible, p) {
      const genre = p.genre;
      const largeur = p.largeur_cm != null ? enM(p.largeur_cm) : DEFAUTS[genre].largeur;
      if (largeur < MIN) return { ok: false, message: `Une largeur de ${cm(largeur)} cm est trop petite.` };
      const horizontal = p.cote === "nord" || p.cote === "sud";
      const coords = cible.piece.contour.map((q) => (horizontal ? q.x : q.y));
      const lo = Math.min(...coords);
      const hi = Math.max(...coords);
      const distance = p.distance_cm != null ? enM(p.distance_cm) : 0;
      if (distance < 0) return { ok: false, message: "La distance ne peut pas être négative." };
      const debut = p.ancrage === "debut" ? lo + distance : p.ancrage === "fin" ? hi - distance - largeur : (lo + hi) / 2 - largeur / 2;
      const fin = debut + largeur;
      // Le mur du cote qui contient tout l'emplacement.
      let mur = null;
      let decalage = 0;
      for (const id of cible.cote.murs) {
        const w = murDe(modele, id);
        const e = extremites(modele, w);
        const a = horizontal ? e.a.x : e.a.y;
        const b = horizontal ? e.b.x : e.b.y;
        if (debut >= Math.min(a, b) - TOLERANCE && fin <= Math.max(a, b) + TOLERANCE) { mur = w; decalage = b >= a ? debut - a : a - fin; break; }
      }
      if (!mur) return { ok: false, message: `Cet emplacement ne tombe pas sur un seul mur du côté ${p.cote} de « ${cible.piece.libelle} ».` };
      const dim = verifierDimensions(modele, DEFAUTS[genre].hauteur, DEFAUTS[genre].allege);
      if (dim) return { ok: false, message: dim };
      const erreur = conflit(modele, mur.id, decalage, largeur);
      if (erreur) return { ok: false, message: erreur };
      const r = ajouterOuverture(modele, mur.id, genre, decalage + largeur / 2);
      if (!r.id) return { ok: false, message: "L'ouverture n'a pas pu être posée." };
      const pose = modifierOuverture(r.modele, r.id, { largeur, decalage });
      const place = p.ancrage === "centre" ? "au centre" : `à ${cm(distance)} cm ${p.ancrage === "debut" ? "du début" : "de la fin"} du côté`;
      return { ok: true, modele: pose, compteRendu: `${NOM_GENRE[genre]} de ${cm(largeur)} cm ajoutée, ${lieu(cible.piece, p.cote)}, ${place}.` };
    }
  },
  {
    nom: "supprimer_ouverture",
    libelle: "Supprimer une porte ou une fenêtre",
    description: "retire une ouverture existante",
    parametres: [P_PIECE, P_COTE, P_RANG],
    resoudre: resoudreOuverture,
    appliquer(modele, cible) {
      const o = ouvertureDe(modele, cible.ouverture.id);
      if (!o) return { ok: false, message: "Cette ouverture a déjà été retirée par une commande précédente." };
      return { ok: true, modele: supprimerOuverture(modele, o.id), compteRendu: `${NOM_GENRE[o.genre]} n°${cible.ouverture.rang} supprimée, ${lieu(cible.piece, cible.cote)}.` };
    }
  },
  {
    nom: "renommer_piece",
    libelle: "Renommer une pièce",
    description: "change le nom d'une pièce",
    parametres: [P_PIECE, { nom: "nouveau_nom", genre: "texte", description: "nouveau nom de la pièce, 60 caractères au plus" }],
    resoudre: resoudrePiece,
    appliquer(modele, cible, p) {
      if (cible.piece.nom === p.nouveau_nom) return { ok: false, message: "La pièce porte déjà ce nom." };
      const base = (nom) => nom.replace(/\s+\d+$/, "").toLowerCase();
      const pris = (modele.pieces || []).find((x) => x.id !== cible.piece.id && base(x.nom) === base(p.nouveau_nom));
      if (pris) return { ok: false, message: `Une autre pièce s'appelle déjà « ${pris.nom} ». Choisis un nom différent.` };
      const apres = modifierPiece(modele, cible.piece.id, { nom: p.nouveau_nom });
      const nom = apres.pieces.find((x) => x.id === cible.piece.id).nom;
      return { ok: true, modele: apres, compteRendu: `« ${cible.piece.libelle} » renommée « ${nom} ».` };
    }
  },
  {
    nom: "modifier_mur",
    libelle: "Modifier un mur",
    description: "change l'épaisseur ou le type (extérieur ou intérieur) du mur d'un côté d'une pièce",
    parametres: [
      P_PIECE, P_COTE,
      { nom: "epaisseur_cm", genre: "nombre", facultatif: true, description: "nouvelle épaisseur en centimètres, null si la phrase n'en parle pas" },
      { nom: "type", genre: "enum", options: () => ["exterieur", "interieur"], facultatif: true, description: "exterieur ou interieur si la phrase change le type du mur, sinon null" }
    ],
    resoudre: resoudreCote,
    appliquer(modele, cible, p) {
      const epaisseur = p.epaisseur_cm != null ? enM(p.epaisseur_cm) : null;
      if (epaisseur !== null && (epaisseur < 0.03 || epaisseur > 0.8)) return { ok: false, message: `Une épaisseur de ${cm(epaisseur)} cm n'est pas plausible pour un mur.` };
      if (epaisseur === null && !p.type) return { ok: false, message: "Aucun changement demandé." };
      let m = modele;
      for (const id of cible.cote.murs) m = modifierMur(m, id, { ...(epaisseur !== null ? { epaisseur } : {}), ...(p.type ? { type: p.type } : {}) });
      const parties = [];
      if (epaisseur !== null) parties.push(`épaisseur ${cm(epaisseur)} cm`);
      if (p.type) parties.push(`type ${p.type === "exterieur" ? "extérieur" : "intérieur"}`);
      return { ok: true, modele: m, compteRendu: `Mur ${lieu(cible.piece, p.cote)} : ${parties.join(", ")}.` };
    }
  }
];

export const REGISTRE_PLAN = {
  toutes: () => ACTIONS,
  noms: () => ACTIONS.map((a) => a.nom),
  parNom: (nom) => ACTIONS.find((a) => a.nom === nom) || null
};

// ---------- Validation de la forme d'une commande ----------

function verifierParametre(p, valeur, description) {
  if (valeur === null || valeur === undefined) return p.facultatif ? null : `Le paramètre « ${p.nom} » est absent.`;
  switch (p.genre) {
    case "piece": return typeof valeur === "string" && description.parLibelle.has(valeur) ? null : `Pièce inconnue : « ${valeur} ».`;
    case "cote": return COTES.includes(valeur) ? null : `Côté inconnu : « ${valeur} ».`;
    case "entier": return Number.isInteger(valeur) && valeur >= 1 ? null : "Le numéro d'ouverture doit être un entier à partir de 1.";
    case "nombre": return typeof valeur === "number" && Number.isFinite(valeur) && (valeur > 0 || (p.zeroPermis && valeur === 0)) && valeur < 100000 ? null : `Le nombre « ${p.nom} » doit être positif.`;
    case "texte": return typeof valeur === "string" && valeur.trim().length > 0 && valeur.trim().length <= 60 ? null : `Le texte « ${p.nom} » doit faire de 1 à 60 caractères.`;
    case "enum": return p.options().includes(valeur) ? null : `Valeur inconnue pour « ${p.nom} » : « ${valeur} ».`;
    default: return `Genre de paramètre inconnu : ${p.genre}.`;
  }
}

// Rend { ok: true, commande } (texte rogne, valeurs facultatives absentes mises a null) ou { ok: false, erreur }.
export function validerCommande(commande, description) {
  if (!commande || typeof commande !== "object" || Array.isArray(commande)) return { ok: false, erreur: "Commande mal formée." };
  const action = REGISTRE_PLAN.parNom(commande.action);
  if (!action) return { ok: false, erreur: `Action inconnue : « ${commande.action} ».` };
  const propre = { action: action.nom };
  for (const p of action.parametres) {
    const erreur = verifierParametre(p, commande[p.nom], description);
    if (erreur) return { ok: false, erreur };
    const v = commande[p.nom];
    propre[p.nom] = v === undefined ? null : p.genre === "texte" && typeof v === "string" ? v.trim() : v;
  }
  return { ok: true, commande: propre };
}

// ---------- Application d'une phrase (une ou plusieurs commandes), tout ou rien ----------

export const COMMANDES_MAX = 6;

// Rend { ok: true, modele, comptesRendus: [texte] } ou { ok: false, message, index }. Le modele recu n'est jamais modifie.
export function appliquerCommandes(modele, commandes) {
  if (!Array.isArray(commandes) || commandes.length === 0) return { ok: false, message: "Aucune commande à appliquer.", index: 0 };
  if (commandes.length > COMMANDES_MAX) return { ok: false, message: `Une phrase ne peut pas demander plus de ${COMMANDES_MAX} modifications.`, index: COMMANDES_MAX };
  const description = decrirePlan(modele); // les cibles de TOUTES les commandes sont resolues sur le plan d'origine
  const preparees = [];
  for (let i = 0; i < commandes.length; i++) {
    const v = validerCommande(commandes[i], description);
    if (!v.ok) return { ok: false, message: v.erreur, index: i };
    const action = REGISTRE_PLAN.parNom(v.commande.action);
    const cible = action.resoudre(description, v.commande);
    if (!cible.ok) return { ok: false, message: cible.message, index: i };
    preparees.push({ action, cible, params: v.commande });
  }
  let courant = modele;
  const comptesRendus = [];
  for (let i = 0; i < preparees.length; i++) {
    const { action, cible, params } = preparees[i];
    const r = action.appliquer(courant, cible, params);
    if (!r.ok) return { ok: false, message: r.message, index: i };
    courant = r.modele;
    comptesRendus.push(r.compteRendu);
  }
  return { ok: true, modele: courant, comptesRendus };
}
