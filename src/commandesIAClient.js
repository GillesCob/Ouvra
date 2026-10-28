// Viewer par commande (24/10) : appel du relais hebergé POST /api/commande (api/commande.js), calque sur src/reglesIAClient.js.
// La cle d'API n'existe jamais ici. Toute defaillance (reseau, delai, route absente comme sur `vite preview`, reponse inattendue) rend
// { ok: false, code: "ia_indisponible", message } : la page retombe sur les phrases toutes faites, sans exception.
// La commande recue est REVALIDEE par le moteur avant d'etre rendue : action du registre, parametres connus, valeurs presentes dans les listes envoyees.

import { validerCommande } from "./commandesViewer.js";
import { DELAI_MS } from "./reglesIAClient.js";

const MESSAGE_INDISPONIBLE = "L'IA est injoignable pour le moment. Choisir une phrase d'exemple.";
const MESSAGE_DELAI = "L'IA met trop de temps à répondre. Réessayer ou choisir une phrase d'exemple.";
const indisponible = () => ({ ok: false, code: "ia_indisponible", message: MESSAGE_INDISPONIBLE });

export async function demanderCommande({ phrase, valeurs, etat = null }, { fetch: appel = (...a) => globalThis.fetch(...a), delaiMs = DELAI_MS, url = "/api/commande" } = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    const reponse = await appel(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(etat ? { phrase, valeurs, etat } : { phrase, valeurs }),
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
    if (corps.resultat === "commande") {
      const verdict = validerCommande(corps.commande, valeurs);
      if (verdict.ok) return { ok: true, resultat: "commande", commande: verdict.commande };
    }
    return indisponible();
  } catch {
    // Delai depasse (notre minuteur a coupe la requete) : message distinct d'un reseau coupe.
    return controleur.signal.aborted ? { ok: false, code: "delai", message: MESSAGE_DELAI } : indisponible();
  } finally {
    clearTimeout(minuteur);
  }
}
