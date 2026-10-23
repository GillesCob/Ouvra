// Orchestration de la traduction (22/10) : valide l'entree deja faite par l'appelant, appelle le modele via le SDK officiel
// (client.messages.parse + zodOutputFormat), revalide la sortie, et traduit toute erreur en code stable pour la page.
// Le client est injecte : les tests passent un faux client, le relais reel un Anthropic() cree a la demande.

import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { construireSchemaJson } from "./schema.js";
import { CONSIGNE, messageUtilisateur } from "./consigne.js";
import { convertirSortie } from "./sortie.js";

// claude-sonnet-5-5 : 2 $ / 1 M de jetons en entree, 10 $ / 1 M en sortie (https://platform.claude.com/docs/en/about-claude/pricing).
export const MODELE = "claude-sonnet-5-5";
export const MAX_JETONS = 700;
export const DELAI_MS = 25000;

const echec = (code) => ({ ok: false, code });

// Code stable a partir d'une erreur du SDK (jamais son message brut, qui peut contenir des details internes).
// Plafond de depense atteint : 429 « enforced_spend_limit_reached » (plafond du palier) ou 400 « You have reached your specified ... usage limits »
// (plafond fixe dans la console), https://platform.claude.com/docs/en/api/rate-limits#spend-limits.
export function codeDeErreur(erreur) {
  const statut = erreur && erreur.status;
  const codeInterne = erreur && erreur.error && erreur.error.error && erreur.error.error.details && erreur.error.error.details.error_code;
  const message = String((erreur && erreur.message) || "");
  if (statut === 429 && codeInterne === "enforced_spend_limit_reached") return "budget_epuise";
  if (statut === 400 && /reached your specified (workspace )?API usage limits/i.test(message)) return "budget_epuise";
  if (statut === 429) return "trop_de_requetes";
  if (!statut && /^Failed to parse structured output/.test(message)) return "sortie_invalide";
  return "ia_indisponible";
}

export async function traduire({ phrase, valeurs }, { client }) {
  const aucunCritere = !(valeurs.typesIfc.length || valeurs.niveaux.length || valeurs.maquettes.length || valeurs.noms.length);
  if (aucunCritere) {
    return { ok: true, resultat: "critere_introuvable", message: "Aucune maquette chargée ne permet de définir un critère pour le moment." };
  }
  if (!client) return echec("ia_indisponible");

  let reponse;
  try {
    reponse = await client.messages.parse(
      {
        model: MODELE,
        max_tokens: MAX_JETONS,
        system: CONSIGNE,
        messages: [{ role: "user", content: messageUtilisateur(phrase, valeurs) }],
        // Traduction courte : pas de reflexion (la latence compte), effort bas. between_tools est accepte a effort high ou moins.
        thinking: { type: "between_tools" },
        output_config: { effort: "low", format: jsonSchemaOutputFormat(construireSchemaJson(valeurs), { transform: false }) }
      },
      { timeout: DELAI_MS, maxRetries: 1 }
    );
  } catch (erreur) {
    // Seul le statut est journalise : ni le message brut, ni la phrase, ni la cle.
    console.error("[ia-regles] appel impossible, statut " + (erreur && erreur.status ? erreur.status : "reseau"));
    return echec(codeDeErreur(erreur));
  }

  if (reponse.stop_reason === "refusal") return echec("refus");
  if (reponse.stop_reason === "max_tokens" || !reponse.parsed_output) return echec("sortie_invalide");

  const resultat = convertirSortie(reponse.parsed_output, valeurs, phrase);
  const usage = reponse.usage ? { entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens } : undefined;
  return { ...resultat, usage };
}
