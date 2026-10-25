// Discussions par commande IA (24/10) : recherche par mots dans les messages, sans DOM ni reseau.
//
// Sert a la PRESELECTION locale de la recherche par sujet et du rapport : seuls les messages qui contiennent un mot de la demande (ou un mot
// voisin) sont envoyes a l'IA. Pas de modele de langage ici : mots sans accent ni casse, racines legeres (pluriels, suffixes courants), une petite
// table de synonymes du metier, et un poids par rarete du mot dans la messagerie (un mot present dans tous les messages ne pese presque rien).

import { normaliser } from "./reglesCollision.js";

// Mots vides et mots de commande : « montre », « trouve », « echange », « rapport »... ne disent rien du sujet cherche.
const MOTS_VIDES = new Set((
  "le la les l un une des du de d au aux et ou a en dans sur sous pour par avec sans que qui quoi dont ce cet cette ces mon ma mes ton ta tes son sa " +
  "ses notre nos leur leurs je tu il elle nous vous ils elles on y ne pas plus se est sont ete etre avoir ai as avons avez ont eu fait faire dit dire " +
  "dits dite parle parler parle montre montrer moi toi trouve trouver trouves affiche afficher donne donner fais fait echange echanges discussion " +
  "discussions message messages conversation conversations sujet sujets rapport resume resumer concernant propos probleme problematique tout tous " +
  "toute toutes tel telle tels quand comment ou ici la cela ca si mais donc car aussi comme entre vers chez depuis cette semaine jour jours mois " +
  "lequel laquelle ou etait avait ete peut pu doit faut oui non"
).split(/\s+/));

const SUFFIXES = ["ements", "ement", "ations", "ation", "ions", "ion", "euses", "euse", "eurs", "eur", "ees", "ee", "es", "e", "s", "x"];

// Groupes de mots voisins (racines, sans accent) : un mot du groupe en fait trouver un autre, a poids reduit.
const GROUPES_SYNONYMES = [
  ["cf", "ei", "incendie", "feu", "flamme"],
  ["reservation", "tremie", "percement", "fourreau", "passage"],
  ["gaine", "conduit", "ventilation", "cvc"],
  ["retard", "delai", "decalage", "glissement", "report"],
  ["maquette", "modele", "ifc"],
  ["collision", "conflit", "clash", "interference"],
  ["planning", "calendrier", "echeance", "jalon"],
  ["cout", "prix", "budget", "surcout", "devis"],
  ["validation", "valide", "approbation", "accord", "visa"],
  ["chantier", "travaux", "terrain"],
  ["grue", "levage", "montage"],
  ["structure", "beton", "coffrage", "armature", "ferraillage"],
  ["plan", "dessin"],
  ["cloison", "mur", "paroi", "voile"],
  ["ascenseur", "cage", "elevateur"],
  ["plafond", "faux", "suspente"]
].map((g) => g.map(racine));

// Racine legere d'un mot deja normalise (sans accent, en minuscules).
export function racine(mot) {
  for (const suffixe of SUFFIXES) {
    if (mot.endsWith(suffixe) && mot.length - suffixe.length >= 4) return mot.slice(0, -suffixe.length);
  }
  return mot;
}

const MOT = /[\p{L}\p{N}]+/gu;

// Mots utiles d'une phrase : normalises, sans mots vides, de 2 lettres ou plus, sans doublon.
export function motsUtiles(phrase) {
  const vus = new Set();
  for (const brut of normaliser(phrase).match(MOT) || []) {
    if (brut.length >= 2 && !MOTS_VIDES.has(brut)) vus.add(brut);
  }
  return Array.from(vus);
}

// Termes de recherche : un par mot utile, avec ses racines voisines (synonymes). { racine, voisines: [racine] }.
export function construireTermes(mots) {
  const termes = [];
  const vues = new Set();
  for (const mot of mots.flatMap((m) => motsUtiles(m))) {
    const r = racine(mot);
    if (vues.has(r)) continue;
    vues.add(r);
    const groupe = GROUPES_SYNONYMES.find((g) => g.includes(r));
    termes.push({ racine: r, voisines: groupe ? groupe.filter((v) => v !== r) : [] });
  }
  return termes;
}

