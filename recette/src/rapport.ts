import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { INonAutomatisable, IResultatAppareil, IResultatTest, TStatut } from "./types.js";

const MARQUE: Record<TStatut, string> = { OK: "OK", KO: "KO", ERR: "ERR", "N/A": "-" };

function cellule(r: IResultatAppareil): string {
  const sautees = r.controles.filter((c) => c.saute).length;
  return sautees > 0 ? `${MARQUE[r.statut]} (${sautees} sautee${sautees > 1 ? "s" : ""})` : MARQUE[r.statut];
}

/** Une ligne par Test : numero, nom, laptop, mobile, cause (premiere assertion en echec). */
export function lignes(resultats: IResultatTest[]): string[] {
  return resultats.map((r) => {
    const causes = [
      r.laptop.cause && `laptop : ${r.laptop.cause}`,
      r.mobile.cause && `mobile : ${r.mobile.cause}`
    ].filter(Boolean);
    const cause = causes.length ? ` | ${causes.join(" || ")}` : "";
    return `Test ${r.numero} | ${r.nom} | laptop ${cellule(r.laptop)} | mobile ${cellule(r.mobile)}${cause}`;
  });
}

export function afficherRapport(resultats: IResultatTest[]): void {
  console.log("\nRAPPORT DE RECETTE AUTOMATIQUE (OK = conforme, KO = assertion en echec, ERR = le script a plante, cause non etablie, - = sans objet, « sautee » = assertion non jouee car la fonction est masquee dans l'application, raison dans le detail)\n");
  for (const l of lignes(resultats)) console.log(l);
  const total = resultats.flatMap((r) => [r.laptop, r.mobile]).filter((x) => x.statut !== "N/A");
  const nb = (s: TStatut) => total.filter((x) => x.statut === s).length;
  console.log(`\n${nb("OK")} OK, ${nb("KO")} KO, ${nb("ERR")} ERR sur ${total.length} passes (un Test sur un appareil = une passe).`);
  console.log("Rendu a l'oeil, tactile reel, dictee, qualite des reponses de l'IA : voir --non-automatisable (rien de cela n'est couvert).");
}

/** Detail de toutes les assertions, dans un JSON du dossier de sortie (pas dans le vault : l'ecriture dans le vault reste une decision de Claude/Gilles). */
export function ecrireDetail(resultats: IResultatTest[], dossier: string): string {
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, `detail-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(chemin, JSON.stringify(resultats, null, 2));
  return chemin;
}

export function afficherNonAutomatisables(liste: INonAutomatisable[]): void {
  console.log("\nCE QUI N'EST PAS AUTOMATISE (jamais invente comme OK) :\n");
  for (const n of liste) {
    console.log(`- [${n.categorie}] ${n.numero === null ? "Hors Test" : `Test ${n.numero}`} : ${n.libelle}. Raison : ${n.raison}`);
  }
}
