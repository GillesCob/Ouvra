// Fonction Vercel du relais IA des regles de collision (22/10) : POST /api/regle.
// Signature « fetch Web Standard » (https://vercel.com/docs/functions/functions-api-reference). Le projet est en "type": "module".
// La cle ANTHROPIC_API_KEY est une variable d'environnement de l'hebergeur : jamais dans le navigateur, jamais dans le depot.
// Le client est cree a la demande (pas au demarrage) et reutilise tant que l'instance vit.

import Anthropic from "@anthropic-ai/sdk";
import { creerGestionnaire } from "../relais/http.js";

let client = null;
function clientAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

const gerer = creerGestionnaire({ client: clientAnthropic });

export default { fetch: (request) => gerer(request) };
