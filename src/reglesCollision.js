// Regles de collision en langage naturel, etape 1 : le moteur (22/10, etendu le 23/10), sans interface.
//
// Une regle selectionne des collisions par un filtre, puis agit dessus :
//   { demande: "texte saisi par l'utilisateur",
//     filtre: { portee: "un_des_deux" | "a" | "b" | "les_deux",
//               criteres: [{ champ: "nom" | "typeIfc" | "maquette" | "niveau", contient: "texte" }],   // sur les ELEMENTS en conflit
//               etat: { priorite?: "<valeur>", statut?: "<valeur>" },                                  // sur la COLLISION
//               dates: [{ evenement: "message" | "modification" | "activite",                          // sur les echanges de la collision
//                         presence: "au_moins_un" | "aucun",
//                         periode: { type: "depuis", nombre, unite: "jour" | "semaine" | "mois" }      // les N derniers jours / semaines / mois
//                                | { type: "depuis_le", date: "AAAA-MM-JJ" }                           // du jour indique (inclus) a maintenant
//                                | { type: "avant", date: "AAAA-MM-JJ" }                               // avant le jour indique (exclu)
//                                | { type: "entre", du: "AAAA-MM-JJ", au: "AAAA-MM-JJ" } }] },         // du premier au dernier jour, inclus
//               numeros: [3, 5],                                                                         // sur le NUMERO AFFICHE de la collision (28/10) : « la collision 3 », « les collisions 3 et 5 »
//     action: { champ: "priorite" | "statut", valeur: "<valeur exacte>" } | { champ: "afficher" } }
// Le filtre porte au moins un critere d'element, un etat, une date ou un numero. Tous les filtres presents sont vrais ensemble.
//
// Un element correspond si TOUS les criteres sont vrais sur CE MEME element (texte contenu, sans casse ni accents). L'action de changement
// porte sur la collision entiere ; « afficher » ne change rien : elle liste les collisions trouvees. Une date se lit dans les messages
// (discussion) et les modifications de priorite ou de statut (historique) de la collision, via le contexte passe a appliquerRegle.
// Fonctions pures : aucune dependance a main.js, tout ce dont elles ont besoin (metaScene, maquettes, lecture d'etat) est passe en parametre.

export const CHAMPS_CRITERE = ["nom", "typeIfc", "maquette", "niveau"];
export const PORTEES = ["un_des_deux", "a", "b", "les_deux"];
export const CHAMPS_ACTION = ["priorite", "statut"];
export const ACTION_AFFICHER = "afficher";
export const EVENEMENTS = ["message", "modification", "activite"];
export const PRESENCES = ["au_moins_un", "aucun"];
export const UNITES = ["jour", "semaine", "mois"];
const NOMBRE_MAX = 365;
export const NUMEROS_MAX = 100; // numeros cites au plus dans une regle
const estNumero = (n) => Number.isInteger(n) && n >= 1;
const JOUR_MS = 24 * 3600 * 1000;

