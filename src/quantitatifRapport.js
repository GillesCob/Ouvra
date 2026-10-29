// Rapport de quantitatif (24/10) : le MODELE DE DONNEES NEUTRE d'un resultat, independant de tout rendu (ecran, PDF, Excel, CSV).
// Un rendu ne recalcule rien : il met en forme ce que ce module fournit. Ajouter un format ou un modele = un nouveau rendu qui lit `tableauDe(rapport)`.
//
//   rapport = { id, version, phrase, relecture, calculeLe (ISO), requete, resultat (sortie de calculer), maquettes: [{ id, label, url, empreinte }] }
//     (maquettes = SEULEMENT celles concernees par la requete, avec l'empreinte relevee au calcul : voir src/quantitatifVersions.js)
//   tableauDe(rapport) = { colonnes, lignes, total, metre } pense pour un metre / un tableur de chiffrage :
//     colonnes : [{ cle, libelle, type: "texte" | "nombre", unite? }] ; lignes : tableaux de valeurs (un enregistrement par ligne, jamais de fusion).

import { libelleRequete, aColonneElements, ORIGINES, EXPLICATIONS_ORIGINES } from "./quantitatif.js";

export const VERSION_RAPPORT = 1;

// versions : [{ id, label, url, empreinte }] de toutes les maquettes chargees. Garde seulement celles concernees par le resultat.
export function construireRapport({ resultat, phrase, calculeLe = new Date(), versions = [], id = null }) {
  if (!resultat || !resultat.ok) throw new Error("Un rapport se construit à partir d'un résultat calculé.");
  const concernees = new Set(resultat.maquettesConcernees || []);
  const maquettes = versions.filter((v) => concernees.has(v.label)).map((v) => ({ id: v.id, label: v.label, url: v.url || "", empreinte: v.empreinte || null }));
  // Une maquette concernee mais absente de la liste des versions est gardee sans empreinte : sa version sera dite « inconnue ».
  for (const label of concernees) if (!maquettes.some((m) => m.label === label)) maquettes.push({ id: label, label, url: "", empreinte: null });
  return {
    id: id || "r-" + new Date(calculeLe).getTime().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    version: VERSION_RAPPORT,
    phrase: String(phrase || ""),
    relecture: libelleRequete(resultat.requete),
    calculeLe: new Date(calculeLe).toISOString(),
    requete: resultat.requete,
    resultat,
    maquettes
  };
}

const TEXTE_ENSEMBLE = "Ensemble des éléments retenus";

export function tableauDe(rapport) {
  const r = rapport.resultat;
  const unite = r.mesure.unite;
  const deux = aColonneElements(r.mesure);
  const colonnesCles = r.regroupements.length ? r.regroupements.map((g) => ({ cle: g.nom, libelle: g.libelle, type: "texte" })) : [{ cle: "selection", libelle: "Désignation", type: "texte" }];
  const colonnes = [
    ...colonnesCles,
    { cle: "unite", libelle: "Unité", type: "texte" },
    { cle: "quantite", libelle: "Quantité (" + r.mesure.libelle + ")", type: "nombre", unite },
    { cle: "origine", libelle: "Origine", type: "texte" },
    ...(deux ? [{ cle: "elements", libelle: "Éléments", type: "nombre" }, { cle: "sansDonnee", libelle: "Sans donnée", type: "nombre" }] : [])
  ];
  const lignes = r.lignes.map((l) => [...(l.cles.length ? l.cles : [TEXTE_ENSEMBLE]), unite, l.valeur, r.mesure.origineLibelle, ...(deux ? [l.nombre + l.sansDonnee, l.sansDonnee] : [])]);
  return {
    colonnes,
    lignes,
    nCles: colonnesCles.length,
    avecElements: deux,
    total: { quantite: r.totaux.valeur, elements: r.totaux.nombre + r.totaux.sansDonnee, sansDonnee: r.totaux.sansDonnee, unite, origine: r.mesure.origineLibelle },
    metre: { origine: r.mesure.origine, explication: EXPLICATIONS_ORIGINES[r.mesure.origine], origines: ORIGINES }
  };
}

// Bloc d'informations commun a tous les rendus : [[intitule, valeur]]. `statut` : { etat, ... } de comparerVersions (ou null) ; `libelle` : texte du statut.
export function informationsDe(rapport, libelleStatutTexte) {
  const r = rapport.resultat;
  const f = rapport.requete.filtres;
  const filtres = [["Types IFC", f.typesIfc], ["Niveaux", f.niveaux], ["Maquettes", f.maquettes], ["Noms", f.noms]].filter(([, v]) => v.length).map(([n, v]) => n + " : " + v.join(", "));
  const infos = [
    ["Demande", rapport.phrase],
    ["Requête comprise", rapport.relecture],
    ["Mesure", r.mesure.libelle + (r.mesure.unite ? " (" + r.mesure.unite + ")" : "") + ", origine : " + r.mesure.origineLibelle],
    ["Filtres", filtres.length ? filtres.join(" ; ") : "aucun"],
    ["Calculé le", new Date(rapport.calculeLe).toLocaleString("fr-FR")],
    ["Maquettes concernées", rapport.maquettes.map((m) => m.label + (m.empreinte ? "" : " (version inconnue)")).join(", ") || "aucune"],
    ["Éléments pris en compte", String(r.elementsPrisEnCompte)]
  ];
  if (libelleStatutTexte) infos.push(["État du rapport", libelleStatutTexte]);
  return infos;
}

// Resume pour la liste d'historique.
export function resumeRapport(rapport) {
  return { id: rapport.id, phrase: rapport.phrase, relecture: rapport.relecture, calculeLe: rapport.calculeLe, nombreLignes: rapport.resultat.lignes.length, maquettes: rapport.maquettes.map((m) => m.label), aucunResultat: rapport.resultat.aucunResultat };
}

// Nombre au format francais (virgule decimale, espace pour les milliers) avec des espaces ORDINAIRES : les espaces insecables fines d'Intl ne sont
// pas dans l'encodage des polices standard du PDF et s'y affichent mal.
const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
export const formaterNombre = (n) => format.format(n).replace(/[\u202f\u00a0]/g, " ");

export const NOM_FICHIER_BASE = "quantitatif";
// Nom de fichier sans caracteres genants : quantitatif-AAAA-MM-JJ-HHhMM.ext
export function nomFichier(rapport, extension) {
  const d = new Date(rapport.calculeLe);
  const deux = (n) => String(n).padStart(2, "0");
  return NOM_FICHIER_BASE + "-" + d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()) + "-" + deux(d.getHours()) + "h" + deux(d.getMinutes()) + "." + extension;
}

// Date relative lisible dans la liste d'historique : « à l'instant », « il y a 5 min », « il y a 3 h », « hier », sinon la date. L'horodatage complet reste en infobulle.
export function dateRelative(iso, maintenant = new Date()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const minutes = Math.floor((new Date(maintenant).getTime() - t) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return "il y a " + minutes + " min";
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return "il y a " + heures + " h";
  const jours = Math.floor(heures / 24);
  if (jours === 1) return "hier";
  if (jours < 7) return "il y a " + jours + " jours";
  return new Date(t).toLocaleDateString("fr-FR");
}
