// Fonction Vercel du relais IA du plan 2D (25/10) : POST /api/plan. Meme signature, meme couche HTTP (relais/http.js : methode, limite par visiteur, taille, JSON) et meme cle
// que api/quantitatif.js ; seuls la validation d'entree et la traduction changent. La cle ANTHROPIC_API_KEY est une variable d'environnement de l'hebergeur :
// jamais dans le navigateur, jamais dans le depot.

import Anthropic from "@anthropic-ai/sdk";
import { creerGestionnaire } from "../relais/http.js";
import { validerEntreePlan } from "../relais/entreePlan.js";
import { traduirePlan } from "../relais/traduirePlan.js";

let client = null;
function clientAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

const gerer = creerGestionnaire({ client: clientAnthropic, valider: validerEntreePlan, traduire: traduirePlan, etiquette: "ia-plan" });

export default { fetch: (request) => gerer(request) };
