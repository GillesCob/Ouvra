// Couche HTTP de /api/retour (28/10) : Request et Response standard, comme relais/http.js. Ordre : methode, limite par visiteur (3 par minute, 10 par heure,
// meme limiteur en memoire que les relais IA), taille, JSON, validation, configuration, envoi. Le contenu d'un retour n'est jamais ecrit dans les journaux
// (seulement le type et la longueur). Sans cle Resend configuree la route repond 503 proprement : le reste d'Ouvra n'est pas touche.

import { validerEntreeRetour, CORPS_RETOUR_MAX } from "./entreeRetour.js";
import { construireMail, envoyerMail } from "./mailRetour.js";
import { creerLimiteur } from "./limite.js";

const MESSAGES = {
  methode: "Méthode non permise.",
  entree_invalide: "Le retour n'est pas valide.",
  retours_indisponibles: "L'envoi des retours n'est pas disponible pour le moment.",
  envoi_impossible: "Ton retour n'a pas pu être envoyé. Réessaie dans un moment."
};

function reponse(statut, corps, extra = {}) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
}
const echec = (code, statut, message = null) => reponse(statut, { ok: false, code, message: message || MESSAGES[code] });

// Sur Vercel, x-forwarded-for porte l'IP publique du client (ecrasee par la plateforme) ; sans IP, tous les inconnus partagent un compartiment.
const visiteur = (request) => (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";

export function creerGestionnaireRetour({ env = {}, fetch: appel, maintenant = Date.now, journal = (ligne) => console.log(ligne), limites = {} } = {}) {
  const parMinute = creerLimiteur({ max: limites.parMinute ?? 3, fenetreMs: 60 * 1000, maintenant });
  const parHeure = creerLimiteur({ max: limites.parHeure ?? 10, fenetreMs: 60 * 60 * 1000, maintenant });

  return async function gerer(request) {
    if (request.method !== "POST") return echec("methode", 405);
    const qui = visiteur(request);
    if (!parMinute.autoriser(qui) || !parHeure.autoriser(qui)) {
      const secondes = Math.max(1, Math.ceil(Math.max(parMinute.attente(qui), parHeure.attente(qui)) / 1000));
      return reponse(429, { ok: false, code: "trop_de_requetes", message: "Tu as envoyé beaucoup de retours. Réessaie dans " + (secondes <= 60 ? secondes + (secondes === 1 ? " seconde" : " secondes") : "environ " + Math.ceil(secondes / 60) + " minutes") + "." }, { "retry-after": String(secondes) });
    }
    if (Number(request.headers.get("content-length")) > CORPS_RETOUR_MAX) return echec("entree_invalide", 413);
    let texte;
    try { texte = await request.text(); } catch { return echec("entree_invalide", 400); }
    if (texte.length > CORPS_RETOUR_MAX) return echec("entree_invalide", 413);
    let corps;
    try { corps = JSON.parse(texte); } catch { return echec("entree_invalide", 400); }

    const entree = validerEntreeRetour(corps);
    if (!entree.ok) return echec("entree_invalide", 400, entree.message);
    if (entree.piege) return reponse(200, { ok: true }); // robot : ignore sans le lui dire

    if (!env.RESEND_API_KEY || !env.RETOUR_DESTINATAIRE || !env.RETOUR_EXPEDITEUR) return echec("retours_indisponibles", 503);
    const envoi = await envoyerMail(construireMail(entree, { expediteur: env.RETOUR_EXPEDITEUR, destinataire: env.RETOUR_DESTINATAIRE }), { cle: env.RESEND_API_KEY, fetch: appel });
    if (!envoi.ok) {
      journal("[retour] envoi impossible");
      return echec("envoi_impossible", 502);
    }
    journal("[retour] envoye type=" + entree.type + " longueur=" + entree.message.length);
    return reponse(200, { ok: true });
  };
}
