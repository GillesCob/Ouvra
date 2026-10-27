import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { webkit, type Browser, type BrowserContext } from "playwright-core";
import {
  CACHE_PLAYWRIGHT,
  DELAI_CHARGEMENT_MS,
  DOSSIER_TELECHARGEMENTS,
  USER_AGENT_IPHONE,
  VIEWPORTS
} from "./config.js";
import type { IAppelApi, IContexteTest, IPageSuivie, IVerificateur, TAppareil, TReponseApi, TSimulateurApi } from "./types.js";

let navigateur: Browser | null = null;

/** Lance WebKit. Le paquet attend parfois un moteur absent du cache : on retombe alors sur le plus recent `webkit-*` installe (pw_run.sh). */
export async function obtenirNavigateur(): Promise<Browser> {
  if (navigateur) return navigateur;
  const surcharge = process.env["OUVRA_WEBKIT"];
  const candidats: Array<string | undefined> = [surcharge, undefined];
  if (existsSync(CACHE_PLAYWRIGHT)) {
    const dossiers = readdirSync(CACHE_PLAYWRIGHT)
      .filter((d) => /^webkit-\d+$/.test(d))
      .sort((a, b) => Number(b.slice(7)) - Number(a.slice(7)));
    for (const d of dossiers) candidats.push(join(CACHE_PLAYWRIGHT, d, "pw_run.sh"));
  }
  let derniereErreur: unknown;
  for (const executablePath of candidats) {
    if (executablePath !== undefined && !existsSync(executablePath)) continue;
    try {
      navigateur = await webkit.launch(executablePath ? { executablePath } : {});
      return navigateur;
    } catch (e) {
      derniereErreur = e;
    }
  }
  throw new Error(`Impossible de lancer WebKit (essaye : ${candidats.filter(Boolean).join(", ") || "moteur par defaut"}). ${String(derniereErreur)}`);
}

export async function fermerNavigateur(): Promise<void> {
  if (navigateur) await navigateur.close();
  navigateur = null;
}

function creerVerificateur(liste: import("./types.js").IControle[]): IVerificateur {
  return {
    controle(libelle, ok, observe) {
      const texte = observe === undefined ? "" : typeof observe === "string" ? observe : JSON.stringify(observe);
      liste.push({ libelle, ok, observe: texte.length > 300 ? `${texte.slice(0, 300)}...` : texte });
    },
    saute(libelle, raison) {
      liste.push({ libelle, ok: true, observe: raison, saute: true });
    }
  };
}

async function attendreChargement(page: IPageSuivie): Promise<void> {
  await page.waitForFunction(
    () => {
      const o = document.getElementById("loadingOverlay");
      return !o || o.classList.contains("hidden") || getComputedStyle(o).display === "none";
    },
    null,
    { timeout: DELAI_CHARGEMENT_MS }
  );
}

export interface IContexteConstruit {
  ctx: IContexteTest;
  fermer(): Promise<void>;
}

/**
 * Cree un contexte de navigateur neuf (equivalent d'une fenetre privee : stockage vide, « demarrage propre » du plan de recette) avec :
 * - toute requete `/api/*` interceptee et simulee (aucun appel IA reel ne part, jamais) ;
 * - toute requete hors de l'application abandonnee ;
 * - les erreurs de page et de console consignees sur la page.
 */
export async function creerContexteTest(
  appareil: TAppareil,
  urlBase: string,
  controles: import("./types.js").IControle[]
): Promise<IContexteConstruit> {
  const b = await obtenirNavigateur();
  const contexte: BrowserContext = await b.newContext(
    appareil === "laptop"
      ? { viewport: VIEWPORTS.laptop, acceptDownloads: true }
      : { viewport: VIEWPORTS.mobile, hasTouch: true, isMobile: true, deviceScaleFactor: 3, userAgent: USER_AGENT_IPHONE, acceptDownloads: true }
  );
  // tsx (esbuild) enveloppe les fonctions nommees d'un `page.evaluate` dans un assistant `__name` qui n'existe pas dans la page : on le definit.
  await contexte.addInitScript("window.__name = (f) => f;");
  const simulateurs = new Map<string, TSimulateurApi>();
  const appelsApi: IAppelApi[] = [];
  const origine = new URL(urlBase).origin;
  let etags: { mecanique: string; architecture: string } | null = null;

  await contexte.route("**/*", async (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.fallback();
    if (url.origin !== origine) return route.abort();
    if (url.pathname.startsWith("/api/")) {
      let corps: Record<string, unknown> = {};
      try {
        const brut: unknown = JSON.parse(requete.postData() ?? "null");
        if (brut && typeof brut === "object") corps = brut as Record<string, unknown>;
      } catch {
        corps = {};
      }
      const simulateur = simulateurs.get(url.pathname);
      appelsApi.push({ chemin: url.pathname, corps, simule: simulateur !== undefined });
      const reponse: TReponseApi = simulateur
        ? await simulateur(corps)
        : { ok: false, code: "ia_indisponible", message: "Aucun simulateur declare dans le harnais pour cet endpoint." };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reponse) });
    }
    if (etags && requete.method() === "HEAD" && url.pathname.endsWith(".xkt")) {
      const valeur = url.pathname.includes("mechanical") ? etags.mecanique : url.pathname.includes("architecture") ? etags.architecture : "structure";
      return route.fulfill({ status: 200, headers: { etag: `"${valeur}"`, "content-length": "100" } });
    }
    return route.fallback();
  });

  const dossierTelechargements = join(DOSSIER_TELECHARGEMENTS, `${Date.now()}-${appareil}`);
  mkdirSync(dossierTelechargements, { recursive: true });

  const ctx: IContexteTest = {
    appareil,
    urlBase,
    contexte,
    verif: creerVerificateur(controles),
    appelsApi,
    dossierTelechargements,
    simulerApi: (chemin, simulateur) => {
      simulateurs.set(chemin, simulateur);
    },
    simulerEtag: (valeurs) => {
      etags = valeurs;
    },
    ouvrir: async (hash = "") => {
      const page = (await contexte.newPage()) as IPageSuivie;
      page.erreursPage = [];
      page.on("pageerror", (e) => page.erreursPage.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") page.erreursPage.push(`console: ${m.text()}`);
      });
      await page.goto(urlBase + hash);
      await attendreChargement(page);
      return page;
    }
  };
  return { ctx, fermer: () => contexte.close() };
}
