// Quantitatif par demande en langage naturel (24/10) : le moteur, sans interface, sans reseau, sans dependance a xeokit.
//
// Principe : l'IA TRADUIT une phrase en requete structuree ; ce module CALCULE. L'IA ne compte ni ne mesure jamais.
// Une requete : { mesure, filtres: { typesIfc, niveaux, maquettes, noms }, regroupements: [0 a 2 noms] }.
// Un element (fourni par src/quantitatifDonnees.js) : { id, nom, famille, typeIfc, niveau, maquette, maquetteId, boite, quantites }
//   boite : [xmin, ymin, zmin, xmax, ymax, zmax] (boite englobante AABB xeokit) ou fonction qui la rend, null si l'element n'a pas de geometrie
//   quantites : { NomDeQuantite: nombre } lues dans les jeux de proprietes Qto_* / BaseQuantities du modele, ou null
//
// ORIGINE DE CHAQUE MESURE (regle du proprietaire : aucune information non sourcee) :
//   compte  : nombre d'elements, exact.
//   estime  : mesure sur la boite englobante AABB, une ESTIMATION (une gaine ou un tuyau en diagonale est surestime, une dalle epaisse aussi).
//             Jamais presentee comme une quantite IFC. Les unites sont celles de la scene, supposees en metres (non verifie sans navigateur).
//   lu      : quantite lue dans le modele (Qto IFC) : seulement si le modele en contient reellement. Les metadonnees JSON de l'hopital n'en ont aucune.
// Ce qui n'est pas disponible est dit « non disponible », jamais invente.
//
// REGISTRES EXTENSIBLES : ajouter une capacite = un seul appel, sans toucher au reste.
//   Ajouter une MESURE :
//     MESURES.enregistrer({ nom: "poids_estime", libelle: "poids estimé", verbe: "Estimer le poids", unite: "kg", origine: "estime",
//                           besoin: "boite" | "quantites" | null, valeur: (element) => nombre | null });
//     (null = l'element n'a pas la donnee : il est compte a part dans « sans donnee », jamais ajoute comme zero.) Le relais IA et le schema
//     de sortie la prennent seuls (relais/schemaQuantitatif.js lit ce registre).
//   Ajouter un FILTRE :
//     FILTRES.enregistrer({ nom: "familles", source: "noms", libelle: "...", test: (element, valeur) => booleen });
//     "nom" est aussi la cle dans requete.filtres ; ajouter une cle impose de l'ajouter aux valeurs envoyees (valeursPourQuantitatif).
//   Ajouter un REGROUPEMENT :
//     REGROUPEMENTS.enregistrer({ nom: "phase", libelle: "phase", cle: (element) => "texte", critere: { champ: "niveaux", valeur: (cle) => cle } });
//     (critere facultatif : sert au lien « Voir dans le Viewer » d'une ligne.)
//   Ajouter une PHRASE EXEMPLE : une entree dans src/quantitatifExemples.js ; tests/quantitatifExemples.test.js verifie qu'elle donne un resultat.

import { normaliser } from "./reglesCollision.js";
import { libelleTypeIfc } from "./commandesViewer.js";

export const TYPES_SPATIAUX = new Set(["IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace"]);
export const ORIGINES = { compte: "compté", estime: "estimé", lu: "lu dans le modèle" };
// Ce que chaque origine garantit, dit en toutes lettres dans le tableau, le PDF et l'Excel (usage : etude de prix, un chiffre estime ne chiffre pas ferme).
export const EXPLICATIONS_ORIGINES = {
  compte: "Compté : nombre exact d'éléments présents dans la maquette.",
  estime: "Estimé : mesuré sur la boîte englobante des éléments, à ne pas utiliser pour un chiffrage ferme.",
  lu: "Lu dans le modèle : quantité IFC renseignée par l'auteur de la maquette, non recalculée ici."
};
export const REGROUPEMENTS_MAX = 2;
export const SANS_NIVEAU = "Sans niveau";
const CLES_FILTRES = ["typesIfc", "niveaux", "maquettes", "noms"];

