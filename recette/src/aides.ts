import type { IPageSuivie } from "./types.js";

export const MODALE = ".regles-ia-fond-saisie:not([hidden])";

export const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Forme minimale de ce que le harnais lit dans `window.viewer` (xeokit), sans dependre du paquet. */
interface IObjetScene {
  visible: boolean;
  xrayed: boolean;
  highlighted: boolean;
  opacity: number;
}
interface IViewerOuvra {
  scene: { objects: Record<string, IObjetScene>; models: Record<string, { objects: Record<string, IObjetScene> }> };
  metaScene: { metaObjects: Record<string, { type?: string }> };
  camera: { eye: number[] };
}
interface IFenetreOuvra {
  viewer: IViewerOuvra;
}

/** Ouvre une page de la navbar. Sur mobile le lien est dans le menu hamburger. */
export async function naviguer(page: IPageSuivie, vue: string): Promise<void> {
  const lien = page.locator(`.nav-link[data-view="${vue}"]`);
  if (!(await lien.first().isVisible())) {
    await page.click("#navbarToggle");
    await dormir(300);
  }
  await lien.first().click();
  await dormir(600);
}

/** Attend la fin du chargement des maquettes (ecran de chargement masque) puis laisse la scene se stabiliser. */
export async function attendreMaquettes(page: IPageSuivie): Promise<void> {
  await page.waitForFunction(
    () => {
      const o = document.getElementById("loadingOverlay");
      return !o || o.classList.contains("hidden") || getComputedStyle(o).display === "none";
    },
    null,
    { timeout: 120_000 }
  );
  await dormir(2500);
}

export async function ouvrirSaisie(page: IPageSuivie, selecteurBouton: string): Promise<void> {
  await page.click(selecteurBouton);
  await page.waitForSelector(MODALE, { timeout: 5000 });
}

/** Envoie une phrase tapee dans la modale de saisie IA (meme chemin que « Envoyer par ecrit » du plan de recette). */
export async function envoyerPhrase(page: IPageSuivie, selecteurBouton: string, phrase: string, valider = true): Promise<void> {
  await ouvrirSaisie(page, selecteurBouton);
  await page.click(`${MODALE} >> text=Écrire ma demande`).catch(() => undefined);
  await page.fill(`${MODALE} textarea`, phrase);
  if (valider) await page.click(`${MODALE} >> button:text-is("Valider")`);
}

/** Lance une « phrase toute faite » du menu « Proposition d'instruction » (reconnue sans IA par l'application). */
export async function lancerPhraseExemple(page: IPageSuivie, selecteurBouton: string, phrase: string): Promise<void> {
  await ouvrirSaisie(page, selecteurBouton);
  await page.click(`${MODALE} >> text=Écrire ma demande`).catch(() => undefined);
  await page.click(`${MODALE} summary`);
  await page.click(`${MODALE} >> button.regles-ia-exemple:text-is(${JSON.stringify(phrase)})`);
  await page.click(`${MODALE} >> button:text-is("Valider")`);
}

export async function texteModale(page: IPageSuivie): Promise<string> {
  return page.evaluate((s) => document.querySelector<HTMLElement>(s)?.innerText ?? "", MODALE);
}

export interface IEtatScene {
  total: number;
  visibles: number;
  xray: number;
  surbrillance: number;
}

export async function etatScene(page: IPageSuivie): Promise<IEtatScene> {
  return page.evaluate(() => {
    const objets = (window as unknown as IFenetreOuvra).viewer.scene.objects;
    const ids = Object.keys(objets);
    let visibles = 0;
    let xray = 0;
    let surbrillance = 0;
    for (const id of ids) {
      const o = objets[id];
      if (!o) continue;
      if (o.visible) visibles++;
      if (o.xrayed) xray++;
      if (o.highlighted) surbrillance++;
    }
    return { total: ids.length, visibles, xray, surbrillance };
  });
}

export interface IStatsType {
  n: number;
  visibles: number;
  surbrillance: number;
  opacite: number;
}

export async function statsParType(page: IPageSuivie): Promise<Record<string, IStatsType>> {
  return page.evaluate(() => {
    const v = (window as unknown as IFenetreOuvra).viewer;
    const sortie: Record<string, { n: number; visibles: number; surbrillance: number; somme: number }> = {};
    for (const id of Object.keys(v.scene.objects)) {
      const o = v.scene.objects[id];
      if (!o) continue;
      const type = v.metaScene.metaObjects[id]?.type ?? "?";
      const e = (sortie[type] ??= { n: 0, visibles: 0, surbrillance: 0, somme: 0 });
      e.n++;
      if (o.visible) e.visibles++;
      if (o.highlighted) e.surbrillance++;
      e.somme += o.opacity;
    }
    const rendu: Record<string, { n: number; visibles: number; surbrillance: number; opacite: number }> = {};
    for (const [type, e] of Object.entries(sortie)) {
      rendu[type] = { n: e.n, visibles: e.visibles, surbrillance: e.surbrillance, opacite: Number((e.somme / e.n).toFixed(2)) };
    }
    return rendu;
  });
}

/** Cases des listes « Niveaux » et « Maquettes » du tiroir « Afficher », sous la forme « Nom:1 » (cochee) ou « Nom:0 ». */
export async function casesDrawer(page: IPageSuivie): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#niveauxList li, #maquettesList li")]
      .map((l) => `${l.innerText.trim().split("\n")[0] ?? ""}:${l.querySelector("input")?.checked ? 1 : 0}`)
      .join(" | ")
  );
}

export async function visible(page: IPageSuivie, selecteur: string): Promise<boolean> {
  return page.evaluate((s) => {
    const e = document.querySelector<HTMLElement>(s);
    if (!e || e.hidden) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden";
  }, selecteur);
}

export interface IRect {
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
  largeur: number;
  hauteur: number;
}

export async function rect(page: IPageSuivie, selecteur: string): Promise<IRect | null> {
  return page.evaluate((s) => {
    const e = document.querySelector<HTMLElement>(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom, largeur: r.width, hauteur: r.height };
  }, selecteur);
}

export function seChevauchent(a: IRect, b: IRect): boolean {
  return a.gauche < b.droite && a.droite > b.gauche && a.haut < b.bas && a.bas > b.haut;
}

/** Vue affichee (identifiant du `.view` non masque). */
export async function vueCourante(page: IPageSuivie): Promise<string> {
  return page.evaluate(() => document.querySelector<HTMLElement>(".view:not([hidden])")?.id ?? "");
}

/**
 * Erreurs de page et de console a prendre au serieux. On ecarte seulement « getXKT error : null » de xeokit : il est journalise quand un rechargement ou un
 * changement de page interrompt le chargement d'une maquette (annulation de la requete), ce que fait le harnais en rechargeant la page entre deux etapes.
 */
export function erreursUtiles(page: IPageSuivie): string[] {
  return page.erreursPage.filter((e) => !/getXKT error : null/.test(e));
}
