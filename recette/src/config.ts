import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Racine du depot Ouvra (le dossier `recette/` en est un sous-dossier). */
export const RACINE_OUVRA = resolve(ICI, "..", "..");

/** Port dedie de la version construite : ni 5173/5174/5175 (dev), ni 4173 (preview de Gilles), pour ne jamais gener ses serveurs. */
export const PORT_PREVIEW = 4180;

/** Build de la recette dans le dossier temporaire du systeme : `dist/` du depot n'est jamais touche. */
export const DOSSIER_BUILD = join(tmpdir(), "ouvra-recette-dist");

export const DOSSIER_TELECHARGEMENTS = join(tmpdir(), "ouvra-recette-telechargements");

export const VIEWPORTS = {
  laptop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 780 }
} as const;

export const USER_AGENT_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/** Delai maximal de fin de chargement des maquettes (l'ecran de chargement `#loadingOverlay` doit etre masque). */
export const DELAI_CHARGEMENT_MS = 120_000;

/** Dossier des moteurs Playwright deja installes sur le Mac (la version du paquet n'attend pas toujours celle du cache). */
export const CACHE_PLAYWRIGHT = join(homedir(), "Library", "Caches", "ms-playwright");
