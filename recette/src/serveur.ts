import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DOSSIER_BUILD, PORT_PREVIEW, RACINE_OUVRA } from "./config.js";

export interface IServeur {
  urlBase: string;
  /** Vrai si le harnais a lance lui-meme le serveur (et doit donc l'arreter). */
  possede: boolean;
  arreter(): Promise<void>;
}

export interface IOptionsServeur {
  /** URL d'un serveur deja lance (dev ou preview). Rien n'est alors construit ni lance. */
  url?: string;
  /** Reutilise le build existant de DOSSIER_BUILD au lieu de le refaire. */
  sansBuild: boolean;
}

const vite = join(RACINE_OUVRA, "node_modules", ".bin", "vite");

function lancer(args: string[], journal: string[]): ChildProcess {
  const enfant = spawn(vite, args, { cwd: RACINE_OUVRA, env: { ...process.env, FORCE_COLOR: "0" } });
  enfant.stdout?.on("data", (d: Buffer) => journal.push(d.toString()));
  enfant.stderr?.on("data", (d: Buffer) => journal.push(d.toString()));
  return enfant;
}

function attendreFin(enfant: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    enfant.once("error", reject);
    enfant.once("close", (code) => resolve(code ?? 1));
  });
}

async function repond(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function attendreReponse(url: string, delaiMs: number): Promise<void> {
  const fin = Date.now() + delaiMs;
  while (Date.now() < fin) {
    if (await repond(url)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Le serveur ne repond pas sur ${url} apres ${delaiMs} ms.`);
}

/**
 * Prepare la version a tester. Par defaut : `vite build` vers un dossier temporaire puis `vite preview` sur un port dedie, car la version construite
 * revele des bugs que le serveur de dev masque (cas de `pako`, 19-20/10). Les appels `/api/*` ne sont de toute facon jamais envoyes : le harnais les
 * intercepte dans le navigateur.
 */
export async function demarrerServeur(options: IOptionsServeur): Promise<IServeur> {
  if (options.url) {
    const urlBase = options.url.endsWith("/") ? options.url : `${options.url}/`;
    if (!(await repond(urlBase))) throw new Error(`Aucun serveur ne repond sur ${urlBase}.`);
    return { urlBase, possede: false, arreter: async () => undefined };
  }

  const journal: string[] = [];
  const buildExiste = existsSync(join(DOSSIER_BUILD, "index.html"));
  if (!options.sansBuild || !buildExiste) {
    console.log("Build de la version construite (npm run build vers un dossier temporaire)...");
    const code = await attendreFin(lancer(["build", "--outDir", DOSSIER_BUILD, "--emptyOutDir"], journal));
    if (code !== 0) throw new Error(`Le build a echoue (code ${code}).\n${journal.slice(-20).join("")}`);
  }

  const urlBase = `http://127.0.0.1:${PORT_PREVIEW}/`;
  if (await repond(urlBase)) {
    throw new Error(`Le port ${PORT_PREVIEW} est deja utilise. Arrete ce serveur ou passe --url pour tester celui-la.`);
  }
  const preview = lancer(["preview", "--outDir", DOSSIER_BUILD, "--host", "127.0.0.1", "--port", String(PORT_PREVIEW), "--strictPort"], journal);
  try {
    await attendreReponse(urlBase, 30_000);
  } catch (e) {
    preview.kill();
    throw new Error(`${(e as Error).message}\n${journal.slice(-20).join("")}`);
  }
  return {
    urlBase,
    possede: true,
    arreter: async () => {
      preview.kill();
      await new Promise((r) => setTimeout(r, 200));
    }
  };
}
