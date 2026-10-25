// 2D -> 3D (25/10) : import d'un plan depuis un fichier (PNG, JPEG ou PDF). Rend toujours une IMAGE affichable en fond du plan :
//   { url, l, h, nom, pages } (l et h en pixels ; url = adresse locale du navigateur, le fichier ne quitte jamais l'ordinateur)
// Un PDF est rendu par pdf.js (charge a la demande : la bibliotheque n'est telechargee que si on importe un PDF), une seule page a la fois.

export const TAILLE_MAX_OCTETS = 40 * 1024 * 1024;
const LARGEUR_RENDU_PDF = 2400; // pixels : assez fin pour lire les cotes d'un plan A4 / A3 sans alourdir la page
const PIXELS_MAX_ORDINATEUR = 16e6;
const PIXELS_MAX_TELEPHONE = 6e6; // un canvas de plus de ~16 Mpx echoue sur iOS, et 6 Mpx (4 bytes chacun, 24 Mo) laisse de la marge a la page

// Largeur de rendu d'une page PDF (pixels) : 2400 au plus, reduite si la page (grande ou tres allongee) depasserait le nombre de pixels permis.
export function largeurRenduPdf(largeurPage, hauteurPage, { telephone = false, largeurMax = LARGEUR_RENDU_PDF } = {}) {
  if (!(largeurPage > 0) || !(hauteurPage > 0)) return largeurMax;
  const pixelsMax = telephone ? PIXELS_MAX_TELEPHONE : PIXELS_MAX_ORDINATEUR;
  const l = telephone ? Math.min(largeurMax, 1800) : largeurMax;
  const h = (l * hauteurPage) / largeurPage;
  return l * h > pixelsMax ? Math.floor(Math.sqrt((pixelsMax * largeurPage) / hauteurPage)) : l;
}

// « image » | « pdf » | null selon le type MIME, a defaut l'extension (certains navigateurs ne donnent pas de type).
export function typeFichier(fichier) {
  if (!fichier || typeof fichier.name !== "string") return null;
  const type = String(fichier.type || "").toLowerCase();
  const nom = fichier.name.toLowerCase();
  if (type === "application/pdf" || nom.endsWith(".pdf")) return "pdf";
  if (["image/png", "image/jpeg", "image/webp"].includes(type) || /\.(png|jpe?g|webp)$/.test(nom)) return "image";
  return null;
}

// Message d'erreur lisible, ou null si le fichier est acceptable.
export function verifierFichier(fichier) {
  if (typeFichier(fichier) === null) return "Format non pris en charge : choisis un PDF, un PNG ou un JPEG.";
  if (fichier.size > TAILLE_MAX_OCTETS) return "Fichier trop lourd (40 Mo maximum).";
  if (fichier.size === 0) return "Le fichier est vide.";
  return null;
}

function chargerImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = url;
  });
}

async function depuisImage(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(url);
    return { url, l: img.naturalWidth, h: img.naturalHeight, nom: fichier.name, pages: 1 };
  } catch (erreur) {
    URL.revokeObjectURL(url);
    throw erreur;
  }
}

async function depuisPdf(fichier, page) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: await fichier.arrayBuffer() }).promise;
  try {
    const numero = Math.min(Math.max(Math.round(page) || 1, 1), doc.numPages);
    const p = await doc.getPage(numero);
    const base = p.getViewport({ scale: 1 });
    const telephone = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const vue = p.getViewport({ scale: largeurRenduPdf(base.width, base.height, { telephone }) / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vue.width);
    canvas.height = Math.round(vue.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // un PDF est transparent par defaut : fond blanc, sinon le plan est illisible sur le fond sombre
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({ canvasContext: ctx, viewport: vue }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Rendu du PDF impossible.");
    return { url: URL.createObjectURL(blob), l: canvas.width, h: canvas.height, nom: fichier.name, pages: doc.numPages, page: numero };
  } finally {
    doc.destroy();
  }
}

// Lit le fichier. Rejette avec une Error au message lisible (format, taille, fichier abime, mot de passe).
export async function lireFichierPlan(fichier, { page = 1 } = {}) {
  const probleme = verifierFichier(fichier);
  if (probleme) throw new Error(probleme);
  try {
    return typeFichier(fichier) === "pdf" ? await depuisPdf(fichier, page) : await depuisImage(fichier);
  } catch (erreur) {
    if (erreur && erreur.name === "PasswordException") throw new Error("Ce PDF est protégé par un mot de passe.");
    throw new Error(erreur && erreur.message ? `Import impossible : ${erreur.message}` : "Import impossible.");
  }
}

export function libererFond(fond) {
  if (fond && fond.url && fond.url.startsWith("blob:")) URL.revokeObjectURL(fond.url);
}
