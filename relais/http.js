// Couche HTTP du relais (22/10) : Request et Response standard (signature de fonction Vercel, voir api/regle.js), aucune dependance a Vercel.
// Ordre : methode, limite par visiteur (les requetes invalides comptent aussi), taille, JSON, validation d'entree, traduction.
// La cle d'API n'est jamais lue ici : elle vit dans le client cree par api/regle.js, et aucune reponse ne contient de message brut d'erreur.

import { validerEntree, CORPS_MAX } from "./entree.js";
import { traduire } from "./traduire.js";
import { enregistrerUsage } from "./journalUsage.js";
import { creerLimiteur } from "./limite.js";

export const MESSAGES = {
  entree_invalide: "La demande n'est pas valide (phrase vide ou de plus de 200 caractères).",
  trop_de_requetes: "Tu as envoyé beaucoup de demandes. Réessaie dans quelques minutes.", // repli : le message reel precise la duree
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
const echec = (code, statut = STATUT[code], precision = null) => reponse(statut, { ok: false, code, message: precision || MESSAGES[code] });

// Refus par la limite de requetes : le message dit quand reessayer (secondes, puis minutes) et l'en-tete retry-after le redit aux machines.
function refusLimite(attenteMs) {
  const secondes = Math.max(1, Math.ceil(attenteMs / 1000));
  const duree = secondes <= 60 ? secondes + (secondes === 1 ? " seconde" : " secondes") : "environ " + Math.ceil(secondes / 60) + " minutes";
  return reponse(429, { ok: false, code: "trop_de_requetes", message: "Tu as envoyé beaucoup de demandes. Réessaie dans " + duree + "." }, { "retry-after": String(secondes) });
}

// Sur Vercel, x-forwarded-for porte l'IP publique du client et est ecrase par la plateforme (pas d'usurpation par le client) :
// https://vercel.com/docs/headers/request-headers. Sans IP, tous les inconnus partagent un seul compartiment (le plus prudent).
function visiteur(request) {
  const brut = request.headers.get("x-forwarded-for") || "";
  return brut.split(",")[0].trim() || "inconnu";
}

// Journal d'usage durable (relais/journalUsage.js) : le client est enveloppe pour mesurer CHAQUE appel au modele (duree, jetons, y compris les refus et
// sorties invalides qui consomment des jetons) sans modifier les modules traduire*. Une exception ici ne casse jamais la reponse.
const ROUTES = { "ia-regles": "regles", "ia-commandes": "commande", "ia-discussions": "discussions", "ia-quantitatifs": "quantitatif", "ia-plan": "plan" };

function clientMesure(base, appels) {
  if (!base || !base.messages || typeof base.messages.parse !== "function") return base;
  const messages = Object.create(base.messages);
  messages.parse = async (parametres, options) => {
    const debut = Date.now();
    try {
      const reponse = await base.messages.parse(parametres, options);
      appels.push({ modele: parametres && parametres.model, dureeMs: Date.now() - debut, usage: reponse && reponse.usage ? { entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens } : undefined });
      return reponse;
    } catch (erreur) {
      appels.push({ modele: parametres && parametres.model, dureeMs: Date.now() - debut });
      throw erreur;
    }
  };
  return Object.create(base, { messages: { value: messages } });
}

// valider(corps) et traduire(entree, { client }) sont ceux de /api/regle par defaut ; /api/commande (api/commande.js) passe les siens.
// etiquette : prefixe des lignes de journal (jamais la phrase de l'utilisateur).
// etapeJournal(entree) : etape a inscrire au journal d'usage (Discussions : comprendre / analyser / rapport), null par defaut. journal : injecte par les tests.
export function creerGestionnaire({ client, limites = {}, maintenant = Date.now, valider = validerEntree, traduire: traduireEntree = traduire, etiquette = "ia-regles", etapeJournal = () => null, journal = enregistrerUsage } = {}) {
  const parMinute = creerLimiteur({ max: limites.parMinute ?? 5, fenetreMs: 60 * 1000, maintenant });
  const parHeure = creerLimiteur({ max: limites.parHeure ?? 30, fenetreMs: 60 * 60 * 1000, maintenant });

  function journaliser(appels, resultat, entree) {
    try {
      for (const appel of appels) {
        journal({
          route: ROUTES[etiquette] || etiquette, etape: etapeJournal(entree), resultat: resultat.ok ? resultat.resultat : null, usage: appel.usage, dureeMs: appel.dureeMs,
          modele: appel.modele, code: resultat.ok ? null : resultat.code, phraseLongueur: typeof entree.phrase === "string" ? entree.phrase.length : null
        });
      }
    } catch (erreur) {
      console.warn("[usage] journal d'usage ignore (" + (erreur && erreur.code ? erreur.code : "erreur") + ")");
    }
  }

  return async function gerer(request) {
    if (request.method !== "POST") return reponse(405, { ok: false, code: "methode", message: "Méthode non permise." }, { allow: "POST" });

    const qui = visiteur(request);
    if (!parMinute.autoriser(qui) || !parHeure.autoriser(qui)) return refusLimite(Math.max(parMinute.attente(qui), parHeure.attente(qui)));

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

    const entree = valider(corps);
    // le validateur de chaque route sait pourquoi il refuse (plan trop grand, nom trop long...) : son message remplace le message generique
    if (!entree.ok) return echec("entree_invalide", undefined, typeof entree.message === "string" && entree.message ? entree.message : null);

    const appels = [];
    const resultat = await traduireEntree(entree, { client: clientMesure(client(), appels) });
    journaliser(appels, resultat, entree);
    if (!resultat.ok) return echec(resultat.code);
    if (resultat.usage) console.log("[" + etiquette + "] jetons entree " + resultat.usage.entree + " sortie " + resultat.usage.sortie + " resultat " + resultat.resultat);
    return reponse(200, resultat);
  };
}