// Minuscules, sans accents, pour une recherche tolerante.
export function normaliser(texte) {
  return String(texte == null ? "" : texte).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Nom de l'etage (IfcBuildingStorey) ancetre d'un metaObject, ou "" s'il n'y en a pas.
function niveauDe(metaObject) {
  let courant = metaObject;
  while (courant) {
    if (courant.type === "IfcBuildingStorey") return courant.name || "";
    courant = courant.parent;
  }
  return "";
}

// maquettes : [{ id, label }]. Rend l'entree de la maquette qui porte le metaObject.
function maquetteDe(metaObject, maquettes) {
  const metaModel = (metaObject.metaModels || [])[0];
  const id = metaModel ? metaModel.id : "";
  const trouvee = (maquettes || []).find((m) => m.id === id);
  return { id, label: trouvee ? trouvee.label : id };
}

// Descripteur d'un element lu dans les metadonnees IFC chargees, ou null si l'element est inconnu.
export function descripteurElement(metaScene, entityId, maquettes) {
  const metaObject = metaScene && metaScene.metaObjects ? metaScene.metaObjects[entityId] : null;
  if (!metaObject) return null;
  const maquette = maquetteDe(metaObject, maquettes);
  return {
    nom: metaObject.name || "",
    typeIfc: metaObject.type || "",
    niveau: niveauDe(metaObject),
    maquette: maquette.label,
    maquetteId: maquette.id
  };
}

// Verifie le format d'une regle. valeursPermises : { priorite: [...], statut: [...] }.
export function validerRegle(regle, valeursPermises) {
  if (!regle || typeof regle !== "object") return { ok: false, erreur: "La règle est absente ou mal formée." };
  const { filtre, action } = regle;
  if (!filtre || typeof filtre !== "object") return { ok: false, erreur: "Le filtre de la règle est absent." };
  if (!PORTEES.includes(filtre.portee)) {
    return { ok: false, erreur: "Portée inconnue « " + filtre.portee + " » (attendu : " + PORTEES.join(", ") + ")." };
  }
  const criteres = filtre.criteres === undefined ? [] : filtre.criteres;
  if (!Array.isArray(criteres)) return { ok: false, erreur: "Les critères du filtre sont mal formés." };
  for (const critere of criteres) {
    if (!critere || !CHAMPS_CRITERE.includes(critere.champ)) {
      return { ok: false, erreur: "Champ de critère inconnu « " + (critere && critere.champ) + " » (attendu : " + CHAMPS_CRITERE.join(", ") + ")." };
    }
    if (typeof critere.contient !== "string" || normaliser(critere.contient).trim() === "") {
      return { ok: false, erreur: "Le critère « " + critere.champ + " » n'a pas de texte à chercher." };
    }
  }
  const etatFiltre = filtre.etat === undefined ? {} : filtre.etat;
  if (!etatFiltre || typeof etatFiltre !== "object" || Array.isArray(etatFiltre)) return { ok: false, erreur: "L'état du filtre est mal formé." };
  const champsEtat = Object.keys(etatFiltre).filter((k) => etatFiltre[k] != null);
  for (const champ of champsEtat) {
    if (!CHAMPS_ACTION.includes(champ)) return { ok: false, erreur: "Champ d'état inconnu « " + champ + " » (attendu : " + CHAMPS_ACTION.join(", ") + ")." };
    const permisesEtat = (valeursPermises && valeursPermises[champ]) || [];
    if (!permisesEtat.includes(etatFiltre[champ])) {
      return { ok: false, erreur: "Valeur « " + etatFiltre[champ] + " » non permise pour « " + champ + " » (attendu : " + permisesEtat.join(", ") + ")." };
    }
  }
  const dates = filtre.dates === undefined ? [] : filtre.dates;
  if (!Array.isArray(dates)) return { ok: false, erreur: "Les dates du filtre sont mal formées." };
  for (const critereDate of dates) {
    const verdictDate = validerCritereDate(critereDate);
    if (!verdictDate.ok) return verdictDate;
  }
  const numeros = filtre.numeros === undefined ? [] : filtre.numeros;
  if (!Array.isArray(numeros) || numeros.length > NUMEROS_MAX || !numeros.every(estNumero) || (filtre.numeros !== undefined && numeros.length === 0)) {
    return { ok: false, erreur: "Les numéros de collision doivent être une liste d'entiers à partir de 1 (" + NUMEROS_MAX + " au plus)." };
  }
  if (criteres.length === 0 && champsEtat.length === 0 && dates.length === 0 && numeros.length === 0) {
    return { ok: false, erreur: "Le filtre doit contenir au moins un critère d'élément, un état, une date ou un numéro de collision." };
  }
  if (!action || typeof action !== "object") return { ok: false, erreur: "L'action de la règle est absente." };
  if (action.champ === ACTION_AFFICHER) return { ok: true };
  if (!CHAMPS_ACTION.includes(action.champ)) {
    return { ok: false, erreur: "Champ d'action inconnu « " + action.champ + " » (attendu : " + [...CHAMPS_ACTION, ACTION_AFFICHER].join(", ") + ")." };
  }
  const permises = (valeursPermises && valeursPermises[action.champ]) || [];
  if (!permises.includes(action.valeur)) {
    return { ok: false, erreur: "Valeur « " + action.valeur + " » non permise pour « " + action.champ + " » (attendu : " + permises.join(", ") + ")." };
  }
  return { ok: true };
}

// ---------- Dates ----------
const FORMAT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Jour calendaire « AAAA-MM-JJ » -> { annee, mois, jour }, ou null si le format ou le calendrier est faux (30 fevrier...).
function lireJour(texte) {
  const m = typeof texte === "string" ? FORMAT_DATE.exec(texte) : null;
  if (!m) return null;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(annee, mois - 1, jour);
  return d.getFullYear() === annee && d.getMonth() === mois - 1 && d.getDate() === jour ? { annee, mois, jour } : null;
}
const debutDuJour = (j) => new Date(j.annee, j.mois - 1, j.jour, 0, 0, 0, 0).getTime();
const finDuJour = (j) => new Date(j.annee, j.mois - 1, j.jour, 23, 59, 59, 999).getTime();

// Verifie un critere de date { evenement, presence, periode }.
export function validerCritereDate(critere) {
  const erreur = (message) => ({ ok: false, erreur: message });
  if (!critere || typeof critere !== "object") return erreur("Le critère de date est absent.");
  if (!EVENEMENTS.includes(critere.evenement)) return erreur("Événement de date inconnu « " + critere.evenement + " » (attendu : " + EVENEMENTS.join(", ") + ").");
  if (!PRESENCES.includes(critere.presence)) return erreur("Présence de date inconnue « " + critere.presence + " » (attendu : " + PRESENCES.join(", ") + ").");
  const p = critere.periode;
  if (!p || typeof p !== "object") return erreur("La période du critère de date est absente.");
  if (p.type === "depuis") {
    if (!Number.isInteger(p.nombre) || p.nombre < 1 || p.nombre > NOMBRE_MAX) return erreur("Le nombre de la période doit être un entier de 1 à " + NOMBRE_MAX + ".");
    if (!UNITES.includes(p.unite)) return erreur("Unité de période inconnue « " + p.unite + " » (attendu : " + UNITES.join(", ") + ").");
    return { ok: true };
  }
  if (p.type === "depuis_le" || p.type === "avant") {
    return lireJour(p.date) ? { ok: true } : erreur("Date invalide « " + p.date + " » (attendu : AAAA-MM-JJ).");
  }
  if (p.type === "entre") {
    const du = lireJour(p.du);
    const au = lireJour(p.au);
    if (!du || !au) return erreur("Dates invalides (attendu : AAAA-MM-JJ).");
    return debutDuJour(du) <= finDuJour(au) ? { ok: true } : erreur("La date de fin précède la date de début.");
  }
  return erreur("Type de période inconnu « " + p.type + " ».");
}

// Periode -> { debut, fin } en millisecondes (bornes incluses ; Infinity / -Infinity pour une borne ouverte). maintenant : instant de reference.
export function periodeEnMs(periode, maintenant) {
  if (periode.type === "depuis") {
    if (periode.unite === "mois") {
      const d = new Date(maintenant);
      d.setMonth(d.getMonth() - periode.nombre);
      return { debut: d.getTime(), fin: maintenant };
    }
    return { debut: maintenant - periode.nombre * (periode.unite === "semaine" ? 7 : 1) * JOUR_MS, fin: maintenant };
  }
  if (periode.type === "depuis_le") return { debut: debutDuJour(lireJour(periode.date)), fin: Infinity };
  if (periode.type === "avant") return { debut: -Infinity, fin: debutDuJour(lireJour(periode.date)) - 1 };
  return { debut: debutDuJour(lireJour(periode.du)), fin: finDuJour(lireJour(periode.au)) };
}

// Le critere de date est vrai pour ces evenements [{ type: "message" | "modification", quand: ms }] ? Un evenement sans date lisible est ignore.
function dateCorrespond(critere, evenements, maintenant) {
  const { debut, fin } = periodeEnMs(critere.periode, maintenant);
  const concernes = (evenements || []).filter((e) => Number.isFinite(e.quand) && (critere.evenement === "activite" || e.type === critere.evenement));
  const dansLaPeriode = concernes.some((e) => e.quand >= debut && e.quand <= fin);
  return critere.presence === "aucun" ? !dansLaPeriode : dansLaPeriode;
}

// Tous les criteres vrais sur ce descripteur. Le critere « maquette » cherche dans le libelle ET dans l'id.
function elementCorrespond(descripteur, criteres) {
  if (!descripteur) return false;
  return criteres.every((critere) => {
    const aiguille = normaliser(critere.contient).trim();
    const champs = critere.champ === "maquette" ? [descripteur.maquette, descripteur.maquetteId] : [descripteur[critere.champ]];
    return champs.some((valeur) => normaliser(valeur).includes(aiguille));
  });
}

// Collisions touchees par la regle, dans l'ordre de la liste : { clash, de, vers, inchange }.
// Pour « afficher », de et vers valent null et inchange est faux : la collision est simplement trouvee.
// lireElement(entityId) rend un descripteur ; etatActuel(clash) rend { priorite, statut }.
// contexte (facultatif, requis pour un filtre de date ou de numero) : { maintenant: ms, evenements(clash) -> [{ type: "message" | "modification", quand: ms }],
// numero(clash) -> numero AFFICHE de la collision (celui de la liste, des pastilles et de la modale) }. Un filtre de numero sans numero(clash) ne touche rien.
// Les collisions fictives (factice) et celles sans elements (entityIds) ne sont jamais touchees.
export function appliquerRegle(regle, clashes, lireElement, etatActuel, contexte = {}) {
  const { portee, criteres = [], etat: etatFiltre = {}, dates = [], numeros = [] } = regle.filtre;
  const { champ, valeur } = regle.action;
  const afficher = champ === ACTION_AFFICHER;
  const maintenant = Number.isFinite(contexte.maintenant) ? contexte.maintenant : Date.now();
  const touchees = [];
  (clashes || []).forEach((clash) => {
    if (clash.factice || !Array.isArray(clash.entityIds) || clash.entityIds.length < 2) return;
    if (numeros.length && !(typeof contexte.numero === "function" && numeros.includes(contexte.numero(clash)))) return;
    if (criteres.length) {
      const a = elementCorrespond(lireElement(clash.entityIds[0]), criteres);
      const b = elementCorrespond(lireElement(clash.entityIds[1]), criteres);
      const correspond = portee === "a" ? a : portee === "b" ? b : portee === "les_deux" ? a && b : a || b;
      if (!correspond) return;
    }
    const actuel = etatActuel(clash);
    if (Object.keys(etatFiltre).some((k) => etatFiltre[k] != null && actuel[k] !== etatFiltre[k])) return;
    if (dates.length) {
      const evenements = contexte.evenements ? contexte.evenements(clash) : [];
      if (!dates.every((d) => dateCorrespond(d, evenements, maintenant))) return;
    }
    if (afficher) { touchees.push({ clash, de: null, vers: null, inchange: false }); return; }
    const de = actuel[champ];
    touchees.push({ clash, de, vers: valeur, inchange: de === valeur });
  });
  return touchees;
}

// Message de la modale quand aucune collision n'est touchee. numerosExistants : numeros affiches des collisions de la detection.
// Un numero cite qui n'existe pas est nomme ; sinon le message habituel.
export function messageAucuneCollision(regle, numerosExistants = []) {
  const inconnus = ((regle.filtre && regle.filtre.numeros) || []).filter((n) => !numerosExistants.includes(n));
  if (inconnus.length) return "Aucune collision " + inconnus.map((n) => "n° " + n).join(" ni ") + " dans cette détection.";
  return regle.action && regle.action.champ === ACTION_AFFICHER ? "Aucune collision ne correspond à cette demande." : "Aucune collision ne correspond à cette règle.";
}

// Valeurs reellement presentes dans les maquettes chargees (pour contraindre plus tard l'IA).
export function valeursPossibles(metaScene, maquettes) {
  const types = new Set();
  const niveaux = new Set();
  const ids = new Set();
  Object.values((metaScene && metaScene.metaObjects) || {}).forEach((mo) => {
    if (mo.type) types.add(mo.type);
    if (mo.type === "IfcBuildingStorey" && mo.name) niveaux.add(mo.name);
    (mo.metaModels || []).forEach((m) => ids.add(m.id));
  });
  const trier = (ensemble) => Array.from(ensemble).sort((x, y) => x.localeCompare(y, "fr", { numeric: true }));
  const presentes = (maquettes || []).filter((m) => ids.has(m.id)).map((m) => m.label);
  return { typesIfc: trier(types), niveaux: trier(niveaux), maquettes: trier(new Set(presentes)) };
}
