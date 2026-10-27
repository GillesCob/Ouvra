import { creerContexteTest } from "./navigateur.js";
import type { IControle, IResultatAppareil, IResultatTest, ITestDef, TAppareil, TFonctionTest } from "./types.js";

const resultatNA = (): IResultatAppareil => ({ statut: "N/A", controles: [], cause: "", dureeMs: 0 });

function premiereCause(controles: IControle[]): string {
  const echec = controles.find((c) => !c.ok);
  if (!echec) return "";
  return echec.observe ? `${echec.libelle} (observé : ${echec.observe})` : echec.libelle;
}

async function executerAppareil(appareil: TAppareil, fonction: TFonctionTest | undefined, urlBase: string): Promise<IResultatAppareil> {
  if (!fonction) return resultatNA();
  const debut = Date.now();
  const controles: IControle[] = [];
  const { ctx, fermer } = await creerContexteTest(appareil, urlBase, controles);
  try {
    await fonction(ctx);
    const cause = premiereCause(controles);
    if (controles.length === 0) {
      return { statut: "ERR", controles, cause: "aucune assertion enregistree (test vide)", dureeMs: Date.now() - debut };
    }
    return { statut: cause ? "KO" : "OK", controles, cause, dureeMs: Date.now() - debut };
  } catch (e) {
    // Exception du script (selecteur introuvable, delai depasse...) : cause non etablie, a ne pas lire comme un defaut de l'application.
    const lignesErreur = (e instanceof Error ? e.message : String(e)).split("\n").map((l) => l.trim()).filter(Boolean);
    const message = lignesErreur.filter((l) => !/^[-=]/.test(l) || /waiting for|locator/.test(l)).slice(0, 12).join(" / ");
    const avant = premiereCause(controles);
    return {
      statut: "ERR",
      controles,
      cause: `exception du script apres ${controles.length} assertion(s) : ${message.slice(0, 900)}${avant ? ` ; premier echec avant : ${avant}` : ""}`,
      dureeMs: Date.now() - debut
    };
  } finally {
    await fermer().catch(() => undefined);
  }
}

export async function executerTest(test: ITestDef, urlBase: string, appareils: TAppareil[]): Promise<IResultatTest> {
  const laptop = appareils.includes("laptop") ? await executerAppareil("laptop", test.laptop, urlBase) : resultatNA();
  const mobile = appareils.includes("mobile") ? await executerAppareil("mobile", test.mobile, urlBase) : resultatNA();
  return { numero: test.numero, nom: test.nom, laptop, mobile };
}
