import { readFileSync } from "node:fs";

export interface IContenuPdf {
  pages: number;
  /** Largeur et hauteur de chaque page, en points (A4 = 595 x 842). */
  dimensions: number[][];
  texte: string;
  /** Nombre d'images incluses dans le fichier (logo). */
  images: number;
}

/** Relit un PDF telecharge : dimensions, texte extrait, images. Aucun rendu graphique, aucune capture. */
export async function lirePdf(chemin: string): Promise<IContenuPdf> {
  const octets = readFileSync(chemin);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), useSystemFonts: true, disableFontFace: true }).promise;
  let texte = "";
  const dimensions: number[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vue = page.getViewport({ scale: 1 });
    dimensions.push([Math.round(vue.width), Math.round(vue.height)]);
    const contenu = await page.getTextContent();
    texte += ` ${contenu.items.map((it) => ("str" in it ? it.str : "")).join(" ")}`;
  }
  const images = (octets.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
  return { pages: doc.numPages, dimensions, texte: texte.replace(/\s+/g, " ").trim(), images };
}

export const estA4Portrait = (dimensions: number[][]): boolean => dimensions.every((d) => Math.abs((d[0] ?? 0) - 595) <= 2 && Math.abs((d[1] ?? 0) - 842) <= 2);
