// Regles de collision en langage naturel, etape 1 : le moteur (22/10), sans interface.
//
// Une regle change la priorite ou le statut des collisions dont les elements correspondent a un filtre :
//   { demande: "texte saisi par l'utilisateur",
//     filtre: { portee: "un_des_deux" | "a" | "b" | "les_deux",
//               criteres: [{ champ: "nom" | "typeIfc" | "maquette" | "niveau", contient: "texte" }] },
//     action: { champ: "priorite" | "statut", valeur: "<valeur exacte>" } }
//
// Un element correspond si TOUS les criteres sont vrais sur CE MEME element (texte contenu, sans casse
// ni accents). L'action porte sur la collision entiere. Fonctions pures : aucune dependance a main.js,
// tout ce dont elles ont besoin (metaScene, maquettes, lecture d'etat) est passe en parametre.

export const CHAMPS_CRITERE = ["nom", "typeIfc", "maquette", "niveau"];
export const PORTEES = ["un_des_deux", "a", "b", "les_deux"];
export const CHAMPS_ACTION = ["priorite", "statut"];

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
  if (!Array.isArray(filtre.criteres) || filtre.criteres.length === 0) {
    return { ok: false, erreur: "Le filtre doit contenir au moins un critère." };
  }
  for (const critere of filtre.criteres) {
    if (!critere || !CHAMPS_CRITERE.includes(critere.champ)) {
      return { ok: false, erreur: "Champ de critère inconnu « " + (critere && critere.champ) + " » (attendu : " + CHAMPS_CRITERE.join(", ") + ")." };
    }
    if (typeof critere.contient !== "string" || normaliser(critere.contient).trim() === "") {
      return { ok: false, erreur: "Le critère « " + critere.champ + " » n'a pas de texte à chercher." };
    }
  }
  if (!action || typeof action !== "object") return { ok: false, erreur: "L'action de la règle est absente." };
  if (!CHAMPS_ACTION.includes(action.champ)) {
    return { ok: false, erreur: "Champ d'action inconnu « " + action.champ + " » (attendu : " + CHAMPS_ACTION.join(", ") + ")." };
  }
  const permises = (valeursPermises && valeursPermises[action.champ]) || [];
  if (!permises.includes(action.valeur)) {
    return { ok: false, erreur: "Valeur « " + action.valeur + " » non permise pour « " + action.champ + " » (attendu : " + permises.join(", ") + ")." };
  }
  return { ok: true };
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
// lireElement(entityId) rend un descripteur ; etatActuel(clash) rend { priorite, statut }.
// Les collisions fictives (factice) et celles sans elements (entityIds) ne sont jamais touchees.
export function appliquerRegle(regle, clashes, lireElement, etatActuel) {
  const { portee, criteres } = regle.filtre;
  const { champ, valeur } = regle.action;
  const touchees = [];
  (clashes || []).forEach((clash) => {
    if (clash.factice || !Array.isArray(clash.entityIds) || clash.entityIds.length < 2) return;
    const a = elementCorrespond(lireElement(clash.entityIds[0]), criteres);
    const b = elementCorrespond(lireElement(clash.entityIds[1]), criteres);
    const correspond = portee === "a" ? a : portee === "b" ? b : portee === "les_deux" ? a && b : a || b;
    if (!correspond) return;
    const de = etatActuel(clash)[champ];
    touchees.push({ clash, de, vers: valeur, inchange: de === valeur });
  });
  return touchees;
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
