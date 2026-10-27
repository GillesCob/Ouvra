import {
  attendreMaquettes,
  casesDrawer,
  dormir,
  envoyerPhrase,
  etatScene,
  lancerPhraseExemple,
  naviguer,
  rect,
  seChevauchent,
  statsParType,
  texteModale,
  visible
} from "../aides.js";
import { simulateurCommandeViewer } from "../mocksApi.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

const BOUTON_IA = "#commandesIABtn";

async function attendreBandeau(page: IPageSuivie): Promise<string> {
  await page.waitForSelector("#commandesBandeau:not([hidden])", { timeout: 8000 });
  return (await page.textContent("#commandesBandeauTexte")) ?? "";
}

async function repondre(page: IPageSuivie, reponse: "oui" | "non"): Promise<void> {
  await page.click(`#commandesBandeau [data-act="${reponse}"]`);
  await dormir(reponse === "oui" ? 300 : 400);
}

async function ouvrirViewer(ctx: IContexteTest): Promise<IPageSuivie> {
  const page = await ctx.ouvrir("#viewer");
  await attendreMaquettes(page);
  return page;
}

/** Test 7 laptop : R-31 a R-37 (R-34 inclus). Toute reponse du modele est simulee. */
async function laptop(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  ctx.simulerApi("/api/commande", simulateurCommandeViewer);

  // R-31 : mise en evidence, transparence, masquage, empilement.
  {
    const page = await ouvrirViewer(ctx);
    await lancerPhraseExemple(page, BOUTON_IA, "Mets en évidence les faux plafonds du niveau 1");
    await attendreBandeau(page);
    const t1 = await statsParType(page);
    const matiere = await page.evaluate(() => {
      const w = window as unknown as { viewer: { scene: { highlightMaterial: { fillAlpha: number } } } };
      return w.viewer.scene.highlightMaterial.fillAlpha;
    });
    await repondre(page, "oui");
    await lancerPhraseExemple(page, BOUTON_IA, "Rends les murs transparents");
    await attendreBandeau(page);
    const t2 = await statsParType(page);
    await repondre(page, "oui");
    await lancerPhraseExemple(page, BOUTON_IA, "Masque les faux plafonds et le mobilier");
    await attendreBandeau(page);
    const t3 = await statsParType(page);
    await repondre(page, "oui");
    await lancerPhraseExemple(page, BOUTON_IA, "Masque la structure");
    await attendreBandeau(page);
    const t4 = await statsParType(page);
    await repondre(page, "oui");
    const structureVisible = await page.evaluate(() => {
      const w = window as unknown as { viewer: { scene: { models: Record<string, { objects: Record<string, { visible: boolean }> }> } } };
      const m = w.viewer.scene.models["hosp-struct"];
      return m ? Object.values(m.objects).filter((o) => o.visible).length : -1;
    });
    verif.controle("R-31 surbrillance des faux plafonds du niveau 1", (t1["IfcCovering"]?.surbrillance ?? 0) > 0, { objets: t1["IfcCovering"]?.surbrillance, fillAlpha: matiere });
    verif.controle("R-31 murs transparents (opacite moyenne <= 0,35)", (t2["IfcWallStandardCase"]?.opacite ?? 1) <= 0.35, t2["IfcWallStandardCase"]?.opacite);
    verif.controle("R-31 faux plafonds et mobilier masques", (t3["IfcCovering"]?.visibles ?? 1) === 0 && (t3["IfcFurniture"]?.visibles ?? 0) === 0, {
      fauxPlafonds: t3["IfcCovering"]?.visibles,
      mobilier: t3["IfcFurniture"]?.visibles
    });
    verif.controle("R-31 structure masquee", structureVisible === 0, structureVisible);
    verif.controle("R-31 les murs restent transparents apres la 4e phrase (empilement)", (t4["IfcWallStandardCase"]?.opacite ?? 1) <= 0.35, t4["IfcWallStandardCase"]?.opacite);
    await page.close();
  }

  // R-32 : focus sur un element, phrase reconnue sans appel IA.
  {
    const page = await ouvrirViewer(ctx);
    const avant = ctx.appelsApi.length;
    await lancerPhraseExemple(page, BOUTON_IA, "Montre-moi la vanne 1165462");
    const relecture = await attendreBandeau(page);
    const repartition = await page.evaluate(() => {
      const w = window as unknown as { viewer: { scene: { objects: Record<string, { visible: boolean; xrayed: boolean; opacity: number }> } } };
      let plein = 0;
      let fantome = 0;
      for (const o of Object.values(w.viewer.scene.objects)) {
        if (!o.visible) continue;
        if (o.xrayed) fantome++;
        else if (o.opacity >= 0.99) plein++;
      }
      return { plein, fantome };
    });
    verif.controle("R-32 aucun appel IA (phrase toute faite)", ctx.appelsApi.length === avant, ctx.appelsApi.length - avant);
    verif.controle("R-32 relecture citant la vanne", /1165462/.test(relecture), relecture.trim());
    verif.controle("R-32 au moins un element plein", repartition.plein >= 1, repartition);
    await page.close();
  }

  // R-33 : contexte de maquette, cases du tiroir synchronisees.
  {
    const page = await ouvrirViewer(ctx);
    await page.click("#tab-maquettes");
    await lancerPhraseExemple(page, BOUTON_IA, "Affiche les gaines du niveau 2 avec la structure en contexte");
    const relecture = await attendreBandeau(page);
    await dormir(300);
    const cases = await casesDrawer(page);
    verif.controle("R-33 relecture avec la maquette Structure en contexte", /avec la maquette Structure en contexte/.test(relecture), relecture.trim());
    verif.controle("R-33 niveau 2 seul coche", /Level 2:1/.test(cases) && /Level 1:0/.test(cases), cases);
    await page.close();
  }

  // R-34 : zone nommee (creation, commande, persistance). Le bouton « Zone » est masque dans l'application depuis le 27/10 (MASQUE_ZONES, demande de Gilles).
  {
    const page = await ouvrirViewer(ctx);
    if (!(await visible(page, "#commandesZoneBtn"))) {
      verif.saute("R-34 zone nommee", "bouton « Zone » masque dans l'application (interrupteur MASQUE_ZONES de src/main.js, demande de Gilles du 27/10) : test non joue");
    } else {
      await page.click("#commandesZoneBtn");
      await dormir(300);
      await page.fill('#commandesZonesFond input[aria-label="Nom de la zone"]', "Bloc opératoire");
      await page.click("#commandesZonesFond >> text=Cliquer dans la maquette");
      await dormir(300);
      const boite = await page.locator("#viewerCanvas").boundingBox();
      if (boite) await page.mouse.click(boite.x + boite.width * 0.5, boite.y + boite.height * 0.55);
      await dormir(800);
      const liste = (await page.textContent("#commandesZonesFond .commandes-zones-liste")) ?? "";
      await page.click("#commandesZonesFond >> text=Fermer").catch(() => undefined);
      await envoyerPhrase(page, BOUTON_IA, "Affiche la zone Bloc opératoire");
      const relecture = await attendreBandeau(page).catch(async () => `pas de bandeau : ${await texteModale(page)}`);
      await page.reload();
      await dormir(500);
      const cleZone = await page.evaluate(() => Object.keys(localStorage).filter((k) => /zone/i.test(k)));
      verif.controle("R-34 la zone apparait dans la liste", /Bloc op/.test(liste), liste.trim());
      verif.controle("R-34 la commande affiche la zone", /Bloc op/.test(relecture), relecture.trim());
      verif.controle("R-34 la zone est gardee apres rechargement", cleZone.length > 0, cleZone);
    }
    await page.close();
  }

  // R-35 : phrases libres (reponses simulees, duree non representative).
  {
    const page = await ouvrirViewer(ctx);
    await envoyerPhrase(page, BOUTON_IA, "Montre-moi seulement les tuyaux du niveau 4");
    const r1 = await attendreBandeau(page);
    await repondre(page, "oui");
    await envoyerPhrase(page, BOUTON_IA, "Affiche les gaines et les vannes du niveau 3");
    const r2 = await attendreBandeau(page);
    await repondre(page, "oui");
    verif.controle("R-35 relecture 1 : tuyaux du niveau 4", /tuyaux/.test(r1) && /niveau 4/.test(r1), r1.trim());
    verif.controle("R-35 relecture 2 : gaines et vannes du niveau 3", /gaines/.test(r2) && /vannes/.test(r2) && /niveau 3/.test(r2), r2.trim());
    await page.close();
  }

  // R-36 : refus et ambigu, rien d'applique, aucun bandeau.
  {
    const page = await ouvrirViewer(ctx);
    const avant = await etatScene(page);
    const sorties: Array<{ message: string; bandeau: boolean }> = [];
    for (const phrase of ["Fais pivoter la maquette de 90 degrés", "Affiche les ascenseurs", "Montre-moi le truc rouge"]) {
      await envoyerPhrase(page, BOUTON_IA, phrase);
      await dormir(900);
      const message = (await texteModale(page)).replace(/\s+/g, " ").slice(0, 160);
      sorties.push({ message, bandeau: await visible(page, "#commandesBandeau") });
      await page.keyboard.press("Escape");
      await dormir(300);
    }
    const apres = await etatScene(page);
    verif.controle("R-36 aucun bandeau quand rien n'est applique", sorties.every((s) => !s.bandeau), sorties);
    verif.controle("R-36 un refus est affiche pour chaque phrase", sorties.every((s) => s.message.length > 0), sorties.map((s) => s.message));
    verif.controle("R-36 « Critère introuvable. » pour les ascenseurs", /Critère introuvable/.test(sorties[1]?.message ?? ""), sorties[1]?.message);
    verif.controle("R-36 vue inchangee", avant.visibles === apres.visibles, { avant: avant.visibles, apres: apres.visibles });
    // Le motif ne doit apparaitre qu'une fois. Attention : la premiere passe du 27/10 (passe-propre 20) l'avait vu en double parce que SON simulateur
    // repetait « Critère introuvable. » dans le message du relais ; le simulateur de ce harnais n'ajoute pas ce prefixe (le client le met lui-meme).
    const doublon = /Critère introuvable\.\s*Critère introuvable\./.test(sorties[1]?.message ?? "");
    verif.controle("R-36 « Critère introuvable. » n'est pas repete deux fois", !doublon, sorties[1]?.message);
    await page.close();
  }

  // R-37 : quitter le Viewer annule la commande en attente.
  {
    const page = await ouvrirViewer(ctx);
    const avant = await etatScene(page);
    const casesAvant = await casesDrawer(page);
    await lancerPhraseExemple(page, BOUTON_IA, "Affiche le niveau 3 seul");
    await attendreBandeau(page);
    await naviguer(page, "collision");
    await dormir(500);
    await naviguer(page, "viewer");
    await dormir(1500);
    const apres = await etatScene(page);
    const casesApres = await casesDrawer(page);
    verif.controle("R-37 bandeau ferme", !(await visible(page, "#commandesBandeau")));
    verif.controle("R-37 toute la maquette de nouveau visible", apres.visibles === avant.visibles, { avant: avant.visibles, apres: apres.visibles });
    verif.controle("R-37 cases du tiroir d'origine", casesApres === casesAvant, casesApres);
    await page.close();
  }
}

