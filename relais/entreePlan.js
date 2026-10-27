// Validation de ce que la page envoie a POST /api/plan (25/10, IA du plan 2D). Meme principe que relais/entreeQuantitatif.js : rien n'est suppose, taille et types sont
// verifies avant tout appel au modele. Seuls des MOTS et des NOMBRES arrivent : la phrase, les libelles des pieces et la description textuelle du plan
// (src/plan3d/ia/descriptionPlan.js, texteDuPlan). Jamais l'image du plan, jamais une coordonnee. Tout champ inconnu est ignore.

const PHRASE_PLAN_MAX = 400;
const PIECES_MAX = 40;
const LIBELLE_MAX = 80;
const TEXTE_MAX = 12000;

const refus = (message) => ({ ok: false, code: "entree_invalide", message });

export function validerEntreePlan(corps) {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return refus("Demande mal formée.");
  if (typeof corps.phrase !== "string") return refus("La phrase est absente.");
  const phrase = corps.phrase.replace(/\s+/g, " ").trim();
  if (!phrase) return refus("La phrase est vide.");
  if (phrase.length > PHRASE_PLAN_MAX) return refus("La phrase est trop longue (" + PHRASE_PLAN_MAX + " caractères au plus).");
  if (!Array.isArray(corps.libelles) || corps.libelles.length === 0) return refus("La liste des pièces est absente ou vide.");
  if (corps.libelles.length > PIECES_MAX) return refus("Le plan a trop de pièces (" + PIECES_MAX + " au plus).");
  const libelles = [];
  for (const l of corps.libelles) {
    if (typeof l !== "string") return refus("La liste des pièces contient autre chose que du texte.");
    const texte = l.trim();
    if (!texte || texte.length > LIBELLE_MAX) return refus("Un nom de pièce est vide ou trop long.");
    if (libelles.includes(texte)) return refus("Deux pièces portent le même nom.");
    libelles.push(texte);
  }
  if (typeof corps.texte !== "string" || !corps.texte.trim()) return refus("La description du plan est absente.");
  if (corps.texte.length > TEXTE_MAX) return refus("La description du plan est trop longue.");
  return { ok: true, phrase, libelles, texte: corps.texte.trim() };
}
