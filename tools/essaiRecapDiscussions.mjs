// Essais du recapitulatif de Discussions au format fixe avec de VRAIS appels (26/10). Outil de mise au point, hors suite de tests (quelques centimes, reseau et cle) :
//   node tools/essaiRecapDiscussions.mjs          joue tous les cas (8 appels au plus)
//   node tools/essaiRecapDiscussions.mjs 2 4      joue seulement les cas numerotes
// Chaque appel est ECRIT dans le journal d'usage (.usage/appels.jsonl, route « discussions », etape « essai ») : le cout se lit ensuite avec
//   node tools/usageResume.js --route discussions
// Lit ANTHROPIC_API_KEY dans l'environnement ou dans .env.local (jamais affichee). Les messages sont fictifs, ecrits ici. Chaque cas passe par
// relais/traduireDiscussions.js (consigne, schema, revalidation) ; des controles verifient le format et l'absence d'invention.

import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { traduireDiscussions } from "../relais/traduireDiscussions.js";
import { validerEntreeDiscussions } from "../relais/entreeDiscussions.js";
import { enregistrerUsage } from "../relais/journalUsage.js";
import { MODELE } from "../relais/traduire.js";

const PLAFOND = 8;
if (!process.env.ANTHROPIC_API_KEY && fs.existsSync(".env.local")) {
  for (const ligne of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/.exec(ligne);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.ANTHROPIC_API_KEY) { console.error("Pas de clé ANTHROPIC_API_KEY (environnement ou .env.local)."); process.exit(1); }

const m = (n, discussion, auteur, quand, texte) => ({ id: "M" + n, discussion, auteur, quand, texte });
const D = "Cloison coupe-feu local technique";

const CAS = [
  { nom: "decision claire", sujet: "cloison coupe-feu", decision: "prise", desaccord: null, extraits: [
    m(1, D, "Vous", "2026-10-20 09:00", "La cloison du local technique est en CF 1h dans la maquette, le programme dit CF 2h."),
    m(2, D, "Ana Roux", "2026-10-20 10:10", "Je confirme CF 2h, c'est la règle du bureau de contrôle."),
    m(3, D, "Vous", "2026-10-21 08:30", "Ok, tu corriges dans la V4 ?"),
    m(4, D, "Ana Roux", "2026-10-21 11:00", "Oui, c'est décidé, je passe la cloison en CF 2h dans la V4 et je te préviens quand c'est publié.")
  ] },
  { nom: "desaccord sans decision", sujet: "accès grue", decision: "aucune", desaccord: true, extraits: [
    m(1, "Accès grue semaine 44", "Bob Lenoir", "2026-10-22 14:00", "L'accès grue est bloqué mardi par les livraisons, je propose de décaler le levage au jeudi."),
    m(2, "Accès grue semaine 44", "Ana Roux", "2026-10-22 14:20", "Non, jeudi je ne peux pas, l'équipe de pose est sur un autre chantier. Je préfère maintenir mardi."),
    m(3, "Accès grue semaine 44", "Bob Lenoir", "2026-10-22 14:45", "Mardi n'est pas possible, la route est coupée. On en reparle."),
    m(4, "Accès grue semaine 44", "Vous", "2026-10-22 15:10", "Je regarde ce que je peux faire côté planning.")
  ] },
  { nom: "rien a dire", sujet: "piscine olympique", decision: "aucune", desaccord: false, rien: true, extraits: [
    m(1, "Groupe chantier", "Bob Lenoir", "2026-10-22 10:00", "Visite de chantier demain, rendez-vous à 8h."),
    m(2, "Groupe chantier", "Ana Roux", "2026-10-22 10:05", "J'y serai.")
  ] },
  { nom: "ambigue", sujet: "nomenclature des portes", decision: "aucune ou incertaine", desaccord: null, extraits: [
    m(1, "Nomenclature des portes", "Vous", "2026-10-10 09:00", "Peux-tu valider la nomenclature des portes ?"),
    m(2, "Nomenclature des portes", "Bob Lenoir", "2026-10-10 11:00", "Il faudrait peut-être revoir les repères du niveau 2 avant."),
    m(3, "Nomenclature des portes", "Vous", "2026-10-11 08:00", "Oui, je regarde, on verra la semaine prochaine.")
  ] },
  { nom: "decision seulement rapportee", sujet: "levage des groupes", decision: "rapportee", desaccord: false, extraits: [
    m(1, "Levage des groupes", "Vous", "2026-10-23 09:00", "Quelqu'un sait si le levage des groupes est maintenu mardi ?"),
    m(2, "Levage des groupes", "Bob Lenoir", "2026-10-23 09:30", "Karim m'a dit hier que le levage serait décalé au jeudi, mais je n'ai rien de écrit."),
    m(3, "Levage des groupes", "Vous", "2026-10-23 09:40", "Ok, je demande à Karim.")
  ] },
  { nom: "chiffres a ne pas inventer", sujet: "trémie", decision: "aucune", desaccord: false, extraits: [
    m(1, "Trémie niveau 2", "Ana Roux", "2026-10-15 16:00", "La trémie du niveau 2 est trop grande de 12 cm côté nord."),
    m(2, "Trémie niveau 2", "Vous", "2026-10-15 16:20", "Merci, je regarde avec le lot plomberie.")
  ] }
];

const choisis = process.argv.slice(2).map(Number);
const client = new Anthropic();
let appels = 0;
let bons = 0;
let jouees = 0;
for (let i = 0; i < CAS.length; i++) {
  if (choisis.length && !choisis.includes(i + 1)) continue;
  if (appels >= PLAFOND) { console.log("Plafond d'appels atteint."); break; }
  const cas = CAS[i];
  const entree = validerEntreeDiscussions({ etape: "analyser", action: "rapport", phrase: "Fais-moi un rapport sur " + cas.sujet, sujet: cas.sujet, extraits: cas.extraits });
  if (!entree.ok) { console.log("Entrée refusée", entree); continue; }
  const t0 = Date.now();
  appels += 1;
  jouees += 1;
  const r = await traduireDiscussions(entree, { client });
  enregistrerUsage({ route: "discussions", etape: "essai", resultat: r.ok ? "analyse" : null, usage: r.usage, dureeMs: Date.now() - t0, modele: MODELE, code: r.ok ? null : r.code, phraseLongueur: cas.sujet.length });
  const duree = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${i + 1}. ${cas.nom} (${duree} s, ${r.usage ? r.usage.entree + "/" + r.usage.sortie : "?"} jetons)`);
  if (!r.ok) { console.log("   ECHEC relais : " + r.code); continue; }
  const s = r.sortie;
  const verifs = [];
  if (cas.rien) verifs.push(["rien_a_dire", s.rien_a_dire === true]);
  else {
    verifs.push(["cinq blocs", !!s.titre && !!s.contexte && Array.isArray(s.intervenants) && Array.isArray(s.desaccords) && !!s.decision]);
    verifs.push(["decision attendue (" + cas.decision + ")", cas.decision.split(" ou ").includes(s.decision.statut)]);
    if (cas.desaccord === true) verifs.push(["desaccord signale", s.desaccords.length > 0]);
    if (cas.desaccord === false) verifs.push(["aucun desaccord invente", s.desaccords.length === 0]);
    if (s.decision.statut === "aucune") verifs.push(["decision vide", s.decision.texte === "" && s.decision.sources.length === 0]);
  }
  console.log(JSON.stringify(s, null, 1).replace(/\n\s+/g, " "));
  const ok = verifs.every(([, v]) => v);
  if (ok) bons += 1;
  console.log("   " + (ok ? "[OK]" : "[A VOIR]") + " " + verifs.map(([n, v]) => n + ":" + (v ? "oui" : "NON")).join(" ; "));
}
console.log(`\n${bons}/${jouees} conformes. ${appels} appels. Coût : node tools/usageResume.js --route discussions`);
