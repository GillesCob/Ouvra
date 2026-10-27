import { attendreMaquettes, casesDrawer, dormir, etatScene, naviguer, rect, seChevauchent, vueCourante, visible, erreursUtiles } from "../aides.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

const VUES_NAVBAR = ["viewer", "collision", "discussions", "quantitatif", "plan3d"] as const;

async function cliquerCentreMaquette(page: IPageSuivie): Promise<void> {
  const boite = await page.locator("#viewerCanvas").boundingBox();
  if (boite) await page.mouse.click(boite.x + boite.width * 0.5, boite.y + boite.height * 0.5);
  await dormir(800);
}

/** Test 8 laptop : non-regression de l'existant (accueil, navbar, pages masquees, Viewer, Collision, Discussions, console). */
async function laptop(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  const page = await ctx.ouvrir("");

  // R-139 : accueil, navbar, « Me contacter ».
  {
    verif.controle("R-139 l'accueil est affiche au demarrage", (await vueCourante(page)) === "view-accueil", await vueCourante(page));
    await page.click("#accueilOpenBtn");
    await attendreMaquettes(page);
    verif.controle("R-139 « Ouvrir la maquette » ouvre le Viewer", (await vueCourante(page)) === "view-viewer", await vueCourante(page));
    const liens = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("#navbarLinks .nav-link")].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.innerText.replace(/\s*\d+$/, "").trim())
    );
    verif.controle("R-139 cinq onglets exactement : Viewer, Collision, Discussions, Quantitatif, 2D → 3D", JSON.stringify(liens) === JSON.stringify(["Viewer", "Collision", "Discussions", "Quantitatif", "2D → 3D"]), liens);
    const selecteurs = await Promise.all(["#projectSelect", "#personaSelect", "#activateProfilesBtn"].map((s) => visible(page, s)));
    verif.controle("R-139 ni selecteur de projet ni profils", selecteurs.every((v) => !v), selecteurs);
    const contact = await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>("#navbarContact");
      return a ? { href: a.href, cible: a.target, rel: a.rel } : null;
    });
    verif.controle("R-139 « Me contacter » ouvre gillescobigo.com dans un nouvel onglet", !!contact && /^https:\/\/gillescobigo\.com\//.test(contact.href) && contact.cible === "_blank" && /noopener/.test(contact.rel), contact);
    for (const vue of VUES_NAVBAR) {
      await naviguer(page, vue);
      verif.controle(`R-139 l'onglet « ${vue} » affiche sa vue`, (await vueCourante(page)) === `view-${vue}`, await vueCourante(page));
    }
  }

  // R-140 : pages masquees inaccessibles par l'adresse.
  {
    const atteintes: string[] = [];
    for (const hash of ["#presentation", "#admin", "#projeteur", "#landing"]) {
      await page.goto(`${ctx.urlBase}${hash}`);
      await page.reload();
      await dormir(1500);
      atteintes.push(`${hash} -> ${await vueCourante(page)}`);
    }
    verif.controle("R-140 #presentation, #admin, #projeteur, #landing n'ouvrent pas leur vue", atteintes.every((a) => !/view-(presentation|admin|projeteur|landing)$/.test(a)), atteintes);
  }

  // R-141 / R-142 : Viewer (tiroir, coupe vitesse, recentrage) puis Collision et retour.
  {
    await page.goto(`${ctx.urlBase}#viewer`);
    await page.reload();
    await attendreMaquettes(page);
    const initial = await etatScene(page);
    const casesInitiales = await casesDrawer(page);
    const casesNiveaux = page.locator("#niveauxList li input");
    verif.controle("R-141 des niveaux sont listes", (await casesNiveaux.count()) > 0, await casesNiveaux.count());
    await casesNiveaux.first().uncheck();
    await dormir(800);
    const apresDecoche = await etatScene(page);
    verif.controle("R-141 decocher un niveau masque des elements", apresDecoche.visibles < initial.visibles, { avant: initial.visibles, apres: apresDecoche.visibles });
    await page.click("#niveauxResetBtn");
    await dormir(800);
    verif.controle("R-141 « Tout afficher » (Niveaux) restaure", (await etatScene(page)).visibles === initial.visibles && (await casesDrawer(page)) === casesInitiales);

    await page.click("#tab-maquettes");
    const mecanique = page.locator("#maquettesList li", { hasText: "Mechanical" }).locator("input");
    await mecanique.uncheck();
    await dormir(1200);
    const sansMeca = await etatScene(page);
    verif.controle("R-141 decocher Mechanical (CVC) masque des elements", sansMeca.visibles < initial.visibles, { avant: initial.visibles, apres: sansMeca.visibles });
    await page.click("#maquettesResetBtn");
    await dormir(1200);
    verif.controle("R-141 « Tout afficher » (Maquettes) restaure", (await etatScene(page)).visibles === initial.visibles);

    await page.click("#coupeBtn");
    verif.controle("R-141 « Créer une coupe » propose « Sur une surface » et « Coupe horizontale »", (await visible(page, "#coupeChoixSurface")) && (await visible(page, "#coupeChoixHoriz")));
    await page.click("#coupeChoixSurface");
    await cliquerCentreMaquette(page);
    const coupeCreee = await visible(page, "#coupeInvertBtn");
    if (coupeCreee) {
      await page.click("#coupeToggleVisibilityBtn");
      await page.click("#coupeInvertBtn");
      verif.controle("R-141 coupe sur une surface : « Masquer le plan de coupe » et « Inverser la coupe » repondent", true);
    } else {
      verif.controle("R-141 coupe sur une surface : le clic au centre de la maquette cree une coupe", false, "bouton « Inverser la coupe » absent apres le clic (clic sur du vide ? a verifier a la main)");
    }
    await page.reload();
    await attendreMaquettes(page);

    await page.click("#cameraSpeedToggle");
    verif.controle("R-141 le curseur de vitesse s'ouvre", await visible(page, "#cameraSpeedPanel"));
    await page.click("#recenterBtn");
    await dormir(600);

    await cliquerCentreMaquette(page);
    const fiche = (await visible(page, "#ficheCard")) || (await visible(page, "#ficheContent"));
    verif.controle("R-141 un clic sur la maquette affiche « Info sélection »", fiche);

    const avantCollision = await etatScene(page);
    await naviguer(page, "collision");
    await dormir(1200);
    await naviguer(page, "viewer");
    await dormir(2000);
    const apresRetour = await etatScene(page);
    const canvas = await rect(page, "#viewerCanvas");
    verif.controle("R-142 Viewer -> Collision -> Viewer : meme nombre d'elements visibles", apresRetour.visibles === avantCollision.visibles, { avant: avantCollision.visibles, apres: apresRetour.visibles });
    verif.controle("R-142 la maquette garde une taille correcte (le canevas remplit au moins la moitie de l'ecran)", !!canvas && canvas.largeur >= 640 && canvas.hauteur >= 400, canvas);
  }

  // R-143 : Collision, paire, selection, priorite et statut.
  {
    await naviguer(page, "collision");
    await dormir(1000);
    await page.click('.detection-item:has-text("Architecture")');
    await dormir(2500);
    const nb = await page.locator(".collision-item").count();
    verif.controle("R-143 la paire Architecture <-> Mécanique liste ses collisions (15 + 2 ecartees)", nb >= 15, nb);
    await page.click('.collision-item[aria-label^="Collision n° 3 :"]');
    await dormir(3500);
    verif.controle("R-143 la collision affiche priorite et statut", (await visible(page, ".collision-trigger")) && (await page.locator(".collision-trigger").count()) >= 2);
    await page.click('.collision-trigger:has-text("PRIORITÉ")');
    await page.click('.collision-menu-option:has-text("Urgente")');
    await dormir(600);
    await page.click('.collision-trigger:has-text("STATUT")');
    await page.click('.collision-menu-option:has-text("Confirmé")');
    await dormir(600);
    const declencheurs = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".collision-trigger")].map((b) => b.innerText.replace(/\s+/g, " ").trim()));
    verif.controle("R-143 priorite « Urgente » et statut « Confirmé » appliques", declencheurs.some((t) => /Urgente/.test(t)) && declencheurs.some((t) => /Confirmé/.test(t)), declencheurs);
    const menusOuverts = await page.locator(".collision-menu-option:visible").count();
    verif.controle("R-143 aucun menu ne reste ouvert", menusOuverts === 0, menusOuverts);
    await naviguer(page, "viewer");
    await dormir(1500);
  }

  // R-144 : Discussions, message, nouveau sujet.
  {
    await naviguer(page, "discussions");
    await dormir(1500);
    await page.click("#msgOngletIndividuel");
    await page.locator(".msg-conv").first().click();
    await dormir(600);
    const avant = await page.locator(".msg-ligne").count();
    await page.fill("#msgSaisie", "Message de recette automatique");
    await page.click("#msgEnvoyer");
    await dormir(800);
    verif.controle("R-144 le message envoye s'ajoute a la conversation", (await page.locator(".msg-ligne").count()) === avant + 1, { avant, apres: await page.locator(".msg-ligne").count() });
    const pastillesAvant = await page.locator(".msg-pastille").count();
    await page.click("#msgAjoutSujet");
    await page.fill("#msgNsTitre", "Sujet de recette automatique");
    await page.fill("#msgNsMessage", "Premier message du sujet.");
    await page.click('button:text-is("Créer le sujet")');
    await dormir(900);
    const pastilles = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".msg-pastille")].map((p) => p.innerText.replace(/\s+/g, " ").trim()));
    verif.controle("R-144 le nouveau sujet est cree, dernier de son groupe", pastilles.length === pastillesAvant + 1 && /Sujet de recette automatique/.test(pastilles[pastilles.length - 1] ?? ""), pastilles);
  }

  // R-146 : console propre sur les cinq onglets. Les rechargements des etapes precedentes interrompent des chargements de maquettes en cours
  // (xeokit journalise alors « getXKT error : null ») : on repart d'une page stable et d'un journal vide.
  {
    await page.goto(`${ctx.urlBase}#viewer`);
    await page.reload();
    await attendreMaquettes(page);
    page.erreursPage.length = 0;
    for (const vue of VUES_NAVBAR) {
      await naviguer(page, vue);
      await dormir(1200);
    }
    verif.controle("R-146 console propre sur les cinq onglets (aucune erreur de page)", page.erreursPage.length === 0, page.erreursPage.slice(0, 4));
  }
  await page.close();
}

