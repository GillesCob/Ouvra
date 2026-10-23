// Regles de collision en langage naturel, branchement de l'IA (22/10) : appel du relais hebergé POST /api/regle (api/regle.js).
// La cle d'API n'existe jamais ici. Toute defaillance (reseau, delai, route absente comme sur `vite preview`, reponse inattendue) rend
// { ok: false, code: "ia_indisponible", message } : la page retombe sur les phrases d'exemple, sans exception.
// La regle recue est REVALIDEE avant d'etre rendue : format du moteur et valeurs presentes dans les listes envoyees.

import { validerRegle } from "./reglesCollision.js";

export const DELAI_MS = 35000; // un peu plus que le delai du relais (25 s) pour recevoir sa reponse plutot que de couper avant
const PORTEES_IA = ["un_des_deux", "les_deux"];
const LISTE_DU_CHAMP = { typeIfc: "typesIfc", niveau: "niveaux", maquette: "maquettes", nom: "noms" };
const MESSAGE_INDISPONIBLE = "L'IA est injoignable pour le moment. Choisis une phrase d'exemple.";
const indisponible = () => ({ ok: false, code: "ia_indisponible", message: MESSAGE_INDISPONIBLE });

function regleAcceptable(regle, valeurs) {
  if (!regle || !regle.filtre || !PORTEES_IA.includes(regle.filtre.portee)) return false;
  const verdict = validerRegle(regle, { priorite: valeurs.priorite, statut: valeurs.statut });
  if (!verdict.ok) return false;
  return regle.filtre.criteres.every((c) => (valeurs[LISTE_DU_CHAMP[c.champ]] || []).includes(c.contient));
}

export async function demanderRegle({ phrase, valeurs }, { fetch: appel = (...a) => globalThis.fetch(...a), delaiMs = DELAI_MS, url = "/api/regle" } = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    const reponse = await appel(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ phrase, valeurs }),
      signal: controleur.signal
    });
    let corps;
    try {
      corps = await reponse.json();
    } catch {
      return indisponible();
    }
    if (!corps || typeof corps !== "object") return indisponible();
    if (corps.ok === false && typeof corps.code === "string" && typeof corps.message === "string") return { ok: false, code: corps.code, message: corps.message };
    if (corps.ok !== true) return indisponible();
    if ((corps.resultat === "critere_introuvable" || corps.resultat === "non_comprise") && typeof corps.message === "string") {
      return { ok: true, resultat: corps.resultat, message: corps.message };
    }
    if (corps.resultat === "regle" && regleAcceptable(corps.regle, valeurs)) return { ok: true, resultat: "regle", regle: corps.regle };
    return indisponible();
  } catch {
    return indisponible();
  } finally {
    clearTimeout(minuteur);
  }
}
