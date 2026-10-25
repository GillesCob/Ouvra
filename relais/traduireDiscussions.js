// Appel du modele pour POST /api/discussions (24/10). Meme orchestration que relais/traduire.js (modele, effort, codes d'erreur stables : tout est
// repris de ce module, aucun reglage en double). Le client est injecte : les tests passent un faux client, le relais reel un Anthropic() cree a la
// demande (api/discussions.js).
// Cout MESURE avec le vrai modele le 25/10 (claude-sonnet-5-5 : 2 $ / 1 M de jetons en entree, 10 $ / 1 M en sortie, voir relais/traduire.js) :
// comprendre ~3 800 jetons en entree (le schema compte) et ~150 en sortie, soit environ 1 centime ; classement ~3 500 en entree et ~230 en sortie, environ
// 1 centime ; rapport ~5 000 en entree et 1 500 a 2 000 en sortie (3 000 au plus), de 3 a 4 centimes. Une demande de rapport fait deux appels : environ 5 centimes.

import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { MODELE, DELAI_MS, codeDeErreur } from "./traduire.js";
import { REGISTRE } from "../src/discussionsIAMoteur.js";
import { construireSchemaComprendreJson, construireSchemaAnalyseJson } from "./schemaDiscussions.js";
import { CONSIGNE_COMPRENDRE, CONSIGNE_CLASSEMENT, CONSIGNE_RAPPORT, messageComprendre, messageAnalyse } from "./consigneDiscussions.js";
import { convertirSortieComprendre, convertirSortieAnalyse } from "./sortieDiscussions.js";

export const MAX_JETONS = { comprendre: 700, liste: 700, rapport: 3000 };
export const DELAI_RAPPORT_MS = 32000;

const echec = (code) => ({ ok: false, code });

async function appeler(client, { etiquette, consigne, message, schema, maxJetons, effort, delaiMs }) {
  let reponse;
  try {
    reponse = await client.messages.parse(
      {
        model: MODELE,
        max_tokens: maxJetons,
        system: consigne,
        messages: [{ role: "user", content: message }],
        thinking: { type: "between_tools" },
        output_config: { effort, format: jsonSchemaOutputFormat(schema, { transform: false }) }
      },
      { timeout: delaiMs, maxRetries: 1 }
    );
  } catch (erreur) {
    // Grammaire trop grosse (400) : le schema de sortie est trop complexe pour les sorties structurees. Ce n'est ni la faute de l'utilisateur ni une panne
    // passagere, il faut simplifier le schema (voir relais/schemaDiscussions.js) : message de journal distinct, jamais le texte brut de l'API.
    if (erreur && erreur.status === 400 && /grammar is too large/i.test(String(erreur.message || ""))) {
      console.error("[ia-discussions] " + etiquette + " refuse : schema de sortie trop volumineux (grammar too large), a simplifier");
      return echec("ia_indisponible");
    }
    // Seul le statut est journalise : ni le message brut, ni la phrase, ni les messages, ni la cle.
    console.error("[ia-discussions] " + etiquette + " impossible, statut " + (erreur && erreur.status ? erreur.status : "reseau"));
    return echec(codeDeErreur(erreur));
  }
  if (reponse.stop_reason === "refusal") return echec("refus");
  if (reponse.stop_reason === "max_tokens" || !reponse.parsed_output) return echec("sortie_invalide");
  return { ok: true, sortie: reponse.parsed_output, usage: reponse.usage ? { entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens } : undefined };
}

export async function traduireDiscussions(entree, { client }) {
  if (!client) return echec("ia_indisponible");

  if (entree.etape === "comprendre") {
    if (!entree.valeurs.personnes.length) return { ok: true, resultat: "critere_introuvable", message: "Aucune personne dans la messagerie pour le moment." };
    const r = await appeler(client, {
      etiquette: "comprendre", consigne: CONSIGNE_COMPRENDRE, message: messageComprendre(entree.phrase, entree.valeurs, entree.aujourdhui),
      schema: construireSchemaComprendreJson(entree.valeurs), maxJetons: MAX_JETONS.comprendre, effort: "low", delaiMs: DELAI_MS
    });
    if (!r.ok) return r;
    return { ...convertirSortieComprendre(r.sortie, entree.valeurs), usage: r.usage };
  }

  const action = REGISTRE.obtenir(entree.action);
  const rapport = action.sortie === "rapport";
  const r = await appeler(client, {
    etiquette: "analyser", consigne: rapport ? CONSIGNE_RAPPORT : CONSIGNE_CLASSEMENT, message: messageAnalyse(entree),
    schema: construireSchemaAnalyseJson(action.sortie, entree.extraits.map((e) => e.id)),
    maxJetons: rapport ? MAX_JETONS.rapport : MAX_JETONS.liste, effort: rapport ? "medium" : "low", delaiMs: rapport ? DELAI_RAPPORT_MS : DELAI_MS
  });
  if (!r.ok) return r;
  // resultat : libelle du journal de relais/http.js (il ecrit le champ « resultat » de la reponse).
  return { ...convertirSortieAnalyse(r.sortie, action.sortie, entree.extraits), resultat: "analyse", usage: r.usage };
}