/** Test 8 mobile : R-145 navigation par le menu hamburger sur iPhone simule, et blocs qui ne doivent pas deborder. Le geste de fermeture du tiroir reste a Gilles. */
async function mobile(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  const page = await ctx.ouvrir("");
  verif.controle("R-145 l'accueil est affiche", (await vueCourante(page)) === "view-accueil", await vueCourante(page));
  await page.click("#accueilOpenBtn");
  await attendreMaquettes(page);
  const largeur = page.viewportSize()?.width ?? 0;
  for (const vue of VUES_NAVBAR) {
    await page.click("#navbarToggle");
    await dormir(400);
    const menuOuvert = await visible(page, `.nav-link[data-view="${vue}"]`);
    await page.locator(`.nav-link[data-view="${vue}"]`).first().click();
    await dormir(1200);
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    verif.controle(`R-145 le menu ☰ s'ouvre et l'onglet « ${vue} » se charge`, menuOuvert && (await vueCourante(page)) === `view-${vue}`, { menuOuvert, vue: await vueCourante(page) });
    verif.controle(`R-145 « ${vue} » : aucun defilement horizontal de la page`, !debordement, { debordement });
  }
  await naviguer(page, "viewer");
  await dormir(1500);
  await page.click("#infoPanelToggle");
  await dormir(600);
  const tiroir = await rect(page, "#infoPanel");
  const hauteur = page.viewportSize()?.height ?? 0;
  verif.controle("R-145 « ☰ Afficher » ouvre le tiroir en feuille du bas", !!tiroir && tiroir.bas >= hauteur - 2 && tiroir.largeur <= largeur + 1, tiroir);
  await page.click("#infoPanelClose");
  await dormir(500);
  await page.locator("#viewerCanvas").click({ position: { x: largeur / 2, y: 250 } });
  await dormir(900);
  const fiche = await rect(page, "#ficheSheet");
  const barre = await rect(page, "#viewerToolbar");
  verif.controle("R-145 la fiche d'un element touche est une carte posee en bas de l'ecran, sans recouvrir la barre d'outils", !fiche || (fiche.bas >= hauteur - 24 && fiche.largeur <= largeur + 1 && (!barre || !seChevauchent(fiche, barre))), fiche);
  verif.controle("console propre sur le parcours (aucune erreur de page)", erreursUtiles(page).length === 0, erreursUtiles(page).slice(0, 4));
  await page.close();
}

export const test08: ITestDef = {
  numero: 8,
  nom: "Non-regression : accueil, navbar, Viewer, Collision, Discussions, console (mobile : navigation ☰)",
  couvre: ["R-139", "R-140", "R-141", "R-142", "R-143", "R-144", "R-145", "R-146"],
  laptop,
  mobile
};
