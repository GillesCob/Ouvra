// Controle de collision d'un plan 2D -> 3D : node tools/controlerPlan.mjs <modele.json>   (defaut : public/plan3d-local/plan-salome.json)
import { readFileSync } from "node:fs";
import { controlerPlan } from "../src/plan3d/controles.js";

const fichier = process.argv[2] || "public/plan3d-local/plan-salome.json";
const resultats = controlerPlan(JSON.parse(readFileSync(fichier, "utf8")));
if (!resultats.length) console.log("Aucun problème détecté.");
for (const r of resultats) console.log(`${r.gravite === "erreur" ? "ERREUR" : "alerte"} [${r.regle}] ${r.texte}`);
console.log(`${resultats.filter((r) => r.gravite === "erreur").length} erreur(s), ${resultats.filter((r) => r.gravite === "alerte").length} alerte(s)`);
