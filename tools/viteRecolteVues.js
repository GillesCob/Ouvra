// Plugin Vite, serveur de dev SEULEMENT (apply: "serve") : recoit les vues 3D recoltees par src/messagerie/recolteVues.js
// (adresse http://localhost:5173/?vues=1) et les range dans public/images/vues/.
//
//   POST /__vues/<id>   corps JSON { image: "data:image/jpeg;base64,...", meta: { collisionId, niveau, modeles, camera, niveaux, maquettes, coupe, entites } }
//   -> ecrit public/images/vues/<id>.jpg et met a jour public/images/vues/index.json (tableau, une entree par id)
//
// Garde-fous : identifiant strict, corps limite a 800 Ko, JPEG verifie (octets de signature), ecriture uniquement dans le dossier des
// vues, metadonnees reduites aux champs attendus. Aucun effet dans la version construite : les fichiers deja presents sont servis tels quels.
import fs from "node:fs";
import path from "node:path";

const ID_VALIDE = /^[A-Za-z0-9_-]{1,64}$/;
const TAILLE_MAX = 800 * 1024;
const IDS_MAX = 4000; // plafond d'ids d'entites par vue (meme valeur que ETAT_ENTITES_PLAFOND de src/main.js)
const MAQUETTES_MAX = 30;
const PREFIXE_JPEG = "data:image/jpeg;base64,";

const nombres3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));
const texteCourt = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

// Liste d'ids d'entites { sauf, ids } : ids = textes courts, au plus `reste` ids ; renvoie null si invalide. `budget.reste` decompte le total.
function assainirListe(l, budget) {
  if (!l || typeof l !== "object" || !Array.isArray(l.ids)) return null;
  const ids = l.ids.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64);
  if (ids.length > budget.reste) return null;
  budget.reste -= ids.length;
  return { sauf: !!l.sauf, ids };
}

// Etat d'affichage des entites (voir capturerEtatEntites dans src/main.js) : structure verifiee, total d'ids borne. Rien de valide : null.
function assainirEntites(e) {
  if (!e || typeof e !== "object" || !e.parMaquette || typeof e.parMaquette !== "object") return null;
  const budget = { reste: IDS_MAX };
  const parMaquette = {};
  Object.entries(e.parMaquette).slice(0, MAQUETTES_MAX).forEach(([mid, cats]) => {
    if (!cats || typeof cats !== "object" || !ID_VALIDE.test(mid)) return;
    const sortie = {};
    ["masques", "xray", "selection", "surlignes"].forEach((cat) => {
      const liste = assainirListe(cats[cat], budget);
      if (liste) sortie[cat] = liste;
    });
    const couleurs = (Array.isArray(cats.couleurs) ? cats.couleurs.slice(0, 200) : []).map((c) => {
      const rgb = c && Array.isArray(c.rgb) && c.rgb.length === 3 && c.rgb.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? c.rgb : null;
      if (!c || (c.rgb !== null && !rgb)) return null;
      const ids = assainirListe(c.ids, budget);
      return ids ? { rgb, ids } : null;
    }).filter(Boolean);
    if (couleurs.length) sortie.couleurs = couleurs;
    const opacites = (Array.isArray(cats.opacites) ? cats.opacites.slice(0, 256) : []).map((o) => {
      if (!o || !Number.isInteger(o.a) || o.a < 0 || o.a > 255) return null;
      const ids = assainirListe(o.ids, budget);
      return ids ? { a: o.a, ids } : null;
    }).filter(Boolean);
    if (opacites.length) sortie.opacites = opacites;
    if (Object.keys(sortie).length) parMaquette[mid] = sortie;
  });
  const x = e.xrayMat;
  const xrayMat = x && Number.isFinite(x.fillAlpha) && Number.isFinite(x.edgeAlpha) && nombres3(x.fillColor) && nombres3(x.edgeColor)
    ? { fillAlpha: x.fillAlpha, edgeAlpha: x.edgeAlpha, fillColor: x.fillColor, edgeColor: x.edgeColor }
    : null;
  return { parMaquette, xrayMat, tronque: !!e.tronque };
}

