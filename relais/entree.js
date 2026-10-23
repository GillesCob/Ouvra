// Validation de ce que la page envoie au relais (22/10). Rien n'est suppose : taille, types et listes sont verifies ici avant tout appel
// au modele. Seuls des MOTS arrivent (phrase, noms de types, de niveaux, de maquettes, d'elements) : aucune geometrie ne traverse, et tout
// champ inconnu est ignore.

export const PHRASE_MAX = 200;
export const CORPS_MAX = 30000; // octets (caracteres) du corps JSON
const LISTE_MAX = { typesIfc: 40, niveaux: 40, maquettes: 40, noms: 15, priorite: 8, statut: 8 };
const ELEMENT_MAX = { typesIfc: 80, niveaux: 80, maquettes: 80, noms: 160, priorite: 30, statut: 30 };
const LISTES_ACTION = ["priorite", "statut"]; // obligatoires et non vides
const LISTES_CRITERE = ["typesIfc", "niveaux", "maquettes", "noms"]; // facultatives : une maquette peut ne pas en avoir

const refus = (message) => ({ ok: false, code: "entree_invalide", message });

function nettoyerListe(nom, brut) {
  if (!Array.isArray(brut)) return { erreur: "La liste « " + nom + " » est absente." };
  if (brut.length > LISTE_MAX[nom] * 4) return { erreur: "La liste « " + nom + " » est trop longue." };
  const vus = new Set();
  for (const element of brut) {
    if (typeof element !== "string") return { erreur: "La liste « " + nom + " » contient autre chose que du texte." };
    const texte = element.trim();
    if (texte.length > ELEMENT_MAX[nom]) return { erreur: "Un élément de la liste « " + nom + " » est trop long." };
    if (texte) vus.add(texte);
  }
  if (vus.size > LISTE_MAX[nom]) return { erreur: "La liste « " + nom + " » est trop longue." };
  return { liste: Array.from(vus) };
}

export function validerEntree(corps) {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return refus("Demande mal formée.");
  if (typeof corps.phrase !== "string") return refus("La phrase est absente.");
  const phrase = corps.phrase.replace(/\s+/g, " ").trim();
  if (!phrase) return refus("La phrase est vide.");
  if (phrase.length > PHRASE_MAX) return refus("La phrase est trop longue (" + PHRASE_MAX + " caractères au plus).");
  if (!corps.valeurs || typeof corps.valeurs !== "object" || Array.isArray(corps.valeurs)) return refus("Les valeurs de la maquette sont absentes.");
  const valeurs = {};
  for (const nom of [...LISTES_CRITERE, ...LISTES_ACTION]) {
    const { liste, erreur } = nettoyerListe(nom, corps.valeurs[nom]);
    if (erreur) return refus(erreur);
    if (LISTES_ACTION.includes(nom) && liste.length === 0) return refus("La liste « " + nom + " » est vide.");
    valeurs[nom] = liste;
  }
  return { ok: true, phrase, valeurs };
}
