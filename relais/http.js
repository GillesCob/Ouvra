// Couche HTTP du relais (22/10) : Request et Response standard (signature de fonction Vercel, voir api/regle.js), aucune dependance a Vercel.
// Ordre : methode, limite par visiteur (les requetes invalides comptent aussi), taille, JSON, validation d'entree, traduction.
// La cle d'API n'est jamais lue ici : elle vit dans le client cree par api/regle.js, et aucune reponse ne contient de message brut d'erreur.

import { validerEntree, CORPS_MAX } from "./entree.js";
import { traduire } from "./traduire.js";
import { creerLimiteur } from "./limite.js";

const MESSAGES = {
  entree_invalide: "La demande n'est pas valide (phrase vide ou de plus de 200 caractères).",
  trop_de_requetes: "Trop de demandes en peu de temps. Réessaie dans quelques minutes, ou choisis une phrase d'exemple.",
  budget_epuise: "Le budget mis à disposition pour tester l'IA est épuisé. Choisis une phrase d'exemple.",
  ia_indisponible: "L'IA est injoignable pour le moment. Choisis une phrase d'exemple.",
  refus: "L'IA n'a pas voulu traiter cette phrase. Reformule-la ou choisis une phrase d'exemple.",
  sortie_invalide: "L'IA n'a pas renvoyé de règle exploitable. Reformule la phrase ou choisis une phrase d'exemple."
};
const STATUT = { entree_invalide: 400, trop_de_requetes: 429, budget_epuise: 503, ia_indisponible: 503, refus: 502, sortie_invalide: 502 };

function reponse(statut, corps, extra = {}) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}
const echec = (code, statut = STATUT[code]) => reponse(statut, { ok: false, code, message: MESSAGES[code] });

// Sur Vercel, x-forwarded-for porte l'IP publique du client et est ecrase par la plateforme (pas d'usurpation par le client) :
// https://vercel.com/docs/headers/request-headers. Sans IP, tous les inconnus partagent un seul compartiment (le plus prudent).
function visiteur(request) {
  const brut = request.headers.get("x-forwarded-for") || "";
  return brut.split(",")[0].trim() || "inconnu";
}

export function creerGestionnaire({ client, limites = {}, maintenant = Date.now } = {}) {
  const parMinute = creerLimiteur({ max: limites.parMinute ?? 5, fenetreMs: 60 * 1000, maintenant });
  const parHeure = creerLimiteur({ max: limites.parHeure ?? 30, fenetreMs: 60 * 60 * 1000, maintenant });

  return async function gerer(request) {
    if (request.method !== "POST") return reponse(405, { ok: false, code: "methode", message: "Méthode non permise." }, { allow: "POST" });

    const qui = visiteur(request);
    if (!parMinute.autoriser(qui) || !parHeure.autoriser(qui)) return echec("trop_de_requetes");

    const annonce = Number(request.headers.get("content-length"));
    if (annonce > CORPS_MAX) return echec("entree_invalide", 413);
    let texte;
    try {
      texte = await request.text();
    } catch {
      return echec("entree_invalide");
    }
    if (texte.length > CORPS_MAX) return echec("entree_invalide", 413);
    let corps;
    try {
      corps = JSON.parse(texte);
    } catch {
      return echec("entree_invalide");
    }

    const entree = validerEntree(corps);
    if (!entree.ok) return echec("entree_invalide");

    const resultat = await traduire(entree, { client: client() });
    if (!resultat.ok) return echec(resultat.code);
    if (resultat.usage) console.log("[ia-regles] jetons entree " + resultat.usage.entree + " sortie " + resultat.usage.sortie + " resultat " + resultat.resultat);
    return reponse(200, resultat);
  };
}
