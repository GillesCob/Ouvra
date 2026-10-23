// Plugin Vite, serveur de dev et de previsualisation SEULEMENT : monte la fonction api/regle.js sur POST /api/regle, comme le fait Vercel
// en production (Vite ne sert pas le dossier api/). Aucun effet dans la version construite deployee.
//
// La cle ANTHROPIC_API_KEY est lue dans l'environnement du processus, ou a defaut dans .env.local (ignore par git, jamais commite) :
//   echo 'ANTHROPIC_API_KEY=...' > .env.local
// Sans cle, le relais repond « ia_indisponible » et la page retombe sur les phrases d'exemple.
import { loadEnv } from "vite";

async function versRequete(req) {
  const morceaux = [];
  for await (const m of req) morceaux.push(m);
  const corps = Buffer.concat(morceaux);
  const hote = req.headers.host || "localhost";
  return new Request("http://" + hote + req.url, {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" || corps.length === 0 ? undefined : corps
  });
}

function monter(serveur, mode) {
  const env = loadEnv(mode, process.cwd(), "");
  if (!process.env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  serveur.middlewares.use("/api/regle", async (req, res) => {
    try {
      const { default: fonction } = await import("../api/regle.js");
      const reponse = await fonction.fetch(await versRequete(req));
      res.statusCode = reponse.status;
      reponse.headers.forEach((valeur, nom) => res.setHeader(nom, valeur));
      res.end(Buffer.from(await reponse.arrayBuffer()));
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, code: "ia_indisponible", message: "Relais indisponible en local." }));
    }
  });
}

export function relaisIA() {
  let mode = "development";
  return {
    name: "ouvra-relais-ia",
    apply: "serve",
    config: (config, env) => { mode = env.mode; },
    configureServer: (serveur) => monter(serveur, mode),
    configurePreviewServer: (serveur) => monter(serveur, mode)
  };
}
