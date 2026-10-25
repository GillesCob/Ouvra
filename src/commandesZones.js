// Viewer par commande (24/10) : les zones nommees, option A du « Afficher une piece ». Les maquettes de l'hopital ne contiennent aucun IfcSpace : une
// piece ne peut pas venir des donnees. L'utilisateur definit donc un volume (boite englobante) et lui donne un nom ; « Affiche la zone Bloc operatoire »
// l'isole ensuite (selecteur « zones », presentation « zone »). Le jour ou de vraies pieces (IfcSpace) existent, leurs boites s'ajoutent a cette liste
// ou un autre selecteur les lit, sans reecrire le selecteur ni la presentation : ils ne connaissent qu'un nom et une boite.
//
// Sauvegarde locale (localStorage, ou tout objet { getItem, setItem }), TOUJOURS dans try/catch : stockage absent, plein ou bloque (fenetre privee) =
// la liste vit en memoire pour la session et tout fonctionne. Une boite est [xmin, ymin, zmin, xmax, ymax, zmax] en metres.
// Module sans dependance a main.js ni au DOM.

import { normaliser } from "./reglesCollision.js";
import { elargirAabb, estAabb } from "./commandesGeometrie.js";

export const CLE_STOCKAGE = "ouvra.commandes.zones.v1";
export const NOM_MAX = 60;
export const ZONES_MAX = 30;
export const MARGE_DEFAUT_M = 2; // marge autour d'un element choisi comme base de zone, ou demi-cote d'une zone posee sur un point

const nettoyerNom = (nom) => String(nom == null ? "" : nom).replace(/\s+/g, " ").trim();
const cle = (nom) => normaliser(nettoyerNom(nom));

export function creerZones({ stockage = null, cleStockage = CLE_STOCKAGE } = {}) {
  let liste = [];

  function lire() {
    if (!stockage) return [];
    try {
      const brut = stockage.getItem(cleStockage);
      const donnees = brut ? JSON.parse(brut) : [];
      return Array.isArray(donnees) ? donnees.filter((z) => z && typeof z.nom === "string" && estAabb(z.aabb)).slice(0, ZONES_MAX) : [];
    } catch (e) {
      return []; // stockage illisible ou JSON abime : on repart d'une liste vide
    }
  }

  function ecrire() {
    if (!stockage) return false;
    try {
      stockage.setItem(cleStockage, JSON.stringify(liste));
      return true;
    } catch (e) {
      return false; // stockage plein ou refuse : la liste reste en memoire
    }
  }

  liste = lire();

  return {
    lister: () => liste.map((z) => ({ nom: z.nom, aabb: z.aabb.slice() })),
    noms: () => liste.map((z) => z.nom),
    trouver(nom) {
      const k = cle(nom);
      const zone = liste.find((z) => cle(z.nom) === k);
      return zone ? zone.aabb.slice() : null;
    },
    // Ajoute ou remplace (meme nom, a la casse et aux accents pres). Rend { ok: true, nom } ou { ok: false, message }.
    ajouter(nom, aabb) {
      const propre = nettoyerNom(nom);
      if (!propre) return { ok: false, message: "Donne un nom à la zone." };
      if (propre.length > NOM_MAX) return { ok: false, message: "Le nom est trop long (" + NOM_MAX + " caractères au plus)." };
      if (!estAabb(aabb)) return { ok: false, message: "Le volume de la zone est invalide." };
      const k = cle(propre);
      const existante = liste.findIndex((z) => cle(z.nom) === k);
      if (existante < 0 && liste.length >= ZONES_MAX) return { ok: false, message: "Il y a déjà " + ZONES_MAX + " zones : supprime-en une." };
      const zone = { nom: propre, aabb: aabb.slice() };
      if (existante >= 0) liste[existante] = zone; else liste.push(zone);
      ecrire();
      return { ok: true, nom: propre };
    },
    supprimer(nom) {
      const k = cle(nom);
      const avant = liste.length;
      liste = liste.filter((z) => cle(z.nom) !== k);
      if (liste.length !== avant) ecrire();
      return liste.length !== avant;
    }
  };
}

// Boite d'une zone posee sur un point clique de la maquette : un cube de demi-cote `marge` autour du point.
export function aabbAutourDuPoint(point, marge = MARGE_DEFAUT_M) {
  if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return null;
  return elargirAabb([point[0], point[1], point[2], point[0], point[1], point[2]], marge);
}

// Boite d'une zone a partir de l'element selectionne : sa boite agrandie de `marge`.
export function aabbAutourDeLaBoite(aabb, marge = MARGE_DEFAUT_M) {
  return estAabb(aabb) ? elargirAabb(aabb, marge) : null;
}
