// Pieces communes aux exports PDF d'Ouvra (Quantitatif, recapitulatif de Discussions). Pur, sans DOM sauf chargerLogo (fetch + btoa).
// Police : Helvetica standard du PDF, encodage WinAnsi (accents francais corrects). Aucun caractere hors de cet encodage ne doit etre emis :
// tout texte venu d'un message ou du modele passe par sansSpecial.

export const VERT = [92, 122, 95]; // --accent d'Ouvra

// Variante MOBILE (28/10) : page etroite 105 x 186 mm (9:16), affichee en pleine largeur sur un telephone (390 px pour 105 mm : corps de 10 pt ~13 px).
export const PAGE_MOBILE = [105, 186];
// Mobile : l'onglet navigue VERS le PDF (lecteur natif d'iOS : toutes les pages, zoom), car un PDF dans un iframe n'affiche que sa premiere page sur iOS Safari.
export const afficherPdfPleinOnglet = (onglet, url) => onglet.location.replace(url);

// Caracteres WinAnsi hors Latin-1 (0x80 a 0x9F de Windows-1252) : euro, guillemets, tirets, puce, œ, etc.
const WINANSI_EXTRA = "\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178";
const dansWinAnsi = (c) => {
  const code = c.codePointAt(0);
  return code === 9 || code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WINANSI_EXTRA.includes(c);
};

// Remplacements lisibles avant le filet « ? » : espaces speciaux, apostrophes et guillemets typographiques, points de suspension, tirets, fleches.
const REMPLACEMENTS = [[/[\u00a0\u202f\u200b]/g, " "], [/[\u2018\u2019]/g, "'"], [/[\u201c\u201d]/g, "\""], [/\u2026/g, "..."], [/[\u2013\u2014]/g, "-"], [/\u2192/g, "->"], [/\u2190/g, "<-"], [/\u2022/g, "-"], [/\r/g, ""]];

// Texte sur de pour le PDF : normalise, remplace le typographique, puis tout caractere hors WinAnsi (emoji, symbole) devient « ? ».
export function sansSpecial(texte) {
  let t = String(texte == null ? "" : texte).normalize("NFC");
  for (const [motif, remplacement] of REMPLACEMENTS) t = t.replace(motif, remplacement);
  return Array.from(t).map((c) => (dansWinAnsi(c) ? c : "?")).join("");
}

// Vrai si le texte contient un caractere que Helvetica standard ne sait pas ecrire.
export const horsWinAnsi = (texte) => Array.from(String(texte)).some((c) => !dansWinAnsi(c));

// Logo PNG en data URL (public/icons/icon-192.png), ou null : sans logo le PDF reste valide.
export async function chargerLogo(fetchFn) {
  try {
    const reponse = await fetchFn("/icons/icon-192.png");
    if (!reponse.ok) return null;
    const octets = new Uint8Array(await reponse.arrayBuffer());
    let binaire = "";
    octets.forEach((o) => { binaire += String.fromCharCode(o); });
    return "data:image/png;base64," + btoa(binaire);
  } catch {
    return null;
  }
}
