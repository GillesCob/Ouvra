// Discussions par commande IA (24/10) : le moteur. Pur (ni DOM ni reseau), pilote par le registre d'actions (src/discussionsIARegistre.js).
//
// Pipeline d'une demande, chaque etape testee a part :
//   1. validerCommande   la commande venue du modele (ou d'une phrase d'exemple) est reverifiee : action connue, personnes de la messagerie, periode valide
//   2. selectionner      recherche locale dans l'index (messages retenus, messages a mettre en evidence)
//   3. preparerAnalyse   (actions ia seulement) extraits bornes, numerotes M1, M2... avec une table locale numero -> message
//   4. conclure*         la reponse du modele est reverifiee : un numero qui n'existe pas dans la table est ECARTE ; un point de rapport sans source
//                        valide est ECARTE (regle du proprietaire : aucune information non sourcee)
//   5. construireResultat / le rapport sont rendus a l'affichage (src/messagerie, src/discussionsIARapportVue.js)

import { creerRegistre, STATUTS_SUJET } from "./discussionsIARegistre.js";
import { ACTIONS } from "./discussionsIAActions.js";
import { validerCritereDate } from "./reglesCollision.js";
import { plagesCorrespondantes, extraitAutour } from "./discussionsIATexte.js";
import { dateHeure } from "./messagerie/format.js";
import { normaliserRapport, chiffresSourcesTrouves, MOIS } from "./discussionsIARapportNormaliser.js";
import { rapportEnTexte } from "./discussionsIARapportFormat.js";

export const REGISTRE = creerRegistre(ACTIONS);

export const SUJET_MAX = 120;
export const MOTS_MAX = 6;
export const MOT_MAX = 40;
export const EXTRAIT_MAX = 400; // caracteres d'un message envoye a l'IA
export const DISCUSSION_MAX = 120; // memes bornes que le relais (relais/entreeDiscussions.js) : un titre de sujet cree dans la messagerie peut etre plus long
export const AUTEUR_MAX = 60;
export const BUDGET_EXTRAITS = 24000; // caracteres au plus pour l'ensemble des extraits en JSON (le corps accepte par le relais est de 30 000)
export const MESSAGE_RIEN = "Rien n'a été dit à ce sujet.";

const erreur = (message) => ({ ok: false, erreur: message });

// ---------- 1. Validation de la commande ----------
// valeurs : { personnes: [nom] } (les noms de la messagerie, rien d'autre). Rend { ok: true, commande: { action, parametres } } ou { ok: false, erreur }.
export function validerPeriode(periode) {
  const verdict = validerCritereDate({ evenement: "activite", presence: "au_moins_un", periode });
  return verdict.ok ? null : verdict.erreur;
}

const VALIDEURS = {
  personne(valeur, def, valeurs) {
    if (valeur == null) return def.obligatoire ? { erreur: "La personne est absente." } : { valeur: null };
    const cherchee = String(valeur).trim().toLowerCase();
    const nom = (valeurs.personnes || []).find((n) => n.toLowerCase() === cherchee);
    return nom ? { valeur: nom } : { erreur: "Personne inconnue « " + valeur + " »." };
  },
  texte(valeur, def) {
    const texte = typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "";
    if (!texte) return def.obligatoire ? { erreur: "Le sujet est absent." } : { valeur: "" };
    return texte.length <= SUJET_MAX ? { valeur: texte } : { erreur: "Le sujet est trop long." };
  },
  mots(valeur) {
    if (valeur == null) return { valeur: [] };
    if (!Array.isArray(valeur)) return { erreur: "Liste de mots mal formée." };
    const mots = valeur.filter((m) => typeof m === "string").map((m) => m.trim()).filter((m) => m && m.length <= MOT_MAX).slice(0, MOTS_MAX);
    return { valeur: Array.from(new Set(mots)) };
  },
  periode(valeur, def) {
    if (valeur == null) return def.obligatoire ? { erreur: "La période est absente." } : { valeur: null };
    const probleme = validerPeriode(valeur);
    return probleme ? { erreur: probleme } : { valeur };
  },
  statuts(valeur, _def, _valeurs, statutsPermis) {
    if (valeur == null) return { valeur: [] };
    if (!Array.isArray(valeur) || valeur.some((s) => !statutsPermis.includes(s))) return { erreur: "Statut inconnu." };
    return { valeur: Array.from(new Set(valeur)) };
  },
  booleen: (valeur) => ({ valeur: valeur === true })
};

