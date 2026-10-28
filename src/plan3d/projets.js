// 2D -> 3D (28/10, retour 26 de Gilles) : les PROJETS de la page. Un projet = un plan importe + son etat (murs, ouvertures, pieces, echelle).
// Changer de plan, c'est ouvrir ou creer un autre projet : la page s'ouvre sur la liste des projets en cours.
//
// Deux depots injectables, pour que la logique se teste sans navigateur :
//   depotMeta   : { lire() -> entrees, ecrire(entrees) -> booleen }  (src/quantitatifHistorique.js, creerDepotLocal : localStorage, cle propre)
//   depotImages : { lire(id) -> Blob | null, ecrire(id, blob) -> booleen, supprimer(id) -> booleen }  (src/plan3d/projetsImages.js : IndexedDB)
//                 (synchrones ou asynchrones)
// Le stockage du navigateur peut manquer, etre plein ou corrompu (navigation privee, donnees bloquees) : rien ne leve d'exception. Les projets restent alors
// en memoire (disponibles jusqu'a la fermeture de la page) et `persistant()` rend false, pour que la page le dise honnetement.
// Jamais de purge silencieuse : au-dela de PROJETS_MAX, la creation est refusee (raison « limite ») plutot que d'effacer un projet de l'utilisateur.

import { validerModele } from "./modele.js";

export const CLE_PROJETS = "ouvra-plan3d-projets";
export const PROJETS_MAX = 30;
export const NOM_MAX = 60;
export const NOM_EXEMPLE = "Plan d'exemple";
const VIGNETTE_MAX = 20000; // caracteres : une vignette plus lourde est ignoree (le projet reste utilisable, sans image dans la liste)

const nombreFini = (v) => typeof v === "number" && Number.isFinite(v);
const dateValide = (s) => typeof s === "string" && Number.isFinite(new Date(s).getTime());

// Nom propre : espaces compactes, longueur bornee ; null si vide (renommage refuse).
export function nettoyerNom(nom) {
  const net = String(nom == null ? "" : nom).replace(/\s+/g, " ").trim().slice(0, NOM_MAX).trim();
  return net || null;
}

// Nom par defaut d'un projet cree depuis un fichier : le nom du fichier sans son extension.
export function nomDepuisFichier(nomFichier) {
  return nettoyerNom(String(nomFichier || "").replace(/\.[a-z0-9]{1,5}$/i, ""));
}

// Une entree lue du stockage est-elle exploitable ? (stockage corrompu ou ecrit par une autre version : l'entree est ecartee, jamais la liste entiere)
export function entreeValide(e) {
  return Boolean(e) && typeof e === "object" && typeof e.id === "string" && e.id !== "" && nettoyerNom(e.nom) !== null && dateValide(e.creeLe) && dateValide(e.modifieLe)
    && nombreFini(e.l) && nombreFini(e.h) && e.l > 0 && e.h > 0 && validerModele(e.modele).valide;
}

const resume = (e) => ({
  id: e.id, nom: e.nom, creeLe: e.creeLe, modifieLe: e.modifieLe, exemple: Boolean(e.exemple),
  murs: e.modele.murs.length, pieces: (e.modele.pieces || []).length, vignette: typeof e.vignette === "string" ? e.vignette : null
});

const copie = (v) => JSON.parse(JSON.stringify(v));

