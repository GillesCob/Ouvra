// Traduction d'une phrase en commandes du plan 2D (25/10), POST /api/plan. Meme orchestration que relais/traduireQuantitatif.js (modele, effort, delai, codes d'erreur
// stables : tout est repris de relais/traduire.js) avec le schema, la consigne et la revalidation propres. Le client est injecte : les tests passent un faux client.

import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { MODELE, DELAI_MS, codeDeErreur } from "./traduire.js";
import { construireSchemaPlanJson } from "./schemaPlan.js";
import { CONSIGNE_PLAN, messagePlan } from "./consignePlan.js";
import { convertirSortiePlan } from "./sortiePlan.js";

const MAX_JETONS_PLAN = 1800; // six commandes de dix champs : plus que les 700 jetons des autres relais
const echec = (code) => ({ ok: false, code });

export async function traduirePlan({ phrase, libelles, texte }, { client }) {
  if (!client) return echec("ia_indisponible");
  let reponse;
  try {
    reponse = await client.messages.parse(
      {
        model: MODELE,
        max_tokens: MAX_JETONS_PLAN,
        system: CONSIGNE_PLAN,
        messages: [{ role: "user", content: messagePlan(phrase, libelles, texte) }],
        thinking: { type: "between_tools" },
        output_config: { effort: "low", format: jsonSchemaOutputFormat(construireSchemaPlanJson(libelles), { transform: false }) }
      },
      { timeout: DELAI_MS, maxRetries: 1 }
    );
  } catch (erreur) {
    // Seul le statut est journalise : ni le message brut, ni la phrase, ni le plan, ni la cle.
    console.error("[ia-plan] appel impossible, statut " + (erreur && erreur.status ? erreur.status : "reseau"));
    return echec(codeDeErreur(erreur));
  }
  if (reponse.stop_reason === "refusal") return echec("refus");
  if (reponse.stop_reason === "max_tokens" || !reponse.parsed_output) return echec("sortie_invalide");
  const resultat = convertirSortiePlan(reponse.parsed_output, libelles);
  const usage = reponse.usage ? { entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens } : undefined;
  return { ...resultat, usage };
}