// ---------- Registres ----------
export function creerRegistre(genre) {
  const definitions = new Map();
  return {
    enregistrer(definition) {
      if (!definition || typeof definition.nom !== "string" || !definition.nom) throw new Error("Un(e) " + genre + " doit avoir un nom.");
      if (definitions.has(definition.nom)) throw new Error("Le/la " + genre + " « " + definition.nom + " » existe déjà.");
      definitions.set(definition.nom, Object.freeze({ ...definition }));
    },
    trouver: (nom) => definitions.get(nom) || null,
    noms: () => Array.from(definitions.keys()),
    toutes: () => Array.from(definitions.values())
  };
}

export const MESURES = creerRegistre("mesure");
export const FILTRES = creerRegistre("filtre");
export const REGROUPEMENTS = creerRegistre("regroupement");

// ---------- Geometrie estimee (boite englobante) ----------
export function boiteDe(element) {
  const b = typeof element.boite === "function" ? element.boite() : element.boite;
  return Array.isArray(b) || ArrayBuffer.isView(b) ? (b.length === 6 && Array.from(b).every(Number.isFinite) ? b : null) : null;
}

// Dimensions de la boite, de la plus grande a la plus petite, ou null sans boite.
function dimensions(element) {
  const b = boiteDe(element);
  if (!b) return null;
  return [Math.abs(b[3] - b[0]), Math.abs(b[4] - b[1]), Math.abs(b[5] - b[2])].sort((x, y) => y - x);
}

// Premiere quantite lue dont le nom figure dans la liste (noms Qto IFC4 usuels), ou null.
function quantiteLue(element, noms) {
  const q = element.quantites;
  if (!q) return null;
  for (const nom of noms) if (Number.isFinite(q[nom])) return q[nom];
  return null;
}

// ---------- Mesures ----------
MESURES.enregistrer({ nom: "nombre", libelle: "nombre", verbe: "Compter", unite: "u", origine: "compte", besoin: null, valeur: () => 1 });
MESURES.enregistrer({
  nom: "longueur_estimee", libelle: "longueur estimée", verbe: "Estimer la longueur", unite: "m", origine: "estime", besoin: "boite",
  // Plus grande dimension de la boite : bonne pour une gaine ou un tuyau droit, surestimee en diagonale.
  valeur: (element) => { const d = dimensions(element); return d ? d[0] : null; }
});
MESURES.enregistrer({
  nom: "surface_estimee", libelle: "surface estimée", verbe: "Estimer la surface", unite: "m²", origine: "estime", besoin: "boite",
  // Plus grande face de la boite (produit des deux plus grandes dimensions) : une face de mur, de dalle ou de faux plafond.
  valeur: (element) => { const d = dimensions(element); return d ? d[0] * d[1] : null; }
});
MESURES.enregistrer({
  nom: "volume_estime", libelle: "volume estimé", verbe: "Estimer le volume", unite: "m³", origine: "estime", besoin: "boite",
  // Volume de la boite : majorant du volume reel.
  valeur: (element) => { const d = dimensions(element); return d ? d[0] * d[1] * d[2] : null; }
});
// Emplacement des quantites IFC lues (Qto). Les noms de quantites sont ceux des Qto_*BaseQuantities d'IFC4 ; absentes des maquettes de l'hopital.
MESURES.enregistrer({
  nom: "qto_longueur", libelle: "longueur lue dans le modèle", verbe: "Lire la longueur", unite: "m", origine: "lu", besoin: "quantites",
  valeur: (element) => quantiteLue(element, ["Length", "NominalLength"])
});
MESURES.enregistrer({
  nom: "qto_surface", libelle: "surface lue dans le modèle", verbe: "Lire la surface", unite: "m²", origine: "lu", besoin: "quantites",
  valeur: (element) => quantiteLue(element, ["NetSideArea", "NetArea", "GrossSideArea", "GrossArea", "Area"])
});
MESURES.enregistrer({
  nom: "qto_volume", libelle: "volume lu dans le modèle", verbe: "Lire le volume", unite: "m³", origine: "lu", besoin: "quantites",
  valeur: (element) => quantiteLue(element, ["NetVolume", "GrossVolume", "Volume"])
});

