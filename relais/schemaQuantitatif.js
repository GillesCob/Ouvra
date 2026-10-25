// Schema strict de la reponse du modele pour POST /api/quantitatif (24/10), construit A CHAQUE REQUETE avec les valeurs reellement presentes dans la
// maquette : chaque critere est une liste de valeurs d'une enumeration fermee, la mesure et les regroupements sont des enumerations tirees des REGISTRES
// du moteur (src/quantitatif.js) : une mesure ou un regroupement ajoute au registre entre tout seul dans le schema.
// Memes contraintes que relais/schemaCommande.js (enum, anyOf, additionalProperties: false ; bornes non supportees, donc non utilisees : le nombre
// de regroupements est verifie a la revalidation, relais/sortieQuantitatif.js).

import * as z from "zod/v4";
import { MESURES, FILTRES, REGROUPEMENTS } from "../src/quantitatif.js";

export const RESULTATS_QUANTITATIF = ["requete", "critere_introuvable", "non_comprise"];

function construireSchemaZod(valeurs) {
  const mesures = (valeurs.mesures || []).filter((m) => MESURES.noms().includes(m));
  if (mesures.length === 0) throw new Error("Aucune mesure disponible.");
  const sources = FILTRES.toutes().map((f) => f.source);
  if (sources.every((s) => (valeurs[s] || []).length === 0)) throw new Error("Aucune valeur de critère disponible.");
  const champsFiltres = {};
  for (const f of FILTRES.toutes()) {
    // Une liste sans valeur dans la maquette est omise : zod refuse une enumeration vide, et il n'y a rien a choisir.
    if ((valeurs[f.source] || []).length > 0) champsFiltres[f.nom] = z.array(z.enum(valeurs[f.source])).describe("valeurs du critère « " + f.libelle + " » ; liste vide si la phrase n'en parle pas");
  }
  const requete = z.object({
    mesure: z.enum(mesures).describe("ce qu'on calcule"),
    filtres: z.object(champsFiltres),
    regroupements: z.array(z.enum(REGROUPEMENTS.noms())).describe("zéro, un ou deux regroupements des lignes du tableau, dans l'ordre de la phrase")
  });
  return z.object({
    resultat: z.enum(RESULTATS_QUANTITATIF).describe("requete si une requête valide est possible ; critere_introuvable si un critère cité n'existe pas dans la maquette ; non_comprise sinon"),
    requete: requete.nullable().describe("null si resultat n'est pas requete"),
    relecture: z.string().describe("une phrase en français qui explique ce qui manque ou ce qui n'existe pas ; courte et vide de sens technique si resultat est requete"),
    critere_introuvable: z.string().nullable().describe("mot ou groupe de mots de la phrase sans correspondance dans la maquette, sinon null")
  });
}

// Schema JSON envoye tel quel a l'API (pas de zodOutputFormat : meme raison que relais/schema.js).
export function construireSchemaQuantitatifJson(valeurs) {
  const schema = z.toJSONSchema(construireSchemaZod(valeurs));
  delete schema.$schema;
  return schema;
}
