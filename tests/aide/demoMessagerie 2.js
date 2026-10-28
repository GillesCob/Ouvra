// Aide de test : charge les VRAIES donnees de demonstration de la messagerie (src/messagerie/donneesDemo.js) sous Node.
// Vite accepte l'import JSON sans attribut ; Node l'exige. Un crochet de chargement lit les fichiers .json comme des modules JSON.
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let installe = false;
function installerCrochet() {
  if (installe) return;
  installe = true;
  registerHooks({
    load(url, contexte, suivant) {
      if (!url.endsWith(".json")) return suivant(url, contexte);
      return { format: "json", source: readFileSync(fileURLToPath(url), "utf8"), shortCircuit: true };
    }
  });
}

// Meme jeu que la page pour un instant donne (les dates sont calculees par rapport a cet instant).
export async function chargerDemo(maintenant = new Date("2026-10-24T12:00:00")) {
  installerCrochet();
  const { construireDemo } = await import("../../src/messagerie/donneesDemo.js");
  return construireDemo(maintenant);
}
