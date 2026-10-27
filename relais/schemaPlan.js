// Schema strict de la reponse du modele pour POST /api/plan (25/10), construit A CHAQUE REQUETE avec les pieces reellement presentes dans le plan : le modele ne peut
// pas inventer une piece ni une action. Les variantes d'action viennent du REGISTRE du moteur (src/plan3d/ia/commandesPlan.js) : une action ajoutee au registre entre
// toute seule dans le schema. Memes contraintes que relais/schemaQuantitatif.js (enum, anyOf, additionalProperties: false ; bornes non supportees, donc non utilisees :
// le moteur les reverifie). Un parametre facultatif est « nullable » : l'API n'accepte que des champs tous presents.

import * as z from "zod/v4";
import { REGISTRE_PLAN } from "../src/plan3d/ia/commandesPlan.js";
import { COTES } from "../src/plan3d/ia/descriptionPlan.js";

export const RESULTATS_PLAN = ["commandes", "element_introuvable", "non_comprise"];

function champ(p, libelles) {
  let schema;
  if (p.genre === "piece") schema = z.enum(libelles);
  else if (p.genre === "cote") schema = z.enum(COTES);
  else if (p.genre === "enum") schema = z.enum(p.options());
  else if (p.genre === "entier" || p.genre === "nombre") schema = z.number();
  else schema = z.string();
  schema = schema.describe(p.description);
  return p.facultatif ? schema.nullable() : schema;
}

function construireSchemaZod(libelles) {
  if (!Array.isArray(libelles) || libelles.length === 0) throw new Error("Aucune pièce disponible.");
  const variantes = REGISTRE_PLAN.toutes().map((action) => {
    const champs = { action: z.literal(action.nom).describe(action.description) };
    for (const p of action.parametres) champs[p.nom] = champ(p, libelles);
    return z.object(champs);
  });
  const commande = variantes.length === 1 ? variantes[0] : z.union(variantes);
  return z.object({
    resultat: z.enum(RESULTATS_PLAN).describe("commandes si la phrase se traduit en une ou plusieurs modifications possibles ; element_introuvable si une pièce, un côté ou un numéro d'ouverture cité n'existe pas dans le plan ; non_comprise sinon, ou si la phrase est ambiguë"),
    commandes: z.array(commande).describe("les modifications dans l'ordre de la phrase (six au plus) ; liste vide si resultat n'est pas commandes"),
    explication: z.string().describe("si resultat n'est pas commandes : une ou deux phrases en français qui disent ce qui manque ou ce qui n'existe pas ; sinon une chaîne vide")
  });
}

// Schema JSON envoye tel quel a l'API (pas de zodOutputFormat : meme raison que relais/schema.js).
export function construireSchemaPlanJson(libelles) {
  const schema = z.toJSONSchema(construireSchemaZod(libelles));
  delete schema.$schema;
  return schema;
}