// ---------- Filtres (OU entre les valeurs d'un meme filtre, ET entre filtres, filtre vide = pas de filtre) ----------
FILTRES.enregistrer({ nom: "typesIfc", source: "typesIfc", libelle: "type IFC", test: (e, v) => e.typeIfc === v });
FILTRES.enregistrer({ nom: "niveaux", source: "niveaux", libelle: "niveau", test: (e, v) => e.niveau === v });
FILTRES.enregistrer({ nom: "maquettes", source: "maquettes", libelle: "maquette", test: (e, v) => e.maquette === v });
// Mot ou « Famille:Type » contenu dans le nom de l'element, sans accents ni casse.
FILTRES.enregistrer({ nom: "noms", source: "noms", libelle: "nom", test: (e, v) => normaliser(e.famille || e.nom).includes(normaliser(String(v).replace(/:\d+$/, ""))) });

// ---------- Regroupements ----------
REGROUPEMENTS.enregistrer({ nom: "niveau", libelle: "Niveau", cle: (e) => e.niveau || SANS_NIVEAU, critere: { champ: "niveaux", valeur: (cle) => (cle === SANS_NIVEAU ? null : cle) } });
REGROUPEMENTS.enregistrer({ nom: "typeIfc", libelle: "Type IFC", cle: (e) => e.typeIfc || "Sans type", critere: { champ: "typesIfc", valeur: (cle) => cle } });
REGROUPEMENTS.enregistrer({ nom: "maquette", libelle: "Maquette", cle: (e) => e.maquette || "Sans maquette", critere: { champ: "maquettes", valeur: (cle) => cle } });
REGROUPEMENTS.enregistrer({ nom: "famille", libelle: "Famille / type", cle: (e) => e.famille || e.nom || "Sans nom", critere: { champ: "noms", valeur: (cle) => cle } });

// ---------- Requete ----------
const registresParDefaut = () => ({ mesures: MESURES, filtres: FILTRES, regroupements: REGROUPEMENTS });
const erreur = (message) => ({ ok: false, erreur: message });

// Verifie la forme d'une requete et, si `valeurs` est donne, que chaque valeur de filtre figure dans les listes reellement presentes.
// Rend { ok: true, requete } avec les quatre listes de filtres toujours presentes, ou { ok: false, erreur }.
export function validerRequete(requete, valeurs = null, registres = registresParDefaut()) {
  if (!requete || typeof requete !== "object" || Array.isArray(requete)) return erreur("La requête est absente ou mal formée.");
  const mesure = registres.mesures.trouver(requete.mesure);
  if (!mesure) return erreur("Mesure inconnue « " + requete.mesure + " » (attendu : " + registres.mesures.noms().join(", ") + ").");
  if (valeurs && Array.isArray(valeurs.mesures) && !valeurs.mesures.includes(mesure.nom)) return erreur("Mesure non disponible dans cette maquette : " + mesure.libelle + ".");

  const bruts = requete.filtres === undefined || requete.filtres === null ? {} : requete.filtres;
  if (typeof bruts !== "object" || Array.isArray(bruts)) return erreur("Les filtres sont mal formés.");
  const connus = registres.filtres.noms();
  const inconnu = Object.keys(bruts).find((nom) => !connus.includes(nom));
  if (inconnu) return erreur("Filtre inconnu « " + inconnu + " ».");
  const filtres = {};
  for (const filtre of registres.filtres.toutes()) {
    const liste = bruts[filtre.nom] === undefined ? [] : bruts[filtre.nom];
    if (!Array.isArray(liste) || liste.some((v) => typeof v !== "string" || !v.trim())) return erreur("Le filtre « " + filtre.nom + " » doit être une liste de textes.");
    if (valeurs) {
      const permises = valeurs[filtre.source] || [];
      const hors = liste.find((v) => !permises.includes(v));
      if (hors !== undefined) return erreur("Valeur « " + hors + " » absente de la maquette pour le filtre « " + filtre.nom + " ».");
    }
    filtres[filtre.nom] = Array.from(new Set(liste));
  }

  const groupes = requete.regroupements === undefined || requete.regroupements === null ? [] : requete.regroupements;
  if (!Array.isArray(groupes)) return erreur("Les regroupements sont mal formés.");
  if (groupes.length > REGROUPEMENTS_MAX) return erreur("Au plus " + REGROUPEMENTS_MAX + " regroupements.");
  if (new Set(groupes).size !== groupes.length) return erreur("Un regroupement est répété.");
  const mauvais = groupes.find((g) => !registres.regroupements.trouver(g));
  if (mauvais !== undefined) return erreur("Regroupement inconnu « " + mauvais + " ».");
  return { ok: true, requete: { mesure: mesure.nom, filtres, regroupements: groupes.slice() } };
}

