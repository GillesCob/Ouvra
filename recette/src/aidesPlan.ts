import type { Locator } from "playwright-core";
import { dormir } from "./aides.js";
import type { IPageSuivie } from "./types.js";

export const PLAN_SVG = "svg:has(polygon.p3d-mur)";
export const BOUTON_ANNULER = 'button[title="Annuler (Ctrl Z)"]';
export const BOUTON_RETABLIR = 'button[title="Rétablir (Ctrl Maj Z)"]';

/** Ouvre la page « 2D → 3D » et charge le plan d'exemple local (public/plan3d-local, ignore par git). Rend false si le lien n'existe pas (fichiers absents). */
export async function ouvrirPlanExemple(page: IPageSuivie): Promise<boolean> {
  const lien = page.locator("button.p3d-lien", { hasText: "plan d'exemple" });
  if (!(await lien.isVisible())) return false;
  await lien.click();
  await page.waitForSelector("polygon.p3d-mur", { timeout: 20_000 });
  await dormir(1200);
  return true;
}

/**
 * Clique un element du plan (mur, ouverture, piece) en un point ou il est reellement l'element du dessus : le centre de sa boite peut tomber hors d'une
 * piece en L ou sous un mur. Le point est cherche sur une grille avec `elementFromPoint`, comme le ferait un doigt ou une souris.
 */
export async function selectionner(page: IPageSuivie, id: string): Promise<void> {
  const point = await page.evaluate((cible) => {
    const el = document.querySelector<SVGGraphicsElement>(`polygon[data-id="${cible}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Le centre de la boite convient pour un mur droit ou une ouverture ; la grille ne sert que pour une piece en L ou un element partiellement recouvert.
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (document.elementFromPoint(cx, cy) === el) return { x: cx, y: cy };
    const N = 24;
    let meilleur: { x: number; y: number; marge: number } | null = null;
    for (let i = 1; i < N; i++) {
      for (let j = 1; j < N; j++) {
        const x = r.left + (r.width * i) / N;
        const y = r.top + (r.height * j) / N;
        if (document.elementFromPoint(x, y) !== el) continue;
        // marge : distance au bord de la boite des 4 voisins immediats, pour preferer un point franchement a l'interieur
        const voisins = [[4, 0], [-4, 0], [0, 4], [0, -4]].filter(([dx, dy]) => document.elementFromPoint(x + (dx ?? 0), y + (dy ?? 0)) === el).length;
        if (!meilleur || voisins > meilleur.marge) meilleur = { x, y, marge: voisins };
        if (voisins === 4) return { x, y };
      }
    }
    return meilleur ? { x: meilleur.x, y: meilleur.y } : null;
  }, id);
  if (!point) throw new Error(`Aucun point cliquable pour l'element ${id} (recouvert ou hors ecran).`);
  // Sur le contexte tactile (iPhone simule) un vrai toucher : les gestes de l'application different de ceux de la souris.
  const tactile = await page.evaluate(() => "ontouchstart" in window);
  if (tactile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await dormir(500);
}

export function panneau(page: IPageSuivie): Locator {
  return page.locator('[aria-label="Propriétés"]');
}

/** Champ numerique ou texte de la carte de proprietes, trouve par son libelle (« Longueur (cm) », « Nom de la pièce »...). */
export function champ(page: IPageSuivie, libelle: string): Locator {
  return panneau(page).locator("label.p3d-champ", { hasText: libelle }).locator("input, select");
}

export async function saisir(page: IPageSuivie, libelle: string, valeur: string): Promise<void> {
  const c = champ(page, libelle);
  await c.fill(valeur);
  await c.press("Enter");
  await dormir(500);
}

export async function titreCarte(page: IPageSuivie): Promise<string> {
  return (await panneau(page).locator(".p3d-carte-titre").first().textContent().catch(() => "")) ?? "";
}

export async function valeurChamp(page: IPageSuivie, libelle: string): Promise<string> {
  return champ(page, libelle).inputValue();
}

export async function pointsDe(page: IPageSuivie, id: string): Promise<string> {
  return (await page.locator(`polygon.p3d-mur[data-id="${id}"], polygon.p3d-ouv[data-id="${id}"], polygon.p3d-piece[data-id="${id}"]`).first().getAttribute("points")) ?? "";
}

export async function annuler(page: IPageSuivie): Promise<void> {
  await page.click(BOUTON_ANNULER);
  await dormir(500);
}

export async function retablir(page: IPageSuivie): Promise<void> {
  await page.click(BOUTON_RETABLIR);
  await dormir(500);
}

export async function viewBox(page: IPageSuivie): Promise<number[]> {
  const brut = (await page.locator("svg.p3d-svg").first().getAttribute("viewBox")) ?? "";
  return brut.split(/\s+/).map(Number);
}

/** Noms affiches sur le plan, EN MINUSCULES (l'etiquette SVG est ecrite en capitales par l'application : on compare sans la casse). Un nom peut etre coupe en plusieurs lignes (plusieurs `text.p3d-piece-nom` dans une meme etiquette) : on les rejoint. */
export async function nomsDePieces(page: IPageSuivie): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("g.p3d-piece-etiquette")].map((g) =>
      [...g.querySelectorAll("text.p3d-piece-nom")].map((t) => (t.textContent ?? "").trim()).join(" ").replace(/\s+/g, " ").toLowerCase()
    )
  );
}

export async function surfacesDePieces(page: IPageSuivie): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll("g.p3d-piece-etiquette")].map((g) => (g.querySelector("text.p3d-piece-surface")?.textContent ?? "").trim()));
}

export async function boutonVisible(page: IPageSuivie, libelle: string): Promise<boolean> {
  return page.locator("button.p3d-outil", { hasText: new RegExp(`^\\s*${libelle}\\s*$`) }).first().isVisible();
}

export const proche = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance;
export const nombreDe = (texte: string): number => parseFloat(texte.replace(",", "."));