// Ne garde que les champs attendus, avec leurs types.
function assainirMeta(id, meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  const camera = m.camera && nombres3(m.camera.eye) && nombres3(m.camera.look) && nombres3(m.camera.up)
    ? { eye: m.camera.eye, look: m.camera.look, up: m.camera.up }
    : null;
  const maquettes = Array.isArray(m.maquettes)
    ? m.maquettes.slice(0, 30).filter((x) => x && typeof x.id === "string").map((x) => ({ id: texteCourt(x.id, 64), visible: !!x.visible }))
    : [];
  const niveaux = Array.isArray(m.niveaux)
    ? m.niveaux.slice(0, 200).filter((x) => x && typeof x.name === "string").map((x) => ({ name: texteCourt(x.name, 128), checked: !!x.checked }))
    : [];
  const coupe = m.coupe && nombres3(m.coupe.pos) && nombres3(m.coupe.dir) ? { pos: m.coupe.pos, dir: m.coupe.dir, active: !!m.coupe.active } : null;
  const collisionId = texteCourt(m.collisionId, 64);
  return {
    id,
    version: Number.isInteger(m.version) ? m.version : 0,
    collisionId: ID_VALIDE.test(collisionId) ? collisionId : id,
    niveau: texteCourt(m.niveau, 64),
    modeles: texteCourt(m.modeles, 128),
    camera,
    niveaux,
    maquettes,
    coupe,
    entites: assainirEntites(m.entites)
  };
}

function lireCorps(req) {
  return new Promise((resolve, reject) => {
    const annonce = Number(req.headers["content-length"] || 0);
    if (annonce > TAILLE_MAX) {
      reject(Object.assign(new Error("Corps trop volumineux."), { statut: 413 }));
      return;
    }
    const morceaux = [];
    let taille = 0;
    req.on("data", (morceau) => {
      taille += morceau.length;
      if (taille > TAILLE_MAX) {
        reject(Object.assign(new Error("Corps trop volumineux."), { statut: 413 }));
        req.destroy();
        return;
      }
      morceaux.push(morceau);
    });
    req.on("end", () => resolve(Buffer.concat(morceaux).toString("utf8")));
    req.on("error", reject);
  });
}

function repondre(res, statut, texte) {
  res.statusCode = statut;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(texte);
}

// Ecriture en deux temps (fichier temporaire puis renommage) : l'index n'est jamais lu a moitie ecrit.
function ecrireAtomique(chemin, contenu) {
  const temporaire = chemin + ".tmp";
  fs.writeFileSync(temporaire, contenu);
  fs.renameSync(temporaire, chemin);
}

function lireIndex(cheminIndex) {
  if (!fs.existsSync(cheminIndex)) return [];
  const liste = JSON.parse(fs.readFileSync(cheminIndex, "utf8"));
  return Array.isArray(liste) ? liste : [];
}

export function recolteVues() {
  return {
    name: "ouvra-recolte-vues",
    apply: "serve",
    configureServer(server) {
      const dossier = path.resolve(server.config.root, "public", "images", "vues");
      server.middlewares.use("/__vues", async (req, res) => {
        try {
          if (req.method !== "POST") return repondre(res, 405, "Méthode non autorisée.");
          const id = (req.url || "").replace(/^\//, "").split("?")[0];
          if (!ID_VALIDE.test(id)) return repondre(res, 400, "Identifiant invalide.");

          const corps = JSON.parse(await lireCorps(req));
          const image = corps && corps.image;
          if (typeof image !== "string" || !image.startsWith(PREFIXE_JPEG)) return repondre(res, 400, "L'image doit être un JPEG en data URL base64.");
          const octets = Buffer.from(image.slice(PREFIXE_JPEG.length), "base64");
          if (octets.length < 4 || octets[0] !== 0xff || octets[1] !== 0xd8 || octets[2] !== 0xff) return repondre(res, 400, "Le fichier n'est pas un JPEG.");

          const cible = path.resolve(dossier, id + ".jpg");
          if (path.dirname(cible) !== dossier) return repondre(res, 400, "Chemin refusé.");
          fs.mkdirSync(dossier, { recursive: true });
          ecrireAtomique(cible, octets);

          const cheminIndex = path.join(dossier, "index.json");
          const index = lireIndex(cheminIndex).filter((v) => v && v.id !== id);
          index.push(assainirMeta(id, corps.meta));
          ecrireAtomique(cheminIndex, JSON.stringify(index, null, 2) + "\n");
          return repondre(res, 200, "ok");
        } catch (erreur) {
          const statut = erreur && erreur.statut ? erreur.statut : (erreur instanceof SyntaxError ? 400 : 500);
          server.config.logger.error("[recolte des vues] " + (erreur && erreur.message));
          return repondre(res, statut, statut === 500 ? "Erreur du serveur." : erreur.message);
        }
      });
    }
  };
}
