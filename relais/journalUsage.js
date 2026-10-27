// Journal durable de l'usage des appels au modele (24/10) : UNE ligne JSON par appel, ajoutee a .usage/appels.jsonl (racine du depot, ignore par git).
// Uniquement des metriques : jamais la phrase de l'utilisateur, jamais un extrait de message, jamais la cle (seule la LONGUEUR de la phrase est gardee).
// Desactive sur Vercel (systeme de fichiers en lecture seule et ephemere : les logs console de relais/http.js y suffisent) et avec OUVRA_USAGE=0.
// Une panne d'ecriture ne casse jamais la reponse au visiteur : un seul avertissement console par processus.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const FICHIER_JOURNAL = fileURLToPath(new URL("../.usage/appels.jsonl", import.meta.url));

// Dollars par million de jetons, par modele. Seuls les tarifs confirmes figurent ici ; tout autre modele donne un cout null (« tarif non confirmé »).
// claude-sonnet-5-5 : 2 $ en entree, 10 $ en sortie (page « Model pricing », https://platform.claude.com/docs/en/about-claude/pricing, consultee le 24/10/2026).
export const TARIFS = {
  "claude-sonnet-5-5": { entree: 2, sortie: 10 }
};

// Cout estime en dollars, ou null si le tarif du modele ou les jetons sont inconnus. Ne compte pas les jetons de cache (le relais n'en utilise pas).
export function calculerCout(modele, jetonsEntree, jetonsSortie) {
  const tarif = Object.hasOwn(TARIFS, modele) ? TARIFS[modele] : null;
  if (!tarif || !Number.isFinite(jetonsEntree) || !Number.isFinite(jetonsSortie)) return null;
  return (jetonsEntree * tarif.entree + jetonsSortie * tarif.sortie) / 1_000_000;
}

// NODE_TEST_CONTEXT est defini par `node --test` : les tests du relais (faux clients) ne doivent jamais polluer le vrai journal.
export function journalActif(env = process.env) {
  return !env.VERCEL && env.OUVRA_USAGE !== "0" && !env.NODE_TEST_CONTEXT;
}

const motCourt = (v) => (typeof v === "string" && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : null);
const nombre = (v) => (Number.isFinite(v) && v >= 0 ? v : null);

let avertissementFait = false;
export function reinitialiserAvertissement() {
  avertissementFait = false;
}

// Retourne la ligne ecrite (objet), ou null si le journal est desactive ou si l'ecriture a echoue.
export function enregistrerUsage({ route, etape = null, resultat = null, usage, dureeMs, modele, code = null, phraseLongueur = null } = {}, { fichier = FICHIER_JOURNAL, env = process.env, maintenant = () => new Date() } = {}) {
  if (!journalActif(env)) return null;
  try {
    const entree = nombre(usage && usage.entree);
    const sortie = nombre(usage && usage.sortie);
    const ligne = {
      horodatage: maintenant().toISOString(),
      route: motCourt(route),
      etape: motCourt(etape),
      modele: motCourt(modele),
      jetonsEntree: entree,
      jetonsSortie: sortie,
      coutDollars: calculerCout(modele, entree, sortie),
      dureeMs: nombre(dureeMs) === null ? null : Math.round(dureeMs),
      statut: code ? motCourt(code) || "erreur" : "ok",
      resultat: motCourt(resultat),
      phraseLongueur: nombre(phraseLongueur)
    };
    mkdirSync(dirname(fichier), { recursive: true });
    appendFileSync(fichier, JSON.stringify(ligne) + "\n");
    return ligne;
  } catch (erreur) {
    if (!avertissementFait) {
      avertissementFait = true;
      console.warn("[usage] journal d'usage non ecrit (" + (erreur && erreur.code ? erreur.code : "erreur") + "), les appels continuent sans journal.");
    }
    return null;
  }
}
