// Onglet du PDF du rapport (28/10) : le lecteur PDF natif du navigateur n'a pas d'icone d'onglet reglable. L'onglet ouvert au clic est donc une petite page
// d'Ouvra (meme origine, document ecrit dans la fenetre vide) qui porte le titre et le logo Ouvra (memes icones que index.html) et affiche le PDF en
// pleine fenetre dans un iframe, sans marge : le lecteur PDF du navigateur reste intact (telechargement, zoom, impression).

export const TITRE_ONGLET_PDF = "Rapport Ouvra";
const ICONES = [
  { rel: "icon", type: "image/svg+xml", chemin: "/favicon.svg" },
  { rel: "apple-touch-icon", type: null, chemin: "/icons/apple-touch-icon.png" }
];

// Titre et logo dans l'onglet, texte d'attente dans la page. origine : adresse d'Ouvra (les chemins d'icone sont absolus, de meme origine, valables en production).
export function preparerOngletPdf(onglet, { origine = globalThis.location ? globalThis.location.origin : "", texte = "Préparation du PDF…", titre = TITRE_ONGLET_PDF } = {}) {
  const doc = onglet.document;
  doc.title = titre; // paramétrable (28/10) : « Rapport Ouvra » par défaut, « Quantitatif Ouvra » pour le Quantitatif
  for (const i of ICONES) {
    const lien = doc.createElement("link");
    lien.rel = i.rel;
    if (i.type) lien.type = i.type;
    lien.href = origine + i.chemin;
    doc.head.appendChild(lien);
  }
  doc.body.textContent = texte;
}

// Remplace le texte d'attente par le PDF, plein ecran et sans marge.
export function afficherPdfDansOnglet(onglet, urlPdf) {
  const doc = onglet.document;
  doc.documentElement.style.cssText = "height:100%;margin:0";
  doc.body.style.cssText = "margin:0;height:100%;overflow:hidden";
  const cadre = doc.createElement("iframe");
  cadre.src = urlPdf;
  cadre.title = doc.title || TITRE_ONGLET_PDF;
  cadre.style.cssText = "display:block;border:0;width:100%;height:100%";
  doc.body.textContent = "";
  doc.body.appendChild(cadre);
}
