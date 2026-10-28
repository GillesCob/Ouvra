// Validation d'un retour de visiteur (28/10) : POST /api/retour. PURE (ni reseau ni DOM), comme relais/entree.js.
// Un retour = un type (bug ou idee), un message, la page d'origine et un contact, les deux derniers facultatifs. Le champ « site » est un PIEGE a robots : invisible
// pour une personne, un robot le remplit ; rempli, le retour est ignore sans erreur (le robot ne sait pas qu'il a ete reconnu).
// Rend { ok: true, type, message, page, contact, piege } ou { ok: false, message }.

export const TYPES_RETOUR = ["bug", "idee"];
export const MESSAGE_MAX = 1000;
export const PAGE_MAX = 40;
export const CONTACT_MAX = 120;
export const CORPS_RETOUR_MAX = 4000; // octets de JSON acceptes avant meme de l'analyser

const estObjet = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const sansControle = (t) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ""); // garde le saut de ligne (\n) pour le message
const uneLigne = (t) => t.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function validerEntreeRetour(corps) {
  if (!estObjet(corps)) return { ok: false, message: "Le retour n'est pas valide." };
  if (!TYPES_RETOUR.includes(corps.type)) return { ok: false, message: "Choisis « Bug » ou « Idée »." };
  if (typeof corps.message !== "string") return { ok: false, message: "Écris ton retour." };
  const message = sansControle(corps.message.replace(/\r\n?/g, "\n")).trim();
  if (!message) return { ok: false, message: "Écris ton retour." };
  if (message.length > MESSAGE_MAX) return { ok: false, message: "Ton retour dépasse " + MESSAGE_MAX + " caractères." };
  const page = typeof corps.page === "string" ? uneLigne(corps.page).slice(0, PAGE_MAX) : "";
  const contact = typeof corps.contact === "string" ? uneLigne(corps.contact) : "";
  if (contact && (contact.length > CONTACT_MAX || !EMAIL.test(contact))) return { ok: false, message: "L'adresse e-mail n'est pas valide (tu peux la laisser vide)." };
  return { ok: true, type: corps.type, message, page, contact, piege: typeof corps.site === "string" && corps.site.trim() !== "" };
}
