#!/usr/bin/env node
// Synthese du journal d'usage des appels IA (24/10) : node tools/usageResume.js [--depuis AAAA-MM-JJ] [--route nom] [--json] [--fichier chemin]
// Lit .usage/appels.jsonl (ecrit par relais/journalUsage.js). Estimations : jetons rapportes par l'API x tarifs de relais/journalUsage.js.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FICHIER_JOURNAL } from "../relais/journalUsage.js";

export function lireJournal(fichier = FICHIER_JOURNAL, avertir = (m) => console.warn(m)) {
  if (!existsSync(fichier)) return [];
  const lignes = [];
  readFileSync(fichier, "utf8").split("\n").forEach((brut, i) => {
    if (!brut.trim()) return;
    try {
      const o = JSON.parse(brut);
      if (!o || typeof o !== "object" || Array.isArray(o) || typeof o.horodatage !== "string") throw new Error("forme");
      lignes.push(o);
    } catch {
      avertir("Avertissement : ligne " + (i + 1) + " du journal illisible, ignorée.");
    }
  });
  return lignes;
}

const moyenne = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const nums = (xs) => xs.filter((x) => Number.isFinite(x));

function agreger(appels) {
  const couts = nums(appels.map((a) => a.coutDollars));
  const ok = appels.filter((a) => a.statut === "ok").length;
  return {
    appels: appels.length, reussis: ok, erreurs: appels.length - ok,
    jetonsEntreeMoyen: moyenne(nums(appels.map((a) => a.jetonsEntree))), jetonsSortieMoyen: moyenne(nums(appels.map((a) => a.jetonsSortie))),
    coutMoyen: moyenne(couts), coutMin: couts.length ? Math.min(...couts) : null, coutMax: couts.length ? Math.max(...couts) : null,
    coutTotal: couts.length ? couts.reduce((a, b) => a + b, 0) : null, sansTarif: appels.length - couts.length,
    dureeMoyenneMs: moyenne(nums(appels.map((a) => a.dureeMs)))
  };
}

function grouper(appels, cle) {
  const m = new Map();
  for (const a of appels) {
    const k = cle(a);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(a);
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => ({ cle: k, ...agreger(v) }));
}

export function synthese(lignes, { depuis = null, route = null } = {}) {
  const appels = lignes.filter((l) => (!depuis || l.horodatage.slice(0, 10) >= depuis) && (!route || l.route === route));
  return {
    depuis, route,
    parRoute: grouper(appels, (a) => a.route + (a.etape ? " / " + a.etape : "")),
    total: agreger(appels),
    parJour: grouper(appels, (a) => a.horodatage.slice(0, 10))
  };
}

const fmtN = (v) => (v === null ? "n/a" : String(Math.round(v)));
const fmtD = (v) => (v === null ? "tarif non confirmé" : v.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + " $");
const fmtMs = (v) => (v === null ? "n/a" : Math.round(v) + " ms");

function blocs(titre, lignes) {
  const sortie = [titre];
  for (const g of lignes) {
    sortie.push(
      "  " + g.cle + " : " + g.appels + " appel(s) (" + g.reussis + " réussi(s), " + g.erreurs + " en erreur)",
      "    jetons moyens : " + fmtN(g.jetonsEntreeMoyen) + " en entrée, " + fmtN(g.jetonsSortieMoyen) + " en sortie",
      "    coût : moyen " + fmtD(g.coutMoyen) + ", min " + fmtD(g.coutMin) + ", max " + fmtD(g.coutMax) + ", total " + fmtD(g.coutTotal) + (g.sansTarif && g.coutTotal !== null ? " (hors " + g.sansTarif + " appel(s) sans tarif ou sans jetons)" : ""),
      "    durée moyenne : " + fmtMs(g.dureeMoyenneMs)
    );
  }
  return sortie;
}

export const RAPPEL = "Ce sont des estimations calculées à partir des jetons rapportés par l'API ; la source de vérité du coût réel est la console Anthropic (Usage / Cost). Les nouvelles tentatives automatiques du SDK (maxRetries) ne sont pas visibles ici.";

export function formater(s) {
  if (!s.total.appels) return "Aucun appel enregistré" + (s.depuis || s.route ? " pour ce filtre" : "") + ".\n" + RAPPEL;
  const t = s.total;
  const sortie = [
    ...blocs("Par fonctionnalité", s.parRoute), "",
    "Total général : " + t.appels + " appel(s) (" + t.reussis + " réussi(s), " + t.erreurs + " en erreur), coût total " + fmtD(t.coutTotal) + ", coût moyen par appel " + fmtD(t.coutMoyen) + ", durée moyenne " + fmtMs(t.dureeMoyenneMs), "",
    "Par jour"
  ];
  for (const j of s.parJour) sortie.push("  " + j.cle + " : " + j.appels + " appel(s), " + j.erreurs + " en erreur, coût " + fmtD(j.coutTotal));
  sortie.push("", RAPPEL);
  return sortie.join("\n");
}

export function lireArguments(argv) {
  const o = { depuis: null, route: null, json: false, fichier: FICHIER_JOURNAL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--depuis" || a === "--route" || a === "--fichier") {
      const v = argv[++i];
      if (!v) throw new Error("Valeur manquante après " + a);
      o[a.slice(2)] = v;
    } else throw new Error("Option inconnue : " + a);
  }
  if (o.depuis && !/^\d{4}-\d{2}-\d{2}$/.test(o.depuis)) throw new Error("--depuis attend une date AAAA-MM-JJ");
  return o;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const o = lireArguments(process.argv.slice(2));
    const s = synthese(lireJournal(o.fichier), o);
    console.log(o.json ? JSON.stringify({ ...s, avertissement: RAPPEL }, null, 2) : formater(s));
  } catch (erreur) {
    console.error(erreur.message);
    process.exitCode = 1;
  }
}
