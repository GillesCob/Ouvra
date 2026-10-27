import { dormir, naviguer, visible, erreursUtiles } from "../aides.js";
import { annuler, nombreDe, ouvrirPlanExemple, proche, saisir, selectionner, valeurChamp } from "../aidesPlan.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

const BOUTON_VOIR_3D = 'button[aria-label="Voir la maquette 3D dans le Viewer"]';
const MODELE_PLAN = "plan2d3d";

interface IEtat3D {
  modeles: Record<string, { objets: number; visibles: number }>;
  projection: string;
}

interface IFenetre3D {
  viewer: {
    scene: { models: Record<string, { objects: Record<string, { visible: boolean }> }> };
    camera: { projection: string };
  };
}

async function etat3D(page: IPageSuivie): Promise<IEtat3D> {
  return page.evaluate(() => {
    const v = (window as unknown as IFenetre3D).viewer;
    const modeles: Record<string, { objets: number; visibles: number }> = {};
    for (const [id, m] of Object.entries(v.scene.models)) {
      const objets = Object.values(m.objects);
      modeles[id] = { objets: objets.length, visibles: objets.filter((o) => o.visible).length };
    }
    return { modeles, projection: v.camera.projection };
  });
}

async function voirEn3D(page: IPageSuivie): Promise<void> {
  await page.click(BOUTON_VOIR_3D);
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".view:not([hidden])")?.id === "view-viewer", null, { timeout: 60_000 });
  await page.waitForFunction(
    (id) => !!(window as unknown as IFenetre3D).viewer.scene.models[id] && Object.keys((window as unknown as IFenetre3D).viewer.scene.models[id]!.objects).length > 0,
    MODELE_PLAN,
    { timeout: 60_000 }
  );
  await dormir(1200);
}

async function retourPlan(page: IPageSuivie): Promise<void> {
  await page.locator("button", { hasText: "Retour au plan 2D" }).first().click();
  await dormir(1000);
}

