import { dormir, rect, seChevauchent, visible, erreursUtiles } from "../aides.js";
import { nombreDe, ouvrirPlanExemple, selectionner, valeurChamp, viewBox } from "../aidesPlan.js";
import { simulateurPlan } from "../mocksApi.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

const BOUTON_VOIR_3D = 'button[aria-label="Voir la maquette 3D dans le Viewer"]';

async function taillesChamps(page: IPageSuivie): Promise<Array<{ police: number; hauteur: number; liste: boolean }>> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[aria-label="Propriétés"] input:not([type=hidden]), [aria-label="Propriétés"] select')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => ({ police: parseFloat(getComputedStyle(e).fontSize), hauteur: Math.round(e.getBoundingClientRect().height), liste: e.tagName === "SELECT" }))
  );
}

/** Le CSS impose-t-il `min-height: 44px` aux listes deroulantes sous `@media (pointer: coarse)` ? L'emulation WebKit de Playwright n'active pas cette media query : on lit la regle. */
async function regleTactileDesListes(page: IPageSuivie): Promise<{ coarseActif: boolean; regle: boolean }> {
  return page.evaluate(() => {
    let regle = false;
    for (const feuille of [...document.styleSheets]) {
      let regles: CSSRuleList;
      try {
        regles = feuille.cssRules;
      } catch {
        continue;
      }
      for (const r of [...regles]) {
        if (r instanceof CSSMediaRule && /pointer:\s*coarse/.test(r.conditionText)) {
          for (const sr of [...r.cssRules]) {
            if (sr instanceof CSSStyleRule && /\.p3d-select/.test(sr.selectorText) && sr.style.minHeight === "44px") regle = true;
          }
        }
      }
    }
    return { coarseActif: matchMedia("(pointer: coarse)").matches, regle };
  });
}