// Le mot (normalise) correspond-il a cette racine ? Egalite de racine ; prefixe a partir de 5 lettres (« coupe-feu » trouve « coupe »).
function correspond(motNormalise, r) {
  const rm = racine(motNormalise);
  return rm === r || (r.length >= 5 && (rm.startsWith(r) || r.startsWith(rm) && rm.length >= 5));
}

// Racines des mots d'un texte, mises en cache sur l'objet (les messages ne changent pas apres leur creation).
const CACHE = new WeakMap();
function racinesDe(entree) {
  let r = CACHE.get(entree);
  if (!r) {
    r = (normaliser(entree.texte).match(MOT) || []).map(racine);
    CACHE.set(entree, r);
  }
  return r;
}
const contient = (racines, r) => racines.some((x) => x === r || (r.length >= 5 && (x.startsWith(r) || (x.length >= 5 && r.startsWith(x)))));

// Poids de rarete de chaque terme : ln(1 + N / (1 + nombre de messages qui le contiennent)).
function poids(termes, messages) {
  return termes.map((t) => {
    const df = messages.reduce((n, m) => n + (contient(racinesDe(m), t.racine) ? 1 : 0), 0);
    return Math.log(1 + messages.length / (1 + df));
  });
}

// Messages classes par pertinence, du plus au moins pertinent : [{ entree, score }]. Un message sans aucun terme n'est pas rendu.
// Un terme direct pese 1, un synonyme 0,6. Egalite : le plus recent d'abord.
export function classer(messages, termes) {
  if (!termes.length) return [];
  const w = poids(termes, messages);
  const sortie = [];
  for (const entree of messages) {
    const racines = racinesDe(entree);
    let score = 0;
    termes.forEach((t, i) => {
      if (contient(racines, t.racine)) score += w[i];
      else if (t.voisines.some((v) => contient(racines, v))) score += 0.6 * w[i];
    });
    if (score > 0) sortie.push({ entree, score });
  }
  return sortie.sort((a, b) => (b.score - a.score) || (b.entree.quand - a.entree.quand));
}

// Plages [debut, fin[ du texte (positions dans le texte ORIGINAL) qui portent un terme ou un synonyme.
export function plagesCorrespondantes(texte, termes) {
  const racines = termes.flatMap((t) => [t.racine, ...t.voisines]);
  const plages = [];
  for (const m of texte.matchAll(MOT)) {
    const mot = normaliser(m[0]);
    if (mot.length >= 2 && racines.some((r) => correspond(mot, r))) plages.push([m.index, m.index + m[0].length]);
  }
  return plages;
}

// Extrait court centre sur la premiere plage : { texte, plages } (plages relatives a l'extrait). Coupe aux espaces, « … » aux extremites coupees.
export function extraitAutour(texte, plages, max = 200) {
  if (texte.length <= max) return { texte, plages };
  const centre = plages.length ? plages[0][0] : 0;
  let debut = Math.max(0, centre - Math.floor(max / 4));
  if (debut > 0) { const e = texte.indexOf(" ", debut); if (e >= 0 && e < centre) debut = e + 1; }
  let fin = Math.min(texte.length, debut + max);
  if (fin < texte.length) { const e = texte.lastIndexOf(" ", fin); if (e > debut + max / 2) fin = e; }
  const prefixe = debut > 0 ? "… " : "";
  const suffixe = fin < texte.length ? " …" : "";
  const decalage = prefixe.length - debut;
  const gardees = plages.filter(([a, b]) => a >= debut && b <= fin).map(([a, b]) => [a + decalage, b + decalage]);
  return { texte: prefixe + texte.slice(debut, fin) + suffixe, plages: gardees };
}

// Texte en HTML avec <mark> sur les plages (le texte est echappe morceau par morceau : jamais de HTML venant des messages).
export function htmlSurligne(texte, plages, echapper) {
  let html = "";
  let pos = 0;
  for (const [a, b] of plages) {
    html += echapper(texte.slice(pos, a)) + "<mark>" + echapper(texte.slice(a, b)) + "</mark>";
    pos = b;
  }
  return html + echapper(texte.slice(pos));
}