export function creerProjets({ depotMeta, depotImages, maintenant = () => new Date(), genererId = null }) {
  let cache = null; // entrees { id, nom, creeLe, modifieLe, exemple, l, h, imageNom, vignette, modele }
  const imagesMemoire = new Map();
  let persiste = true;
  let compteur = 0;
  const id = genererId || (() => "p" + maintenant().getTime().toString(36) + (compteur++).toString(36) + Math.random().toString(36).slice(2, 6));

  async function entrees() {
    if (cache) return cache;
    let brut = [];
    try { brut = await depotMeta.lire(); } catch { brut = []; }
    cache = Array.isArray(brut) ? brut.filter(entreeValide) : [];
    return cache;
  }

  async function ecrireMeta() {
    let ok = false;
    try { ok = Boolean(await depotMeta.ecrire(cache)); } catch { ok = false; }
    persiste = persiste && ok;
    return ok;
  }

  async function ecrireImage(idProjet, blob) {
    imagesMemoire.set(idProjet, blob);
    let ok = false;
    try { ok = Boolean(await depotImages.ecrire(idProjet, blob)); } catch { ok = false; }
    persiste = persiste && ok;
    return ok;
  }

  return {
    // false des qu'une ecriture a echoue : les projets ne survivront pas a la fermeture de la page.
    persistant: () => persiste,

    // Plus recemment modifie d'abord. Resumes : { id, nom, creeLe, modifieLe, exemple, murs, pieces, vignette }.
    async lister() {
      return (await entrees()).slice().sort((a, b) => b.modifieLe.localeCompare(a.modifieLe)).map(resume);
    },

    // { id, nom, exemple, l, h, imageNom, modele, image: Blob | null } ; null si le projet n'existe pas. `image` null : l'image n'est plus disponible.
    async obtenir(idProjet) {
      const e = (await entrees()).find((x) => x.id === idProjet);
      if (!e) return null;
      let image = imagesMemoire.get(idProjet) || null;
      if (!image) {
        try { image = (await depotImages.lire(idProjet)) || null; } catch { image = null; }
        if (image) imagesMemoire.set(idProjet, image);
      }
      return { id: e.id, nom: e.nom, exemple: Boolean(e.exemple), l: e.l, h: e.h, imageNom: e.imageNom || "", modele: copie(e.modele), image };
    },

    // Rend { ok: true, id, persistant } ou { ok: false, raison: "limite" | "modele_invalide" | "nom_invalide" }.
    async creer({ nom, modele, image, l, h, imageNom = "", vignette = null, exemple = false }) {
      const liste = await entrees();
      if (liste.length >= PROJETS_MAX) return { ok: false, raison: "limite" };
      const net = nettoyerNom(nom);
      if (net === null) return { ok: false, raison: "nom_invalide" };
      if (!validerModele(modele).valide || !nombreFini(l) || !nombreFini(h) || l <= 0 || h <= 0) return { ok: false, raison: "modele_invalide" };
      const maintenantIso = maintenant().toISOString();
      const entree = {
        id: id(), nom: net, creeLe: maintenantIso, modifieLe: maintenantIso, exemple: Boolean(exemple), l, h, imageNom: String(imageNom),
        vignette: typeof vignette === "string" && vignette.length <= VIGNETTE_MAX ? vignette : null, modele: copie(modele)
      };
      liste.push(entree);
      await ecrireImage(entree.id, image);
      await ecrireMeta();
      return { ok: true, id: entree.id, persistant: persiste };
    },

    // Sauvegarde automatique de l'etat (murs, echelle, pieces...). Rend { ok, persistant } ; ok false si le projet n'existe plus ou si le modele est invalide.
    async enregistrer(idProjet, modele) {
      const e = (await entrees()).find((x) => x.id === idProjet);
      if (!e || !validerModele(modele).valide) return { ok: false, persistant: persiste };
      e.modele = copie(modele);
      e.modifieLe = maintenant().toISOString();
      await ecrireMeta();
      return { ok: true, persistant: persiste };
    },

    // Autre page d'un meme PDF : l'image du projet est remplacee (l'etat est conserve).
    async remplacerImage(idProjet, { image, l, h, imageNom = "", vignette = null }) {
      const e = (await entrees()).find((x) => x.id === idProjet);
      if (!e || !nombreFini(l) || !nombreFini(h) || l <= 0 || h <= 0) return { ok: false, persistant: persiste };
      e.l = l; e.h = h; e.imageNom = String(imageNom);
      e.vignette = typeof vignette === "string" && vignette.length <= VIGNETTE_MAX ? vignette : null;
      e.modifieLe = maintenant().toISOString();
      await ecrireImage(idProjet, image);
      await ecrireMeta();
      return { ok: true, persistant: persiste };
    },

    // Rend le nom retenu, ou null (projet inconnu, nom vide).
    async renommer(idProjet, nom) {
      const e = (await entrees()).find((x) => x.id === idProjet);
      const net = nettoyerNom(nom);
      if (!e || net === null) return null;
      e.nom = net;
      e.modifieLe = maintenant().toISOString();
      await ecrireMeta();
      return net;
    },

    // true si le projet existait. L'image est retiree meme si le depot d'images echoue (elle n'est alors plus rattachee a rien).
    async supprimer(idProjet) {
      const liste = await entrees();
      const reste = liste.filter((x) => x.id !== idProjet);
      if (reste.length === liste.length) return false;
      cache = reste;
      imagesMemoire.delete(idProjet);
      try { await depotImages.supprimer(idProjet); } catch { /* image orpheline : sans consequence */ }
      await ecrireMeta();
      return true;
    }
  };
}