/** Test 10 mobile : 2D -> 3D sur iPhone simule (mises en page mesurees). Zoom au pincement, clavier iOS, doigt reel : restent a Gilles. */
async function mobile(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  ctx.simulerApi("/api/plan", simulateurPlan);
  const page = await ctx.ouvrir("#plan3d");
  await dormir(1000);
  const largeur = page.viewportSize()?.width ?? 0;
  const hauteur = page.viewportSize()?.height ?? 0;

  // R-125 : carte de depart et exemple.
  {
    const boutons = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#plan3dRoot button")].filter((b) => b.getBoundingClientRect().width > 0).map((b) => ({ texte: b.innerText.trim(), hauteur: Math.round(b.getBoundingClientRect().height) })));
    verif.controle("R-125 la carte de depart a deux boutons", boutons.length === 2, boutons);
    if (!(await ouvrirPlanExemple(page))) {
      verif.saute("Test 10 suite", "plan d'exemple absent (public/plan3d-local/, fichiers de tiers ignores par git)");
      await page.close();
      return;
    }
    const barre = await rect(page, ".p3d-outils");
    verif.controle("R-125 la barre d'outils reste dans l'ecran", !!barre && barre.gauche >= -0.5 && barre.droite <= largeur + 0.5, barre);
    verif.controle("R-125 la page ne deborde pas horizontalement", !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
    verif.controle("R-125 la barre d'outils tient sur au plus deux lignes (hauteur < 130 px)", !!barre && barre.hauteur < 130, barre?.hauteur);
  }

  // R-127 : cartes de proprietes posees en bas d'ecran, champs de 16 px, cibles de 44 px.
  {
    await selectionner(page, "M6");
    const carte = await rect(page, '[aria-label="Propriétés"]');
    const champs = await taillesChamps(page);
    verif.controle("R-127 la carte est posee en bas de l'ecran sans le recouvrir en entier", !!carte && carte.bas >= hauteur - 24 && carte.hauteur <= hauteur * 0.6, carte);
    verif.controle("R-127 champs a 16 px minimum (pas de zoom automatique d'iOS)", champs.length > 0 && champs.every((c) => c.police >= 16), champs);
    const tactile = await regleTactileDesListes(page);
    // Les listes deroulantes (« Type » du mur) ne mesurent 44 px que sous @media (pointer: coarse), que l'emulation WebKit n'active pas (coarseActif=false) :
    // on mesure les champs de saisie et on verifie la regle CSS des listes au lieu de la mesure.
    verif.controle("R-127 champs de saisie de 44 px de haut minimum", champs.filter((c) => !c.liste).every((c) => c.hauteur >= 44), champs);
    verif.controle("R-127 listes deroulantes : 44 px mesures, ou regle @media (pointer: coarse) { min-height: 44px } presente dans le CSS", champs.filter((c) => c.liste).every((c) => c.hauteur >= 44) || tactile.regle, { champs: champs.filter((c) => c.liste), ...tactile });
    verif.controle("R-127 la longueur du mur M6 se lit (780,9 cm)", proche780(nombreDe(await valeurChamp(page, "Longueur (cm)"))));
  }

  // R-128 : volets au-dessus de la carte, un seul a la fois.
  {
    await page.click('button[title="Vitesse du zoom"]');
    await dormir(300);
    const vitesse = await rect(page, ".p3d-vitesse:not([hidden])");
    const carte = await rect(page, '[aria-label="Propriétés"]');
    verif.controle("R-128 le volet « Vitesse du zoom » ne recouvre pas la carte", !vitesse || !carte || !seChevauchent(vitesse, carte), { vitesse, carte });
    await page.click('button[title="Visibilité des plans"]');
    await dormir(300);
    const ouverts = await page.locator(".p3d-vitesse:visible").count();
    verif.controle("R-128 un seul volet est ouvert a la fois", ouverts <= 1, ouverts);
    await page.click('button[title="Visibilité des plans"]');
    await dormir(200);
  }

  // R-132 : pastille des outils sous l'outil actif.
  {
    const outils = page.locator("button.p3d-outil-mode");
    const n = await outils.count();
    if (n > 0) {
      await outils.nth(n - 1).click();
      await dormir(500);
      const geometrie = await page.evaluate(() => {
        const actif = document.querySelector<HTMLElement>("button.p3d-outil-mode[aria-pressed='true']");
        const pastille = document.querySelector<HTMLElement>(".p3d-outils-thumb");
        if (!actif || !pastille) return null;
        const a = actif.getBoundingClientRect();
        const p = pastille.getBoundingClientRect();
        return { ecartCentres: Math.abs(a.left + a.width / 2 - (p.left + p.width / 2)), actif: a.width };
      });
      verif.controle("R-132 la pastille est centree sous l'outil choisi", !!geometrie && geometrie.ecartCentres <= 6, geometrie);
    }
  }

  // R-114 : IA du plan sur iPhone, bandeau en largeur et cibles de 44 px.
  {
    await page.click("#plan3dIABtn");
    await page.waitForSelector(".regles-ia-fond-saisie:not([hidden])");
    await page.click(".regles-ia-fond-saisie:not([hidden]) >> text=Écrire ma demande").catch(() => undefined);
    await page.fill(".regles-ia-fond-saisie:not([hidden]) textarea", "La fenêtre à l'ouest de la salle de bain fait 60 cm de large");
    await page.click('.regles-ia-fond-saisie:not([hidden]) >> button:text-is("Valider")');
    await dormir(1500);
    const g = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(".p3d-bandeau");
      if (!b || b.hidden) return null;
      const r = b.getBoundingClientRect();
      const boutons = [...b.querySelectorAll<HTMLElement>("button")].map((x) => ({ texte: x.innerText.trim(), hauteur: Math.round(x.getBoundingClientRect().height) }));
      return { gauche: r.left, droite: r.right, bas: r.bottom, boutons };
    });
    verif.controle("R-114 le bandeau « Est-ce bien votre demande ? » apparait", !!g);
    if (g) {
      verif.controle("R-114 le bandeau tient dans la largeur de l'ecran", g.gauche >= -0.5 && g.droite <= largeur + 0.5, g);
      verif.controle("R-114 « Oui » et « Non » font 44 px de haut", g.boutons.length === 2 && g.boutons.every((b) => b.hauteur >= 44), g.boutons);
      await page.click('.p3d-bandeau button:text-is("Non")');
      await dormir(600);
      await page.keyboard.press("Escape");
    }
  }

  // R-133 : Voir en 3D sur iPhone, vue a plat sur la meme ligne que Recentrer et Nouvelle discussion.
  {
    await page.click(BOUTON_VOIR_3D);
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".view:not([hidden])")?.id === "view-viewer", null, { timeout: 60_000 });
    await dormir(2500);
    const ligne = await page.evaluate(() => ["vueDessusBtn", "recenterBtn", "newDiscussionBtn"].map((id) => {
      const r = document.getElementById(id)?.getBoundingClientRect();
      return r ? { id, haut: Math.round(r.top), droite: Math.round(r.right), largeur: Math.round(r.width) } : null;
    }));
    const memeLigne = ligne.every((l) => l !== null) && new Set(ligne.map((l) => Math.round((l?.haut ?? 0) / 6))).size === 1;
    verif.controle("R-133 « Vue à plat », « Recentrer » et « Nouvelle discussion » tiennent sur la meme ligne, dans l'ecran", memeLigne && ligne.every((l) => (l?.droite ?? 9999) <= largeur + 1), ligne);
    await page.click("#vueDessusBtn");
    await dormir(800);
    verif.controle("R-133 « Vue à plat » : projection orthographique", (await page.evaluate(() => (window as unknown as { viewer: { camera: { projection: string } } }).viewer.camera.projection)) === "ortho");
    verif.controle("R-133 le bandeau « Retour au plan 2D » est visible", await visible(page, "button.p3d-retour, #view-viewer .p3d-retour") || (await page.locator("button", { hasText: "Retour au plan 2D" }).first().isVisible()));
    await page.locator("button", { hasText: "Retour au plan 2D" }).first().click();
    await dormir(1000);
    verif.controle("R-133 le retour ramene le plan 2D", (await viewBox(page)).length === 4);
  }

  verif.controle("console propre sur le parcours (aucune erreur de page, hors chargements de maquettes interrompus par un rechargement)", erreursUtiles(page).length === 0, erreursUtiles(page).slice(0, 3));
  await page.close();
}

const proche780 = (v: number): boolean => Math.abs(v - 780.9) <= 0.1;

export const test10: ITestDef = {
  numero: 10,
  nom: "iPhone : 2D -> 3D (mises en page mesurees ; pincement, clavier, doigt reel non couverts)",
  couvre: ["R-114", "R-125", "R-127", "R-128", "R-132", "R-133"],
  mobile
};