export function validerCommande(commande, valeurs, registre = REGISTRE) {
  if (!commande || typeof commande !== "object" || Array.isArray(commande)) return erreur("Commande absente.");
  const action = registre.obtenir(commande.action);
  if (!action) return erreur("Action inconnue « " + commande.action + " ».");
  const brut = commande.parametres && typeof commande.parametres === "object" ? commande.parametres : {};
  const parametres = {};
  for (const def of action.parametres) {
    const verdict = VALIDEURS[def.genre](brut[def.nom], def, valeurs, STATUTS_SUJET);
    if (verdict.erreur) return erreur(verdict.erreur);
    parametres[def.nom] = verdict.valeur;
  }
  const incoherence = action.verifier ? action.verifier(parametres) : null;
  if (incoherence) return erreur(incoherence);
  return { ok: true, commande: { action: action.nom, parametres } };
}

// ---------- 2. Selection ----------
export function selectionner(commande, index, contexte, registre = REGISTRE) {
  const action = registre.obtenir(commande.action);
  if (!action) return { messages: [], mis: new Set(), scores: null, termes: [], voisins: new Set(), erreur: "Action inconnue." };
  return action.selectionner(commande.parametres, index, contexte);
}

// ---------- Resultat « liste » ----------
// elements : [{ entree, mis: boolean, score?: number }]. Rend les discussions concernees avec, pour chacune, ses messages mis en evidence et un extrait.
// ordre : "pertinence" (meilleure note d'abord) ou "recent" (dernier message d'abord).
export function construireResultat(elements, index, { termes = [], ordre = "recent" } = {}) {
  const parFil = new Map();
  for (const e of elements) {
    const liste = parFil.get(e.entree.filCle) || [];
    liste.push(e);
    parFil.set(e.entree.filCle, liste);
  }
  const fils = [];
  for (const [cle, liste] of parFil) {
    const fil = index.filParCle.get(cle);
    const mis = liste.filter((e) => e.mis).sort((a, b) => a.entree.quand - b.entree.quand);
    const reference = (mis.length ? mis : liste).slice().sort((a, b) => ((b.score || 0) - (a.score || 0)) || (b.entree.quand - a.entree.quand))[0];
    const plages = plagesCorrespondantes(reference.entree.texte, termes);
    fils.push({
      cle, convId: fil.convId, sujetId: fil.sujetId, convNom: fil.convNom, convType: fil.convType, titre: fil.titre, statut: fil.statut,
      total: liste.length, mis: mis.map((e) => e.entree.mk), premier: (mis[0] || liste[0]).entree.mk,
      meilleur: Math.max(...liste.map((e) => e.score || 0)), dernier: Math.max(...liste.map((e) => e.entree.quand)),
      extrait: { auteurNom: reference.entree.auteurNom, ...extraitAutour(reference.entree.texte, plages, 180) }
    });
  }
  fils.sort(ordre === "pertinence" ? (a, b) => (b.meilleur - a.meilleur) || (b.dernier - a.dernier) : (a, b) => b.dernier - a.dernier);
  return { fils, messages: elements.length, surlignes: fils.flatMap((f) => f.mis), termes };
}

// Resultat d'une action locale : tout ce qui est retenu, les messages « mis » en evidence.
export function resultatLocal(selection, index, ordre = "recent") {
  return construireResultat(selection.messages.map((entree) => ({ entree, mis: selection.mis.has(entree.mk), score: selection.scores ? selection.scores.get(entree.mk) : 0 })), index, { termes: selection.termes, ordre });
}

// ---------- 3. Preparation de l'analyse par l'IA ----------
function couper(texte, max) {
  if (texte.length <= max) return texte;
  const coupe = texte.lastIndexOf(" ", max);
  return texte.slice(0, coupe > max / 2 ? coupe : max).trimEnd() + " …";
}

const horodatage = (ms) => {
  const d = new Date(ms);
  const deux = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()) + " " + deux(d.getHours()) + ":" + deux(d.getMinutes());
};
const libelleDiscussion = (fil) => (fil.sujetId ? fil.titre : fil.convNom + " (principal)");

// Seul ce qui est utile a la synthese part : numero court, discussion, auteur, date, texte coupe. Ni cle de message, ni identifiant, ni piece jointe.
// Les libelles sont coupes aux bornes du relais, et l'ensemble est borne en taille : si le budget est depasse, on garde d'abord les messages les plus
// pertinents (les « mis »), puis le contexte, jusqu'a ce que le corps tienne (le relais refuse sinon toute la demande).
export function preparerAnalyse(selection, index) {
  const brut = (entree) => ({ discussion: couper(libelleDiscussion(index.filParCle.get(entree.filCle)), DISCUSSION_MAX), auteur: couper(entree.auteurNom, AUTEUR_MAX), quand: horodatage(entree.quand), texte: couper(entree.texte, EXTRAIT_MAX) });
  const parPriorite = selection.messages.slice().sort((a, b) => (selection.mis.has(b.mk) - selection.mis.has(a.mk)) || ((selection.scores && selection.scores.get(b.mk) || 0) - (selection.scores && selection.scores.get(a.mk) || 0)));
  const gardes = [];
  let taille = 0;
  for (const entree of parPriorite) {
    const extrait = brut(entree);
    const poids = JSON.stringify(extrait).length + 16; // + « id » et separateurs
    if (taille + poids > BUDGET_EXTRAITS) continue;
    taille += poids;
    gardes.push({ entree, extrait });
  }
  gardes.sort((a, b) => a.entree.quand - b.entree.quand);
  const table = new Map();
  const extraits = gardes.map(({ entree, extrait }, i) => {
    const id = "M" + (i + 1);
    table.set(id, entree);
    return { id, ...extrait };
  });
  return { extraits, table };
}

