import { tmpdir } from "node:os";
import { join } from "node:path";
import { executerTest } from "./executeur.js";
import { fermerNavigateur } from "./navigateur.js";
import { afficherNonAutomatisables, afficherRapport, ecrireDetail } from "./rapport.js";
import { NON_AUTOMATISABLES, TESTS, TEST_9_COMPOSE } from "./registre.js";
import { demarrerServeur } from "./serveur.js";
import type { IResultatTest, TAppareil } from "./types.js";

interface IOptions {
  tests: number[] | "tous";
  appareils: TAppareil[];
  url: string | undefined;
  sansBuild: boolean;
  liste: boolean;
  nonAutomatisable: boolean;
}

const AIDE = `Recette automatique d'Ouvra (WebKit, version construite, appels IA simules, aucune capture).

  npm run recette                       tous les Tests automatises, laptop et mobile
  npm run recette -- --test 1,7         seulement les Tests 1 et 7 (--test 9 : l'iPhone des Tests 1, 2, 7, 8)
  npm run recette -- --appareil mobile  laptop | mobile | les-deux (defaut)
  npm run recette -- --sans-build       reutilise le build precedent (gain d'environ 15 s)
  npm run recette -- --url http://localhost:5173/   teste un serveur deja lance (dev ou preview), sans build
  npm run recette -- --liste            liste les Tests et ce qu'ils couvrent
  npm run recette -- --non-automatisable   liste ce qui reste a la main, avec la raison
`;

function lireOptions(argv: string[]): IOptions {
  const options: IOptions = { tests: "tous", appareils: ["laptop", "mobile"], url: undefined, sansBuild: false, liste: false, nonAutomatisable: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const suivant = argv[i + 1];
    if (a === "--test" && suivant) {
      options.tests = suivant.split(",").map((x) => Number(x.trim()));
      if (options.tests.some((n) => !Number.isInteger(n))) throw new Error(`--test attend des numeros separes par des virgules (recu : ${suivant}).`);
      i++;
    } else if (a === "--appareil" && suivant) {
      if (suivant === "laptop" || suivant === "mobile") options.appareils = [suivant];
      else if (suivant === "les-deux") options.appareils = ["laptop", "mobile"];
      else throw new Error(`--appareil attend laptop, mobile ou les-deux (recu : ${suivant}).`);
      i++;
    } else if (a === "--url" && suivant) {
      options.url = suivant;
      i++;
    } else if (a === "--sans-build") options.sansBuild = true;
    else if (a === "--liste") options.liste = true;
    else if (a === "--non-automatisable") options.nonAutomatisable = true;
    else if (a === "--aide" || a === "-h" || a === "--help") {
      console.log(AIDE);
      process.exit(0);
    } else throw new Error(`Option inconnue : ${String(a)}\n${AIDE}`);
  }
  return options;
}

async function principal(): Promise<number> {
  const options = lireOptions(process.argv.slice(2));

  if (options.liste) {
    for (const t of TESTS) {
      const appareils = [t.laptop ? "laptop" : null, t.mobile ? "mobile" : null].filter(Boolean).join(" + ");
      console.log(`Test ${t.numero} | ${t.nom} | ${appareils} | couvre ${t.couvre.join(", ")}`);
    }
    return 0;
  }
  if (options.nonAutomatisable) {
    afficherNonAutomatisables(NON_AUTOMATISABLES);
    return 0;
  }

  // Test 9 (iPhone : navigation, Quantitatif, Discussions par IA, Viewer par IA) n'a pas de code propre : ce sont les colonnes « mobile » des Tests 1, 2, 7 et 8.
  let appareils = options.appareils;
  let numeros = options.tests;
  if (numeros !== "tous" && numeros.includes(9)) {
    numeros = [...new Set([...numeros.filter((n) => n !== 9), ...TEST_9_COMPOSE])];
    if (options.tests !== "tous" && options.tests.length === 1) appareils = ["mobile"];
    console.log(`Test 9 (iPhone) = colonne mobile des Tests ${TEST_9_COMPOSE.join(", ")}.`);
  }
  const choisis = TESTS.filter((t) => numeros === "tous" || numeros.includes(t.numero));
  if (choisis.length === 0) throw new Error(`Aucun Test automatise ne porte ce numero. Voir --liste.`);

  const serveur = await demarrerServeur({ url: options.url, sansBuild: options.sansBuild });
  console.log(`Application testee : ${serveur.urlBase}${options.url ? " (serveur fourni)" : " (version construite)"}`);
  const resultats: IResultatTest[] = [];
  try {
    for (const t of choisis) {
      process.stdout.write(`Test ${t.numero} : ${t.nom}... `);
      const r = await executerTest(t, serveur.urlBase, appareils);
      resultats.push(r);
      console.log(`laptop ${r.laptop.statut}, mobile ${r.mobile.statut}`);
    }
  } finally {
    await fermerNavigateur();
    await serveur.arreter();
  }
  afficherRapport(resultats);
  const detail = ecrireDetail(resultats, join(tmpdir(), "ouvra-recette-rapports"));
  console.log(`Detail de chaque assertion : ${detail}`);
  const echec = resultats.some((r) => [r.laptop, r.mobile].some((x) => x.statut === "KO" || x.statut === "ERR"));
  return echec ? 1 : 0;
}

principal().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
);