// ---------- Calcul ----------
export function capacites(elements) {
  if (elements && elements.capacites) return elements.capacites;
  const liste = elements || [];
  return { boites: liste.some((e) => boiteDe(e) !== null), quantites: liste.some((e) => e.quantites && Object.keys(e.quantites).length > 0) };
}

// Mesures utilisables sur ce jeu d'elements (celles qui ont besoin d'une donnee absente de la maquette sont retirees).
export function mesuresDisponibles(elements, registre = MESURES) {
  const c = capacites(elements);
  return registre.toutes().filter((m) => !m.besoin || (m.besoin === "boite" && c.boites) || (m.besoin === "quantites" && c.quantites)).map((m) => m.nom);
}

const comparer = (a, b) => a.localeCompare(b, "fr", { numeric: true });
const arrondi = (n) => Math.round(n * 100) / 100;

// Criteres du lien « Voir dans le Viewer » d'une ligne : les filtres de la requete, precises par la cle de chaque regroupement.
function criteresLigne(filtres, cles, groupes, registre) {
  const criteres = {};
  for (const nom of CLES_FILTRES) criteres[nom] = (filtres[nom] || []).slice();
  groupes.forEach((nom, i) => {
    const c = registre.trouver(nom).critere;
    if (!c) return;
    const valeur = c.valeur(cles[i]);
    if (valeur !== null && valeur !== undefined) criteres[c.champ] = [valeur];
  });
  return criteres;
}

// Resultat :
//   { ok: true, requete, mesure: { nom, libelle, unite, origine, origineLibelle }, regroupements: [{ nom, libelle }],
//     lignes: [{ cles, valeur, nombre, sansDonnee, criteres }], totaux: { valeur, nombre, sansDonnee, criteres },
//     elementsPrisEnCompte, elementsExclus, aucunResultat, notes: [texte] }
//   ou { ok: false, code: "requete_invalide" | "mesure_indisponible", message }
// Mesure « Compter » : chaque element vaut 1, donc « Elements » egale la mesure et « sans donnee » vaut toujours 0 : une seule colonne de quantite.
// Les autres mesures gardent « Elements » (et « sans donnee ») a cote de la mesure. Source unique pour l'ecran, le CSV, le PDF et l'Excel.
export function aColonneElements(mesure) {
  return !mesure || mesure.nom !== "nombre";
}

