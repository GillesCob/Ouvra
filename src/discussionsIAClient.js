// Discussions par commande IA (24/10) : appels du relais heberge POST /api/discussions (api/discussions.js), calques sur src/commandesIAClient.js.
// Deux etapes, un seul point d'entree :
//   comprendre : la phrase + les noms des personnes de la messagerie -> une commande (action + parametres), ou « non comprise »
//   analyser   : pour la recherche par sujet et le rapport, les extraits retenus localement -> classement ou synthese sourcee
// La cle d'API n'existe jamais ici. Toute defaillance (reseau, delai, route absente comme sur `vite preview`, reponse inattendue) rend
// { ok: false, code, message } : la page retombe sur les phrases toutes faites, sans exception. La COMMANDE recue est reverifiee par le moteur
// (le pipeline) ; la forme de la reponse d'analyse est verifiee par conclureClassement / conclureRapport.

import { DELAI_MS } from "./reglesIAClient.js";

const MESSAGE_INDISPONIBLE = "L'IA est injoignable pour le moment. Choisir une phrase d'exemple.";
const MESSAGE_DELAI = "L'IA met trop de temps à répondre. Réessayer ou choisir une phrase d'exemple.";
const indisponible = () => ({ ok: false, code: "ia_indisponible", message: MESSAGE_INDISPONIBLE });

async function appeler(corps, { fetch: appel = (...a) => globalThis.fetch(...a), delaiMs = DELAI_MS, url = "/api/discussions" } = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    const reponse = await appel(url, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "omit", body: JSON.stringify(corps), signal: controleur.signal
    });
    let json;
    try {
      json = await reponse.json();
    } catch {
      return indisponible();
    }
    if (!json || typeof json !== "object") return indisponible();
    if (json.ok === false && typeof json.code === "string" && typeof json.message === "string") return { ok: false, code: json.code, message: json.message };
    return json.ok === true ? { ok: true, corps: json } : indisponible();
  } catch {
    // Delai depasse (notre minuteur a coupe la requete) : message distinct d'un reseau coupe.
    return controleur.signal.aborted ? { ok: false, code: "delai", message: MESSAGE_DELAI } : indisponible();
  } finally {
    clearTimeout(minuteur);
  }
}

// Rend { ok: true, resultat: "commande", commande: { action, parametres }, relecture } | { ok: true, resultat: "critere_introuvable" | "non_comprise", message } | { ok: false, code, message }
export async function demanderComprehension({ phrase, valeurs, aujourdhui }, options) {
  const r = await appeler({ etape: "comprendre", phrase, valeurs: { personnes: valeurs.personnes }, aujourdhui }, options);
  if (!r.ok) return r;
  const c = r.corps;
  if ((c.resultat === "critere_introuvable" || c.resultat === "non_comprise") && typeof c.message === "string") return { ok: true, resultat: c.resultat, message: c.message };
  if (c.resultat === "commande" && c.commande && typeof c.commande === "object" && typeof c.relecture === "string") {
    return { ok: true, resultat: "commande", commande: c.commande, relecture: c.relecture };
  }
  return indisponible();
}

// extraits : [{ id, discussion, auteur, quand, texte }] (voir preparerAnalyse du moteur). Rend { ok: true, sortie } (la sortie du modele, a verifier par le
// moteur) | { ok: false, code, message }.
export async function demanderAnalyse({ action, phrase, sujet, extraits }, options) {
  const r = await appeler({ etape: "analyser", action, phrase, sujet, extraits }, options);
  // Le relais repond « entree_invalide » avec un message sur la phrase : ici c'est le lot de messages qu'il a refuse, on le dit.
  if (!r.ok && r.code === "entree_invalide") return { ok: false, code: r.code, message: "Les messages à analyser n'ont pas pu être envoyés (trop volumineux). Préciser le sujet ou une période." };
  if (!r.ok) return r;
  return r.corps.sortie && typeof r.corps.sortie === "object" ? { ok: true, sortie: r.corps.sortie } : indisponible();
}