/** Test 7 mobile : R-38 (bandeau, cibles tactiles de 44 px, tiroir en feuille du bas, annulation par « Non »). Le geste reel reste a Gilles. */
async function mobile(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  ctx.simulerApi("/api/commande", simulateurCommandeViewer);
  const page = await ouvrirViewer(ctx);
  await lancerPhraseExemple(page, BOUTON_IA, "Affiche le niveau 3 seul");
  await attendreBandeau(page);
  const bandeau = await rect(page, "#commandesBandeau");
  const oui = await rect(page, '#commandesBandeau [data-act="oui"]');
  const non = await rect(page, '#commandesBandeau [data-act="non"]');
  const barre = await rect(page, "#viewerToolbar");
  const largeurEcran = page.viewportSize()?.width ?? 0;
  verif.controle("R-38 le bandeau tient dans la largeur de l'ecran", !!bandeau && bandeau.gauche >= 0 && bandeau.droite <= largeurEcran + 0.5, bandeau);
  verif.controle("R-38 « Oui » et « Non » de 44 px de haut", (oui?.hauteur ?? 0) >= 43.5 && (non?.hauteur ?? 0) >= 43.5, { oui: oui?.hauteur, non: non?.hauteur });
  verif.controle("R-38 le bandeau ne recouvre pas la barre d'outils", !!bandeau && !!barre && !seChevauchent(bandeau, barre), { bandeau, barre });
  await repondre(page, "oui");
  await page.click("#infoPanelToggle");
  await dormir(600);
  const tiroir = await rect(page, "#infoPanel");
  const hauteurEcran = page.viewportSize()?.height ?? 0;
  const cases = await casesDrawer(page);
  verif.controle("R-38 le tiroir est une feuille du bas (colle au bas de l'ecran)", !!tiroir && tiroir.bas >= hauteurEcran - 2 && tiroir.haut > 0, tiroir);
  verif.controle("R-38 les cases suivent la commande (niveau 3 seul)", /Level 3:1/.test(cases) && /Level 1:0/.test(cases), cases);
  await page.click("#infoPanelClose").catch(() => undefined);
  await dormir(400);
  await lancerPhraseExemple(page, BOUTON_IA, "Montre-moi uniquement les vannes");
  await attendreBandeau(page);
  const avantNon = await etatScene(page);
  await repondre(page, "non");
  const apresNon = await etatScene(page);
  verif.controle("R-38 « Non » annule (plus d'elements visibles)", apresNon.visibles > avantNon.visibles, { avant: avantNon.visibles, apres: apresNon.visibles });
  await page.close();
}

export const test07: ITestDef = {
  numero: 7,
  nom: "Viewer par commande IA (relectures, cases, annulation)",
  couvre: ["R-31", "R-32", "R-33", "R-34", "R-35", "R-36", "R-37", "R-38"],
  laptop,
  mobile
};
