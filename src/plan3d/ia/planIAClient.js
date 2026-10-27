// IA du plan 2D (25/10) : appel du relais heberge POST /api/plan (api/plan.js), calque sur src/quantitatifIAClient.js. La cle d'API n'existe jamais ici. Toute defaillance
// (reseau, delai, route absente comme sur `vite preview`, reponse inattendue) rend { ok: false, code: "ia_indisponible", message } : la page n'applique rien, sans exception.
// Ce qui part : la phrase, les noms des pieces, la description textuelle du plan (src/plan3d/ia/descriptionPlan.js). Jamais l'image, jamais une coordonnee.
// Les commandes recues sont REVALIDEES contre le vrai plan (piece, cote, nombres, enumerations) avant d'etre rendues ; le moteur reverifie ensuite la cible et les mesures.

import { validerCommande } from "./commandesPlan.js";
import { texteDuPlan } from "./descriptionPlan.js";
import { DELAI_MS } from "../../reglesIAClient.js";

const MESSAGE_INDISPONIBLE = "L'IA est injoignable pour le moment. Utilise les outils du plan.";
const MESSAGE_DELAI = "L'IA met trop de temps à répondre. Réessaie ou utilise les outils du plan.";
const indisponible = () => ({ ok: false, code: "ia_indisponible", message: MESSAGE_INDISPONIBLE });

export async function demanderPlan({ phrase, description }, { fetch: appel = (...a) => globalThis.fetch(...a), delaiMs = DELAI_MS, url = "/api/plan" } = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    const reponse = await appel(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ phrase, libelles: description.pieces.map((p) => p.libelle), texte: texteDuPlan(description) }),
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
    if ((corps.resultat === "element_introuvable" || corps.resultat === "non_comprise") && typeof corps.message === "string") {
      return { ok: true, resultat: corps.resultat, message: corps.message };
    }
    if (corps.resultat === "commandes" && Array.isArray(corps.commandes) && corps.commandes.length > 0) {
      const commandes = [];
      for (const c of corps.commandes) {
        const verdict = validerCommande(c, description);
        if (!verdict.ok) return indisponible();
        commandes.push(verdict.commande);
      }
      return { ok: true, resultat: "commandes", commandes };
    }
    return indisponible();
  } catch {
    // Delai depasse (notre minuteur a coupe la requete) : message distinct d'un reseau coupe.
    return controleur.signal.aborted ? { ok: false, code: "delai", message: MESSAGE_DELAI } : indisponible();
  } finally {
    clearTimeout(minuteur);
  }
}