export function calculer(elements, requete, registres = registresParDefaut()) {
  const verdict = validerRequete(requete, null, registres);
  if (!verdict.ok) return { ok: false, code: "requete_invalide", message: verdict.erreur };
  const q = verdict.requete;
  const mesure = registres.mesures.trouver(q.mesure);
  const liste = Array.isArray(elements) ? elements : [];
  if (mesure.besoin && !mesuresDisponibles(liste, registres.mesures).includes(mesure.nom)) {
    const cause = mesure.besoin === "boite" ? "la géométrie des maquettes n'est pas chargée" : "les maquettes ne contiennent aucune quantité IFC";
    return { ok: false, code: "mesure_indisponible", message: "Non disponible dans cette maquette : " + mesure.libelle + " (" + cause + ")." };
  }

  const filtresActifs = registres.filtres.toutes().filter((f) => q.filtres[f.nom].length > 0);
  let exclus = 0;
  const retenus = [];
  const concernees = new Set();
  for (const e of liste) {
    if (TYPES_SPATIAUX.has(e.typeIfc)) { exclus += 1; continue; }
    if (filtresActifs.every((f) => q.filtres[f.nom].some((v) => f.test(e, v)))) { retenus.push(e); if (e.maquette) concernees.add(e.maquette); }
  }

  const groupes = new Map(); // cle texte -> { cles, valeur, nombre, sansDonnee }
  const total = { valeur: 0, nombre: 0, sansDonnee: 0 };
  for (const e of retenus) {
    const cles = q.regroupements.map((nom) => registres.regroupements.trouver(nom).cle(e));
    const cle = JSON.stringify(cles);
    if (!groupes.has(cle)) groupes.set(cle, { cles, valeur: 0, nombre: 0, sansDonnee: 0 });
    const ligne = groupes.get(cle);
    const v = mesure.valeur(e);
    if (v === null || v === undefined || !Number.isFinite(v)) { ligne.sansDonnee += 1; total.sansDonnee += 1; continue; }
    ligne.valeur += v;
    ligne.nombre += 1;
    total.valeur += v;
    total.nombre += 1;
  }
  const lignes = Array.from(groupes.values())
    .sort((a, b) => { for (let i = 0; i < a.cles.length; i += 1) { const c = comparer(a.cles[i], b.cles[i]); if (c) return c; } return 0; })
    .map((l) => ({ ...l, valeur: arrondi(l.valeur), criteres: criteresLigne(q.filtres, l.cles, q.regroupements, registres.regroupements) }));

  // Maquettes concernees : celles qui fournissent au moins un element retenu ; sans resultat, celles citees par le filtre, sinon toutes.
  const toutes = Array.from(new Set(liste.map((e) => e.maquette).filter(Boolean)));
  const maquettesConcernees = (concernees.size ? Array.from(concernees) : q.filtres.maquettes.length ? q.filtres.maquettes : toutes).sort(comparer);
  const notes = [EXPLICATIONS_ORIGINES[mesure.origine]];
  const horsPerimetre = liste.horsPerimetre || 0;
  if (horsPerimetre > 0) notes.push(horsPerimetre + " élément" + (horsPerimetre > 1 ? "s" : "") + " exclu" + (horsPerimetre > 1 ? "s" : "") + " comme dans le Viewer (garde-corps mal placés de la maquette de l'hôpital).");
  if (mesure.origine === "estime") notes.push("Ce n'est pas une quantité IFC. Les unités sont celles de la scène (mètres supposés, non vérifiés).");
  if (total.sansDonnee > 0) notes.push(total.sansDonnee + " élément" + (total.sansDonnee > 1 ? "s" : "") + " sans donnée pour cette mesure, non ajouté" + (total.sansDonnee > 1 ? "s" : "") + ".");
  return {
    ok: true,
    requete: q,
    mesure: { nom: mesure.nom, libelle: mesure.libelle, unite: mesure.unite, origine: mesure.origine, origineLibelle: ORIGINES[mesure.origine] },
    regroupements: q.regroupements.map((nom) => ({ nom, libelle: registres.regroupements.trouver(nom).libelle })),
    lignes,
    totaux: { valeur: arrondi(total.valeur), nombre: total.nombre, sansDonnee: total.sansDonnee, criteres: criteresLigne(q.filtres, [], [], registres.regroupements) },
    elementsPrisEnCompte: retenus.length,
    elementsExclus: exclus,
    horsPerimetre,
    maquettesConcernees,
    aucunResultat: retenus.length === 0,
    notes
  };
}

// ---------- Relecture (compte rendu en francais de ce qui a ete compris) ----------
function listeFrancaise(mots) {
  if (mots.length <= 1) return mots.join("");
  return mots.slice(0, -1).join(", ") + " et " + mots[mots.length - 1];
}
// « Level 2 » -> « niveau 2 » ; un autre nom est repris tel quel.
function niveauCourt(nom) {
  const m = /^\s*(?:level|niveau)\s+(\S+)\s*$/i.exec(nom);
  return m ? m[1] : nom;
}