// ---------- Verification des chiffres et des dates ----------
// Voir src/discussionsIARapportNormaliser.js : un bloc de rapport ne contient aucun nombre ni mois absent de ses messages cites.
export { chiffresSourcesTrouves };
const textesAvecDate = (entree) => entree.texte + " " + horodatage(entree.quand) + " " + MOIS[new Date(entree.quand).getMonth()];

// ---------- 4a. Conclusion « classement » (retrouver_echange) ----------
export const PERTINENCES = ["forte", "moyenne"];

export function conclureClassement(sortie, table) {
  if (!sortie || typeof sortie !== "object" || !Array.isArray(sortie.resultats)) return { ok: false, erreur: "Classement absent." };
  const vus = new Set();
  const classes = [];
  let ecartes = 0;
  for (const r of sortie.resultats) {
    const entree = r && typeof r.id === "string" ? table.get(r.id) : null;
    if (!entree || vus.has(r.id)) { ecartes += 1; continue; } // numero inventé ou répété : écarté
    vus.add(r.id);
    classes.push({ entree, pertinence: PERTINENCES.includes(r.pertinence) ? r.pertinence : "moyenne" });
  }
  return { ok: true, classes, ecartes };
}

// Classement -> resultat « liste » (la pertinence forte pese plus que la moyenne ; a pertinence egale, l'ordre donne par le modele).
export function resultatClasse(classes, index, termes) {
  const n = classes.length;
  const elements = classes.map((c, i) => ({ entree: c.entree, mis: true, score: (c.pertinence === "forte" ? 2 : 1) * 1000 + (n - i) }));
  return construireResultat(elements, index, { termes, ordre: "pertinence" });
}

// ---------- 4b. Conclusion « rapport » (format fixe : titre, contexte, intervenants, desaccords, decision) ----------
const EXTRAIT_SOURCE_MAX = 180;

function sourceDe(id, entree, index, termes) {
  const fil = index.filParCle.get(entree.filCle);
  const plages = plagesCorrespondantes(entree.texte, termes);
  return {
    id, mk: entree.mk, auteurNom: entree.auteurNom, quand: entree.quand, quandLibelle: dateHeure(new Date(entree.quand)),
    discussion: libelleDiscussion(fil), extrait: extraitAutour(entree.texte, plages, EXTRAIT_SOURCE_MAX)
  };
}

// Rapport verifie, toujours au meme format (voir src/discussionsIARapportNormaliser.js pour les regles : numeros inconnus ecartes, decision jamais
// inventee, chiffre ou mois absent des sources = « non confirmé »). Sans rien d'exploitable : « Rien n'a été dit à ce sujet. ».
// maintenant : l'instant du rapport (date affichee « Rapport du JJ/MM/AAAA »).
export function conclureRapport(sortie, table, index, { sujet = "", termes = [], maintenant = Date.now() } = {}) {
  const titreParDefaut = "Récapitulatif : " + sujet;
  const vide = () => ({ ok: true, rapport: { titre: titreParDefaut, sujet, date: maintenant, vide: true, message: MESSAGE_RIEN, intervenants: [], desaccords: [], chronologie: [], analyses: table.size } });
  const auteurs = new Set(Array.from(table.values()).map((e) => e.auteurNom));
  const norme = normaliserRapport(sortie, {
    auteurs,
    texteDe: (id) => (table.has(id) ? textesAvecDate(table.get(id)) : null),
    auteurDe: (id) => (table.has(id) ? table.get(id).auteurNom : null)
  });
  if (!norme) return { ok: false, erreur: "Rapport absent." };
  if (norme.vide) return vide();

  const citees = new Map();
  const sources = (ids) => ids.map((id) => {
    if (!citees.has(id)) citees.set(id, sourceDe(id, table.get(id), index, termes));
    return citees.get(id);
  });
  const rapport = {
    titre: norme.titre || titreParDefaut, sujet, date: maintenant, vide: false,
    contexte: { ...norme.contexte, sources: sources(norme.contexte.sources) },
    intervenants: norme.intervenants,
    desaccords: norme.desaccords.map((d) => ({ ...d, sources: sources(d.sources) })),
    decision: { ...norme.decision, sources: sources(norme.decision.sources) }
  };
  rapport.chronologie = Array.from(citees.values()).sort((a, b) => a.quand - b.quand);
  rapport.analyses = table.size;
  return { ok: true, rapport };
}

export { rapportEnTexte };
