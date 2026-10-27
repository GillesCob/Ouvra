import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import { RACINE_OUVRA } from "../config.js";
import { dormir, erreursUtiles } from "../aides.js";
import { boutonVisible, nombreDe, panneau, viewBox } from "../aidesPlan.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

const IMAGE_PLAN = join(RACINE_OUVRA, "public", "plan3d-local", "plan-salome.jpg");

/** PDF de plan fabrique pour le test (aucun PDF reel n'existe dans le vault ni le depot) : N pages A4 avec un quadrillage. */
function fabriquerPdf(dossier: string, pages: number): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage();
    doc.setFontSize(14);
    doc.text(`Plan de test, page ${p + 1}`, 15, 20);
    for (let i = 20; i < 190; i += 20) doc.line(i, 30, i, 270);
    for (let j = 30; j < 280; j += 20) doc.line(15, j, 195, j);
  }
  const chemin = join(dossier, "plan-test.pdf");
  writeFileSync(chemin, Buffer.from(doc.output("arraybuffer")));
  return chemin;
}

async function pointsSurPlan(page: IPageSuivie): Promise<void> {
  const boite = await page.locator("svg.p3d-svg").first().boundingBox();
  if (!boite) throw new Error("Le plan SVG n'est pas affiche.");
  await page.mouse.click(boite.x + boite.width * 0.4, boite.y + boite.height * 0.3);
  await dormir(300);
  await page.mouse.click(boite.x + boite.width * 0.4, boite.y + boite.height * 0.6);
  await dormir(500);
}

/** Test 4 laptop : import d'une image puis d'un PDF (fabrique), calage de l'echelle. Les outils de trace (Mur, Piece) sont masques dans l'application. */
async function laptop(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  const page = await ctx.ouvrir("#plan3d");
  await dormir(1000);

  // R-82 : image importee.
  {
    await page.locator('#plan3dRoot input[type="file"]').setInputFiles(IMAGE_PLAN).catch((e: unknown) => {
      throw new Error(`Import de ${IMAGE_PLAN} impossible : ${String(e).split("\n")[0]}`);
    });
    await page.waitForSelector("svg.p3d-svg .p3d-fond", { timeout: 20_000 });
    await dormir(1200);
    const etat = await page.evaluate(() => ({
      opaciteFond: document.querySelector(".p3d-fond")?.getAttribute("opacity") ?? "",
      echelleActive: [...document.querySelectorAll<HTMLElement>("button.p3d-outil")].find((b) => /Échelle/.test(b.title || b.innerText))?.getAttribute("aria-pressed") ?? ""
    }));
    verif.controle("R-82 l'image est affichee a 35 %", Number(etat.opaciteFond) === 0.35, etat.opaciteFond);
    verif.controle("R-82 l'outil « Échelle » est deja actif", etat.echelleActive === "true", etat.echelleActive);
    verif.controle("R-82 « Voir en 3D » est grise tant qu'il n'y a pas de mur", await page.locator('button[aria-label="Voir la maquette 3D dans le Viewer"]').isDisabled());
  }

  // R-83 : echelle. Les deux points sont poses a des endroits arbitraires de l'image : on verifie la mecanique (carte, saisie, application, annulation), pas le mur 780,9 cm.
  {
    await pointsSurPlan(page);
    const note = (await panneau(page).locator(".p3d-note").first().textContent().catch(() => "")) ?? "";
    const titre = (await panneau(page).locator(".p3d-carte-titre").first().textContent().catch(() => "")) ?? "";
    verif.controle("R-83 la carte « Échelle du plan » annonce la distance actuelle", titre === "Échelle du plan" && /Distance actuelle entre les deux points : [\d.,]+ cm/.test(note), { titre, note });
    const avantApplication = await viewBox(page);

    await panneau(page).locator("label.p3d-champ", { hasText: "Distance réelle (cm)" }).locator("input").fill("781");
    await panneau(page).locator("button", { hasText: "Appliquer" }).click();
    await dormir(800);
    const mode = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("button.p3d-outil")].find((b) => /Sélection/.test(b.title || b.innerText))?.getAttribute("aria-pressed") ?? "");
    verif.controle("R-83 « Appliquer » active l'outil « Sélection » et recadre le plan", mode === "true" && (await viewBox(page)).join() !== avantApplication.join(), { mode });
    // L'encart du bas n'affiche plus de confirmation (seulement les erreurs, plan3dPage.js `dire`) : le message « Échelle appliquée » du plan de recette n'existe plus.
    verif.controle("R-83 aucune erreur affichee apres « Appliquer »", (await page.locator(".p3d-astuce-erreur:visible").count()) === 0);

    // « Annuler » ferme la carte sans changer l'echelle.
    await page.locator("button.p3d-outil", { hasText: "Échelle" }).first().click();
    await pointsSurPlan(page);
    const avantAnnuler = await viewBox(page);
    await panneau(page).locator("button", { hasText: /^\s*Annuler\s*$/ }).click();
    await dormir(500);
    verif.controle("R-83 « Annuler » ferme la carte sans changer la vue ni l'echelle", (await viewBox(page)).join() === avantAnnuler.join() && !(await panneau(page).isVisible()), { carteVisible: await panneau(page).isVisible() });
    void nombreDe;
  }

  // R-84 / R-85 / R-86 : trace de murs et de pieces, outils masques.
  {
    const dessin = await Promise.all(["Mur", "Pièce"].map((b) => boutonVisible(page, b)));
    if (dessin.some(Boolean)) verif.saute("R-84/R-85/R-86 trace", "les outils de dessin sont presents : la trace par clics n'est pas encore scriptee (a ecrire)");
    else verif.saute("R-84/R-85/R-86 trace de murs et de pieces", "outils Mur et Pièce retires par l'interrupteur MASQUE_DESSIN_PLAN (src/plan3d/plan3dPage.js, demande de Gilles du 27/10) : non joue");
  }

  // R-87 : import d'un PDF. PDF fabrique par le harnais (jsPDF) : on teste la mecanique multipage, pas un vrai plan d'architecte.
  {
    await page.reload();
    await dormir(1000);
    const pdf = fabriquerPdf(ctx.dossierTelechargements, 2);
    await page.locator('#plan3dRoot input[type="file"]').setInputFiles(pdf);
    await page.waitForSelector("svg.p3d-svg .p3d-fond", { timeout: 30_000 });
    await dormir(1500);
    const pages = await page.locator('select[aria-label="Page du PDF"]').evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).options.length));
    verif.controle("R-87 PDF a 2 pages : la premiere s'affiche en fond", (await page.locator(".p3d-fond").count()) === 1);
    verif.controle("R-87 la liste « Page du PDF » apparait pour un PDF de plusieurs pages", pages.length === 1 && pages[0] === 2, pages);
    await page.locator('select[aria-label="Page du PDF"]').selectOption({ index: 1 });
    await dormir(1500);
    verif.controle("R-87 changer de page garde un fond affiche", (await page.locator(".p3d-fond").count()) === 1);
  }

  verif.controle("console propre sur le parcours (aucune erreur de page, hors chargements de maquettes interrompus par un rechargement)", erreursUtiles(page).length === 0, erreursUtiles(page).slice(0, 3));
  await page.close();
}

export const test04: ITestDef = {
  numero: 4,
  nom: "2D -> 3D : import d'image et de PDF fabrique, calage de l'echelle (trace masque)",
  couvre: ["R-82", "R-83", "R-84", "R-85", "R-86", "R-87"],
  laptop
};
