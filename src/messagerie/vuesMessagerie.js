// Prises de vue de la messagerie : banque d'images recoltees dans les collisions, schema de repli, rendu des vignettes.
//
// Une « vue » est { seed, niveau, modeles, image?, etat? } (voir messagerieDonnees.js). Avec une image (URL ou data URL JPEG) on affiche
// la vraie capture de la 3D (recoltee automatiquement au chargement par main.js, voir recolteVues.js) ; sans image (premier chargement
// seulement), une vignette neutre « Vue 3D en préparation ». Le schema SVG ci-dessous n'est plus affiche (code conserve, non utilise).
import { echapper } from "./format.js";

export const DOSSIER_VUES = "images/vues/";
export const INDEX_VUES = DOSSIER_VUES + "index.json";
// Nombre de vues de la banque (les premieres, triees par numero de collision) que Discussions distribue aux messages de demonstration : la banque
// contient aussi les images des autres collisions (modale des regles), qui ne doivent pas changer les vues deja validees des echanges.
export const NOMBRE_VUES_MESSAGERIE = 8;

// Generateur pseudo-aleatoire a graine (mulberry32).
export function aleatoire(graine) {
  let s = graine;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NIVEAUX_SCHEMA = ["R-1", "R+0", "R+1", "R+2", "R+3"];

// Schema de repli (porte du mockup) : cinq dalles, une poutre, une gaine, une bulle de collision.
export function schemaVue(vue) {
  const r = aleatoire(vue.seed);
  const niveau = Math.max(0, NIVEAUX_SCHEMA.indexOf(vue.niveau));
  const h = 30;
  const dx = 36;
  const dy = 18;
  const x0 = 40 + Math.floor(r() * 30);
  const yHaut = 172 - niveau * h;
  const bx = x0 + 50 + Math.floor(r() * 60);
  let o = '<svg class="msg-vsvg" viewBox="0 0 320 200" role="img" aria-label="Prise de vue ' + echapper(vue.niveau) + '"><rect class="msg-vsvg-fond" width="320" height="200"/>';
  for (let i = 0; i < 5; i++) {
    const y = 172 - i * h;
    o += '<polygon class="msg-vsvg-dalle' + (i === niveau ? " hi" : "") + '" points="' + x0 + "," + y + " " + (x0 + 180) + "," + y + " " + (x0 + 180 + dx) + "," + (y - dy) + " " + (x0 + dx) + "," + (y - dy) + '"/>';
    if (i < 4) for (let k = 0; k < 4; k++) o += '<line class="msg-vsvg-poteau" x1="' + (x0 + k * 60) + '" y1="' + y + '" x2="' + (x0 + k * 60) + '" y2="' + (y - h) + '"/>';
  }
  o += '<line class="msg-vsvg-poutre" x1="' + (x0 + 10) + '" y1="' + (yHaut - 4) + '" x2="' + (x0 + 190) + '" y2="' + (yHaut - 4) + '"/>';
  o += '<line class="msg-vsvg-gaine" x1="' + (x0 + 20) + '" y1="' + (yHaut - 14) + '" x2="' + (x0 + 200) + '" y2="' + (yHaut - 14) + '"/>';
  o += '<circle class="msg-vsvg-marque" cx="' + bx + '" cy="' + (yHaut - 9) + '" r="10"/>';
  return o + '<text class="msg-vsvg-etiquette" x="10" y="20">' + echapper(vue.niveau) + "</text></svg>";
}

// Contenu visuel d'une vue : la capture 3D si elle existe, sinon une vignette neutre (jamais le schema ni un plan 2D).
export function imageVue(vue) {
  if (vue.image) return '<img class="msg-vimg" src="' + echapper(vue.image) + '" alt="Prise de vue ' + echapper(vue.niveau) + '" decoding="async">';
  return '<div class="msg-vattente" role="img" aria-label="Vue 3D en préparation"><span>Vue 3D en préparation</span></div>';
}

export function legendeVue(vue) {
  return vue.niveau + " · " + vue.modeles;
}

// Banque de vues recoltees : tolerante a l'absence du fichier (serveur de dev ou le fichier n'existe pas encore : l'index peut
// meme revenir sous forme de page HTML, donc illisible en JSON). Renvoie toujours un tableau, TRIE par identifiant (l'ordre du fichier
// change a chaque recolte : le plugin range chaque vue reecrite en fin de liste, ce qui deplacerait l'image attribuee a un message).
// `version` : empreinte du contenu de l'index, ajoutee a l'URL des images (?v=) pour qu'un JPEG reecrit sous le meme nom ne reste pas en cache.
export async function chargerBanque() {
  try {
    const reponse = await fetch(import.meta.env.BASE_URL + INDEX_VUES, { cache: "no-cache" });
    if (!reponse.ok) return [];
    const texte = await reponse.text();
    const liste = JSON.parse(texte);
    if (!Array.isArray(liste)) return [];
    const version = empreinte(texte);
    return liste.filter((v) => v && typeof v.id === "string")
      .sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }))
      .map((v) => Object.assign({}, v, { version: version }));
  } catch (e) {
    // Fichier absent ou illisible : repli sur les schemas, sans bruit.
    return [];
  }
}

// Empreinte courte (djb2) d'un texte.
function empreinte(texte) {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = (Math.imul(h, 33) + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Repartition deterministe : l'indice vient de la graine du message, sans lien avec son texte.
function indiceDeterministe(graine, n) {
  return ((Math.imul(graine | 0, 2654435761) >>> 0) % n);
}

// Donne une image de la banque a chaque vue de demonstration qui n'en a pas encore. L'entree choisie est memorisee sur la vue (banqueId) :
// aux rechargements suivants on relit CETTE entree (image, legende, etat) au lieu de recalculer un indice, donc vignette, vue agrandie et
// Viewer lisent toujours la meme source. Retourne true si au moins une vue a change (le fil affiche doit alors etre redessine).
export function attribuerBanque(conversations, banque) {
  if (!banque.length) return false;
  banque = banque.slice(0, NOMBRE_VUES_MESSAGERIE);
  let change = false;
  const attribuer = (m) => {
    // Une capture propre (vue.image sans deBanque) n'est jamais remplacee.
    if (!m.vue || (m.vue.image && !m.vue.deBanque)) return;
    const vue = m.vue;
    const entree = banque.find((e) => e.id === vue.banqueId) || banque[indiceDeterministe(vue.seed, banque.length)];
    const image = (import.meta.env ? import.meta.env.BASE_URL : "/") + DOSSIER_VUES + entree.id + ".jpg?v=" + entree.version;
    if (vue.image !== image || vue.banqueId !== entree.id) change = true;
    vue.banqueId = entree.id;
    vue.image = image;
    vue.niveau = entree.niveau || vue.niveau;
    vue.modeles = entree.modeles || vue.modeles;
    vue.deBanque = true;
    vue.etat = entree.camera ? { camera: entree.camera, niveaux: entree.niveaux || [], maquettes: entree.maquettes || [], coupe: entree.coupe || null, entites: entree.entites || null } : null;
  };
  conversations.forEach((c) => {
    c.principal.messages.forEach(attribuer);
    c.sujets.forEach((s) => s.messages.forEach(attribuer));
  });
  return change;
}
