// Schema strict de la reponse du modele pour POST /api/commande (24/10), construit A CHAQUE REQUETE avec les valeurs reellement presentes dans la
// maquette : chaque critere est une liste de valeurs d'une enumeration fermee, le modele ne peut donc pas en inventer une.
// Les variantes d'action viennent du REGISTRE du moteur (src/commandesViewer.js) : une action ajoutee au registre entre toute seule dans le schema.
// Memes contraintes que relais/schema.js (enum, anyOf, additionalProperties: false supportes ; bornes non supportees, donc non utilisees) :
// https://platform.claude.com/docs/en/build-with-claude/structured-outputs

import * as z from "zod/v4";
import { REGISTRE } from "../src/commandesViewer.js";

export const RESULTATS_COMMANDE = ["commande", "critere_introuvable", "non_comprise"];

function champsDeLAction(action, valeurs) {
  const champs = { action: z.literal(action.nom) };
  for (const p of action.parametres) {
    if (p.genre === "booleen") {
      champs[p.nom] = z.boolean().describe(p.description || p.nom);
    } else if (p.genre === "enum") {
      champs[p.nom] = z.enum(p.options()).describe(p.description || p.nom); // enumeration fermee : le modele ne peut pas inventer de presentation
    } else if (p.genre === "nombre") {
      champs[p.nom] = z.number().describe(p.description || p.nom); // les bornes ne sont pas supportees par le schema : le moteur les reverifie
    } else if ((valeurs[p.source] || []).length > 0) {
      // Une liste sans valeur dans la maquette est omise : zod refuse une enumeration vide, et il n'y a rien a choisir.
      champs[p.nom] = z.array(z.enum(valeurs[p.source])).describe(p.description || p.nom);
    }
  }
  return champs;
}

function construireSchemaZod(valeurs, registre) {
  const sources = ["typesIfc", "niveaux", "maquettes", "noms", "zones"];
  if (sources.every((s) => (valeurs[s] || []).length === 0)) throw new Error("Aucune valeur de critère disponible.");
  const variantes = registre.toutes().map((action) => z.object(champsDeLAction(action, valeurs)));
  const commande = variantes.length === 1 ? variantes[0] : z.union(variantes);
  return z.object({
    resultat: z.enum(RESULTATS_COMMANDE).describe("commande si une commande valide est possible ; critere_introuvable si un critère cité n'existe pas dans la maquette ; non_comprise sinon"),
    commande: commande.nullable().describe("null si resultat n'est pas commande ; sinon l'action choisie et ses paramètres"),
    relecture: z.string().describe("phrase de relecture en français, à l'infinitif, qui redit la commande ; y signaler la lecture retenue si la phrase était ambiguë ; sinon explique ce qui manque"),
    critere_introuvable: z.string().nullable().describe("mot ou groupe de mots de la phrase sans correspondance dans la maquette, sinon null")
  });
}

// Schema JSON envoye tel quel a l'API (pas de zodOutputFormat : meme raison que relais/schema.js, le SDK deplacerait les enum dans la description).
export function construireSchemaCommandeJson(valeurs, registre = REGISTRE) {
  const schema = z.toJSONSchema(construireSchemaZod(valeurs, registre));
  delete schema.$schema;
  return schema;
}
