// Quantitatif (24/10) : appel du relais hebergé POST /api/quantitatif (api/quantitatif.js), calque sur src/commandesIAClient.js.
// La cle d'API n'existe jamais ici. Toute defaillance (reseau, delai, route absente comme sur `vite preview`, reponse inattendue) rend
// { ok: false, code: "ia_indisponible", message } : la page retombe sur les phrases toutes faites, sans exception.
// La requete recue est REVALIDEE par le moteur avant d'etre rendue : mesure du registre, filtres connus, valeurs presentes dans les listes envoyees.

import { validerRequete } from "./quantitatif.js";
import { DELAI_MS } from "./reglesIAClient.js";

const MESSAGE_INDISPONIBLE = "L'IA est injoignable pour le moment. Choisir une phrase d'exemple.";
const MESSAGE_DELAI = "L'IA met trop de temps à répondre. Réessayer ou choisir une phrase d'exemple.";
const indisponible = () => ({ ok: false, code: "ia_indisponible", message: MESSAGE_INDISPONIBLE });

export async function demanderQuantitatif({ phrase, valeurs }, { fetch: appel = (...a) => globalThis.fetch(...a), delaiMs = DELAI_MS, url = "/api/quantitatif" } = {}) {
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
    if (corps.resultat === "requete") {
      const verdict = validerRequete(corps.requete, valeurs);
      if (verdict.ok) return { ok: true, resultat: "requete", requete: verdict.requete };
    }
    return indisponible();
  } catch {
    // Delai depasse (notre minuteur a coupe la requete) : message distinct d'un reseau coupe.
    return controleur.signal.aborted ? { ok: false, code: "delai", message: MESSAGE_DELAI } : indisponible();
  } finally {
    clearTimeout(minuteur);
  }
}
