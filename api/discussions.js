// Fonction Vercel du relais IA de la page Discussions (24/10) : POST /api/discussions. Meme signature, meme couche HTTP (relais/http.js : methode,
// limite par visiteur, taille, JSON) et meme cle que api/regle.js ; seuls la validation d'entree et la traduction changent.
// Cette route recoit, a l'etape « analyser », du CONTENU DE DISCUSSION (extraits de messages, fictifs aujourd'hui) : voir decisions-produit.md.
// La cle ANTHROPIC_API_KEY est une variable d'environnement de l'hebergeur : jamais dans le navigateur, jamais dans le depot.

import Anthropic from "@anthropic-ai/sdk";
import { creerGestionnaire } from "../relais/http.js";
import { validerEntreeDiscussions } from "../relais/entreeDiscussions.js";
import { REGISTRE } from "../src/discussionsIAMoteur.js";
import { traduireDiscussions } from "../relais/traduireDiscussions.js";

let client = null;
function clientAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

// Une demande de rapport fait deux appels (comprendre, analyser) : les plafonds par visiteur tiennent compte de ce double compte.
const gerer = creerGestionnaire({
  client: clientAnthropic, valider: validerEntreeDiscussions, traduire: traduireDiscussions, etiquette: "ia-discussions", limites: { parMinute: 8, parHeure: 50 },
  // Etape inscrite au journal d'usage : comprendre, analyser (classement) ou rapport (memes regles que relais/traduireDiscussions.js).
  etapeJournal: (entree) => (entree.etape === "comprendre" ? "comprendre" : REGISTRE.obtenir(entree.action).sortie === "rapport" ? "rapport" : "analyser")
});

export default { fetch: (request) => gerer(request) };