/** Test 6 laptop : « Voir en 3D » (maquette du plan dans le Viewer), vue a plat, retour, coupe. Le rendu (noms au sol, cadrage, dalle) reste a Gilles. */
async function laptop(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  const page = await ctx.ouvrir("#plan3d");
  await dormir(1000);
  if (!(await ouvrirPlanExemple(page))) {
    verif.saute("Test 6 entier", "plan d'exemple absent (public/plan3d-local/, fichiers de tiers ignores par git)");
    await page.close();
    return;
  }

  // R-89 : raccourcir le mur M15 a 100 cm laisse la fenetre O2 dans son mur (pas de « Maquette impossible »).
  {
    await selectionner(page, "M15");
    await saisir(page, "Longueur (cm)", "100");
    await selectionner(page, "O2");
    const largeur = nombreDe(await valeurChamp(page, "Largeur (cm)"));
    const position = nombreDe(await valeurChamp(page, "Position (cm)"));
    verif.controle("R-89 la fenetre O2 reste dans son mur raccourci (largeur 38,8 cm, position 61,2 cm)", proche(largeur, 38.8, 0.1) && proche(position, 61.2, 0.1), { largeur, position });
    await annuler(page);
    const erreur = await page.locator(".p3d-astuce-erreur:visible").count();
    verif.controle("R-89 aucun message d'erreur « Maquette impossible »", erreur === 0, erreur);
  }

  // R-115 : Voir en 3D.
  {
    await voirEn3D(page);
    const e = await etat3D(page);
    const hopital = Object.entries(e.modeles).filter(([id]) => id !== MODELE_PLAN);
    verif.controle("R-115 la maquette du plan est chargee dans le Viewer", (e.modeles[MODELE_PLAN]?.objets ?? 0) > 0, e.modeles[MODELE_PLAN]);
    verif.controle("R-115 seule la maquette du plan est visible (l'hopital est masque)", hopital.every(([, m]) => m.visibles === 0) && (e.modeles[MODELE_PLAN]?.visibles ?? 0) > 0, e.modeles);
    verif.controle("R-115 bandeau « ← Retour au plan 2D » visible", await page.locator("button", { hasText: "Retour au plan 2D" }).first().isVisible());
    verif.controle("R-115 bouton « Vue à plat » present", await visible(page, "#vueDessusBtn"));
  }

  // R-116 / R-117 : vue a plat (orthographique), puis perspective et recentrage.
  {
    await page.click("#vueDessusBtn");
    await dormir(900);
    const plat = await etat3D(page);
    verif.controle("R-116 « Vue à plat » : projection orthographique", plat.projection === "ortho", plat.projection);
    verif.controle("R-116 le bouton devient « Perspective »", /Perspective/.test((await page.locator("#vueDessusBtn").innerText()).trim()), await page.locator("#vueDessusBtn").innerText());
    await page.click("#vueDessusBtn");
    await dormir(900);
    const persp = await etat3D(page);
    verif.controle("R-117 « Perspective » : retour a la projection en perspective", persp.projection === "perspective", persp.projection);
    await page.click("#recenterBtn");
    await dormir(600);
    verif.controle("R-117 « Recentrer » garde la maquette du plan visible", ((await etat3D(page)).modeles[MODELE_PLAN]?.visibles ?? 0) > 0);
  }

  // R-118 : coupe horizontale sur la maquette du plan.
  {
    await page.click("#coupeBtn");
    await page.click("#coupeChoixHoriz");
    await dormir(800);
    verif.controle("R-118 « Coupe horizontale » affiche le curseur de position", await visible(page, "#coupeSliderWrap"));
  }

  // R-121 : retour au plan 2D, plan conserve.
  {
    await page.goto(`${ctx.urlBase}#plan3d`);
    await page.reload();
    await dormir(1200);
    const ouvert = await ouvrirPlanExemple(page);
    verif.controle("R-121 (apres rechargement) le plan d'exemple se recharge", ouvert);
    await selectionner(page, "O10");
    await saisir(page, "Largeur (cm)", "180");
    await voirEn3D(page);
    await retourPlan(page);
    const apres = await page.evaluate(() => ({
      vue: document.querySelector<HTMLElement>(".view:not([hidden])")?.id ?? "",
      murs: document.querySelectorAll("polygon.p3d-mur").length
    }));
    verif.controle("R-121 « Retour au plan 2D » ramene le plan avec ses murs", apres.vue === "view-plan3d" && apres.murs > 0, apres);
    await selectionner(page, "M6");
    await selectionner(page, "O10");
    verif.controle("R-122 la modification (largeur 180) est conservee au retour", nombreDe(await valeurChamp(page, "Largeur (cm)")) === 180);
    await voirEn3D(page);
    verif.controle("R-122 la maquette est regeneree apres modification", ((await etat3D(page)).modeles[MODELE_PLAN]?.objets ?? 0) > 0);
  }

  // R-123 : quitter le Viewer retire la maquette du plan.
  {
    await naviguer(page, "collision");
    await dormir(800);
    await naviguer(page, "viewer");
    await dormir(2000);
    const e = await etat3D(page);
    verif.controle("R-123 la maquette du plan a disparu, l'hopital est de nouveau affiche", !e.modeles[MODELE_PLAN] && Object.values(e.modeles).some((m) => m.visibles > 0), e.modeles);
  }

  verif.controle("console propre sur le parcours (aucune erreur de page, hors chargements de maquettes interrompus par un rechargement)", erreursUtiles(page).length === 0, erreursUtiles(page).slice(0, 3));
  await page.close();
}

export const test06: ITestDef = {
  numero: 6,
  nom: "2D -> 3D : « Voir en 3D », vue a plat, retour, coupe (valeurs, sans rendu)",
  couvre: ["R-89", "R-115", "R-116", "R-117", "R-118", "R-121", "R-122", "R-123"],
  laptop
};