export function libelleRequete(requete, registres = registresParDefaut()) {
  const mesure = registres.mesures.trouver(requete.mesure);
  const f = requete.filtres || {};
  const types = Array.from(new Set((f.typesIfc || []).map(libelleTypeIfc)));
  const sujet = types.length ? listeFrancaise(types) : "éléments";
  const verbe = mesure ? mesure.verbe : "Compter";
  let phrase = verbe + (mesure && mesure.nom === "nombre" ? " les " : " des ") + sujet;
  if ((f.niveaux || []).length) {
    const n = f.niveaux.map(niveauCourt);
    phrase += (n.length > 1 ? " des niveaux " : " du niveau ") + listeFrancaise(n);
  }
  if ((f.maquettes || []).length) phrase += (f.maquettes.length > 1 ? " des maquettes " : " de la maquette ") + listeFrancaise(f.maquettes);
  if ((f.noms || []).length) phrase += " dont le nom contient " + listeFrancaise(f.noms.map((n) => "« " + n + " »"));
  const groupes = (requete.regroupements || []).map((g) => { const r = registres.regroupements.trouver(g); return r ? "par " + r.libelle.toLowerCase() : g; });
  if (groupes.length) phrase += ", " + listeFrancaise(groupes);
  return phrase + ".";
}

// ---------- Export CSV (Excel francais : UTF-8 avec BOM, separateur « ; », fins de ligne CRLF) ----------
const BOM = "﻿";
const nombreFr = (n) => String(n).replace(".", ",");

// Une cellule texte commencant par = + - @ serait interpretee comme une formule par Excel : prefixee d'une apostrophe.
function echapperCellule(valeur) {
  let texte = String(valeur === null || valeur === undefined ? "" : valeur);
  if (/^[=+\-@\t\r]/.test(texte) && !/^-?\d+([.,]\d+)?$/.test(texte)) texte = "'" + texte;
  return /[";\r\n]/.test(texte) ? '"' + texte.replace(/"/g, '""') + '"' : texte;
}

// remarques : lignes de texte ajoutees apres les donnees (avertissement compte / estime, etat obsolete), une cellule chacune.
export function exporterCsv(resultat, remarques = []) {
  if (!resultat || !resultat.ok) return BOM;
  const unite = resultat.mesure.unite ? " (" + resultat.mesure.unite + ")" : "";
  const libelleMesure = resultat.mesure.libelle.charAt(0).toUpperCase() + resultat.mesure.libelle.slice(1) + unite;
  const colonnesCles = resultat.regroupements.length ? resultat.regroupements.map((r) => r.libelle) : ["Sélection"];
  const deux = aColonneElements(resultat.mesure);
  const entete = deux ? [...colonnesCles, "Éléments pris en compte", libelleMesure, "Origine", "Éléments sans donnée"] : [...colonnesCles, libelleMesure, "Origine"];
  const rang = (cles, l) => (deux
    ? [...cles, l.nombre + l.sansDonnee, nombreFr(l.valeur), resultat.mesure.origineLibelle, l.sansDonnee]
    : [...cles, nombreFr(l.valeur), resultat.mesure.origineLibelle]);
  const rangs = resultat.lignes.map((l) => rang(l.cles.length ? l.cles : ["Ensemble"], l));
  // Sans regroupement, la ligne unique est deja le total ; sinon (ou sans aucun element) une ligne « Total » ferme le tableau.
  if (resultat.regroupements.length > 0 || rangs.length === 0) rangs.push(rang(["Total", ...Array(colonnesCles.length - 1).fill("")], resultat.totaux));
  const lignes = [entete, ...rangs].map((r) => r.map(echapperCellule).join(";"));
  if (remarques.length) lignes.push("", ...remarques.map((t) => echapperCellule(t)));
  return BOM + lignes.join("\r\n") + "\r\n";
}
