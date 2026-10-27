import { dormir, erreursUtiles } from "../aides.js";
import {
  PLAN_SVG,
  annuler,
  boutonVisible,
  champ,
  nombreDe,
  nomsDePieces,
  ouvrirPlanExemple,
  panneau,
  pointsDe,
  proche,
  retablir,
  saisir,
  selectionner,
  surfacesDePieces,
  titreCarte,
  valeurChamp,
  viewBox,
  BOUTON_ANNULER,
  BOUTON_RETABLIR
} from "../aidesPlan.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

/** Pieces, noms et surfaces attendus du plan d'exemple (Projets/Ouvra/recette-2026-10-27-condensee.md, Test 3, etape 2). Le plan est un fichier local de tiers. */
const PIECES_ATTENDUES: Array<[string, string]> = [
  ["Salle de bain", "5,5 m²"],
  ["Salle d'eau", "2,2 m²"],
  ["Chambre 1", "11,8 m²"],
  ["Chambre 2", "14,6 m²"],
  ["Chambre 3", "10,9 m²"],
  ["WC", "1,5 m²"],
  ["Salon/Salle à manger", "63,5 m²"]
];

const IDENTIFIANTS_PIECES = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"];

async function nomDePiece(page: IPageSuivie, id: string): Promise<string> {
  await selectionner(page, id);
  return valeurChamp(page, "Nom de la pièce");
}

/** Test 3 laptop : plan d'exemple, cartes de proprietes, edition et annulation (valeurs, pas rendu). Le rendu a l'oeil reste a Gilles. */
async function laptop(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  const page = await ctx.ouvrir("#plan3d");
  await dormir(1000);

  // R-65 : carte de depart.
  {
    const boutons = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#plan3dRoot button")].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.innerText.trim()));
    verif.controle("R-65 la carte de depart ne propose que « Importer un plan » et « Essayer avec un plan d'exemple »", boutons.length === 2 && boutons.some((b) => /Importer un plan/.test(b)) && boutons.some((b) => /plan d'exemple/.test(b)), boutons);
  }
  if (!(await ouvrirPlanExemple(page))) {
    verif.saute("Test 3 entier", "le lien « Essayer avec un plan d'exemple » est absent : public/plan3d-local/plan-salome.json et .jpg manquent (fichiers de tiers, ignores par git)");
    await page.close();
    return;
  }

  // R-66 : plan charge, 7 pieces avec nom et surface.
  {
    const noms = await nomsDePieces(page);
    const surfaces = await surfacesDePieces(page);
    const lues = noms.map((n, i) => [n.toLowerCase(), surfaces[i] ?? ""] as const);
    const ok = PIECES_ATTENDUES.every(([nom, surface]) => lues.some(([n, s]) => n.replace(/\s+/g, " ") === nom.toLowerCase() && s.replace(/\s/g, "") === surface.replace(/\s/g, "")));
    verif.controle("R-66 les 7 pieces ont leur nom et leur surface", ok && noms.length === 7, lues);
    const barre = ["Sélection", "Échelle", "IA"];
    const presentes = await Promise.all(barre.map((b) => boutonVisible(page, b)));
    verif.controle("R-66 barre d'outils : Sélection, Échelle, IA presents", presentes.every(Boolean), presentes);
    verif.controle("R-66 « Voir en 3D » est actif", await page.locator('button[aria-label="Voir la maquette 3D dans le Viewer"]').isEnabled());
    // Outils de dessin masques depuis le 27/10 (MASQUE_DESSIN_PLAN, demande de Gilles) : le plan de recette les decrit encore.
    const dessin = await Promise.all(["Mur", "Porte", "Fenêtre", "Coulissante", "Pièce"].map((b) => boutonVisible(page, b)));
    if (dessin.some(Boolean)) verif.controle("R-66 outils de dessin presents", dessin.every(Boolean), dessin);
    else verif.saute("R-66/R-75/R-84/R-85/R-86 outils de dessin (Mur, Porte, Fenêtre, Coulissante, Pièce)", "retires de la barre d'outils par l'interrupteur MASQUE_DESSIN_PLAN de src/plan3d/plan3dPage.js (demande de Gilles du 27/10) : tests de tracé non joues");
  }

  // R-67 : zoom, dezoom maximal, recadrage.
  {
    const initial = await viewBox(page);
    const boite = await page.locator('polygon[data-id="P7"]').boundingBox();
    if (boite) await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
    await page.mouse.wheel(0, -400);
    await dormir(500);
    const zoome = await viewBox(page);
    await page.mouse.wheel(0, 4000);
    await dormir(500);
    const dezoomMax = await viewBox(page);
    await page.mouse.wheel(0, -400);
    await dormir(400);
    await page.click('button[title="Recadrer le plan"]');
    await dormir(500);
    const recadre = await viewBox(page);
    verif.controle("R-67 la molette vers l'avant zoome", (zoome[2] ?? 0) < (initial[2] ?? 0), { initial: initial[2], zoome: zoome[2] });
    verif.controle("R-67 le dezoom s'arrete a la vue d'arrivee", proche(dezoomMax[2] ?? 0, initial[2] ?? 0, 0.01), { initial: initial[2], dezoomMax: dezoomMax[2] });
    verif.controle("R-67 « Recadrer le plan » ramene exactement la vue d'arrivee", recadre.every((v, i) => proche(v, initial[i] ?? NaN, 0.01)), { initial, recadre });
  }

  // R-68 : vitesse du zoom (50 %, 150 %, persistance).
  {
    await page.click('button[title="Vitesse du zoom"]');
    const defaut = await page.locator('input[aria-label="Vitesse du zoom"]').inputValue();
    await page.locator('input[aria-label="Vitesse du zoom"]').fill("150");
    await page.locator('input[aria-label="Vitesse du zoom"]').dispatchEvent("input");
    await page.locator('input[aria-label="Vitesse du zoom"]').dispatchEvent("change");
    await dormir(300);
    const stocke = await page.evaluate(() => localStorage.getItem("ouvra-plan3d-vitesse-zoom"));
    verif.controle("R-68 vitesse du zoom : 50 % par defaut", defaut === "50", defaut);
    verif.controle("R-68 la valeur 150 % est gardee dans le navigateur", stocke === "150", stocke);
    await page.keyboard.press("Escape");
    await page.evaluate(() => localStorage.setItem("ouvra-plan3d-vitesse-zoom", "50"));
  }

  // R-69 : visibilite des plans (curseurs de l'oeil).
  {
    await page.click('button[title="Visibilité des plans"]');
    await dormir(300);
    const fond = page.locator('input[aria-label="Visibilité du plan de base"]');
    const maquette = page.locator('input[aria-label="Visibilité du plan redessiné"]');
    await fond.fill("0");
    await fond.dispatchEvent("input");
    await maquette.fill("0");
    await maquette.dispatchEvent("input");
    await dormir(400);
    const rendu = await page.evaluate(() => ({
      fond: document.querySelector(".p3d-fond")?.getAttribute("opacity") ?? "(absent)",
      maquette: document.querySelector(".p3d-maquette")?.getAttribute("opacity") ?? "(absent)"
    }));
    verif.controle("R-69 plan de base a 0 : opacite nulle", Number(rendu.fond) === 0 || rendu.fond === "(absent)", rendu.fond);
    verif.controle("R-69 plan redessine a 0 : opacite nulle", Number(rendu.maquette) === 0 || rendu.maquette === "(absent)", rendu.maquette);
    await fond.fill("35");
    await fond.dispatchEvent("input");
    await maquette.fill("100");
    await maquette.dispatchEvent("input");
    await page.keyboard.press("Escape");
    await dormir(300);
  }

  // R-90 : valeur refusee (-5) -> l'ancienne valeur revient, aucun pas d'historique vide (l'icone annuler reste grisee sur un plan neuf).
  {
    await selectionner(page, "M6");
    await champ(page, "Épaisseur (cm)").fill("-5");
    await champ(page, "Épaisseur (cm)").press("Enter");
    await dormir(500);
    verif.controle("R-90 l'epaisseur -5 est refusee : le champ revient a 30", nombreDe(await valeurChamp(page, "Épaisseur (cm)")) === 30, await valeurChamp(page, "Épaisseur (cm)"));
    verif.controle("R-90 aucun pas d'historique cree (annuler reste grise)", await page.locator(BOUTON_ANNULER).isDisabled());
  }

  // R-73 : la cote d'un mur selectionne est cliquable et met le curseur dans « Longueur (cm) ».
  {
    await selectionner(page, "M6");
    const cote = page.locator('[data-kind="cote"]').first();
    if ((await cote.count()) === 0) {
      verif.controle("R-73 une cote cliquable est dessinee pour le mur selectionne", false, "aucun element [data-kind=cote]");
    } else {
      await cote.click({ force: true });
      await dormir(400);
      const actif = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset["champ"] ?? "");
      verif.controle("R-73 cliquer la cote place le curseur dans « Longueur (cm) »", actif === "longueur", actif);
    }
  }

  // R-70 / R-71 / R-72 : mur M6, epaisseur, longueur, annulation.
  {
    await selectionner(page, "M6");
    const titre = await titreCarte(page);
    const longueur = await valeurChamp(page, "Longueur (cm)");
    const epaisseur = await valeurChamp(page, "Épaisseur (cm)");
    verif.controle("R-70 carte « Mur M6 »", titre === "Mur M6", titre);
    verif.controle("R-70 longueur 780,9 cm et epaisseur 30 cm", proche(nombreDe(longueur), 780.9, 0.1) && nombreDe(epaisseur) === 30, { longueur, epaisseur });
    verif.controle("R-70 type « Extérieur »", (await champ(page, "Type").inputValue()) === "exterieur");

    const avant = await pointsDe(page, "M6");
    await saisir(page, "Épaisseur (cm)", "25");
    const apres = await pointsDe(page, "M6");
    await annuler(page);
    verif.controle("R-71 l'epaisseur 25 change la geometrie du mur", apres !== avant);
    verif.controle("R-71 un seul clic sur annuler remet 30", nombreDe(await valeurChamp(page, "Épaisseur (cm)")) === 30 && (await pointsDe(page, "M6")) === avant, await valeurChamp(page, "Épaisseur (cm)"));

    await saisir(page, "Longueur (cm)", "700");
    const longueurApres = nombreDe(await valeurChamp(page, "Longueur (cm)"));
    const geometrieChangee = (await pointsDe(page, "M6")) !== avant;
    await annuler(page);
    verif.controle("R-72 longueur 700 appliquee et geometrie modifiee", longueurApres === 700 && geometrieChangee, { longueurApres, geometrieChangee });
    verif.controle("R-72 annuler remet 780,9", proche(nombreDe(await valeurChamp(page, "Longueur (cm)")), 780.9, 0.1) && (await pointsDe(page, "M6")) === avant);
  }

  // R-74 : ouverture O10, largeur 180 puis annulation.
  {
    await selectionner(page, "O10");
    const titre = await titreCarte(page);
    const champs = { largeur: await valeurChamp(page, "Largeur (cm)"), hauteur: await valeurChamp(page, "Hauteur (cm)"), allege: await valeurChamp(page, "Allège (cm)"), position: await valeurChamp(page, "Position (cm)") };
    verif.controle("R-74 carte « Fenêtre O10 » : 197,2 x 125, allege 95, position 136,8", titre === "Fenêtre O10" && proche(nombreDe(champs.largeur), 197.2, 0.1) && nombreDe(champs.hauteur) === 125 && nombreDe(champs.allege) === 95 && proche(nombreDe(champs.position), 136.8, 0.1), { titre, champs });
    const avant = await pointsDe(page, "O10");
    await saisir(page, "Largeur (cm)", "180");
    const apres = await pointsDe(page, "O10");
    const largeurAffichee = await valeurChamp(page, "Largeur (cm)");
    verif.controle("R-74 largeur 180 : la geometrie de l'ouverture se reduit", apres !== avant, { avant: avant.slice(0, 70), apres: apres.slice(0, 70) });
    // Observe le 27/10 : juste apres la saisie + Entree le champ affiche encore l'ancienne largeur (197.2) alors que la geometrie est a 180 ; la valeur
    // est bonne a la resélection. A confirmer a la main : si la carte reste perimee pour un humain aussi, c'est un defaut d'affichage.
    verif.controle("R-74 le champ « Largeur (cm) » affiche 180 juste apres la saisie", nombreDe(largeurAffichee) === 180, largeurAffichee);
    await selectionner(page, "M2");
    await selectionner(page, "O10");
    verif.controle("R-74 la largeur 180 est bien enregistree (champ relu a la reselection)", nombreDe(await valeurChamp(page, "Largeur (cm)")) === 180);
    await annuler(page);
  }

  // R-76 : suppression d'une ouverture a la touche Suppr, puis annulation.
  {
    await selectionner(page, "O10");
    await page.keyboard.press("Delete");
    await dormir(500);
    const apresSuppr = await page.locator('polygon.p3d-ouv[data-id="O10"]').count();
    await annuler(page);
    const apresAnnuler = await page.locator('polygon.p3d-ouv[data-id="O10"]').count();
    verif.controle("R-76 la touche Suppr retire l'ouverture selectionnee", apresSuppr === 0, apresSuppr);
    verif.controle("R-76 annuler la remet", apresAnnuler === 1, apresAnnuler);
  }

  // R-77 / R-79 : piece, surface calculee, renommage avec numerotation des doublons.
  {
    await selectionner(page, "P7");
    const note = (await panneau(page).locator(".p3d-note").first().textContent()) ?? "";
    verif.controle("R-77 carte « Pièce » : surface lue 63,5 et surface calculee 63,49 m²", (await titreCarte(page)) === "Pièce" && proche(nombreDe(await valeurChamp(page, "Surface lue sur le plan (m²)")), 63.5, 0.01) && /63,49 m²/.test(note), note);
    let wc: string | null = null;
    for (const id of IDENTIFIANTS_PIECES) {
      if ((await nomDePiece(page, id)) === "WC") wc = id;
    }
    verif.controle("R-79 la piece « WC » existe", wc !== null, wc);
    if (wc) {
      await selectionner(page, wc);
      await saisir(page, "Nom de la pièce", "Salle de bain");
      const noms = await nomsDePieces(page);
      verif.controle("R-79 les doublons sont numerotes (« Salle de bain 1 » et « Salle de bain 2 »)", noms.includes("salle de bain 1") && noms.includes("salle de bain 2"), noms);
      await annuler(page);
      verif.controle("R-79 annuler restitue « WC »", (await nomsDePieces(page)).includes("wc"));
    }
  }

  // R-80 : informations libres d'un element.
  {
    await selectionner(page, "M6");
    await panneau(page).locator('input[aria-label="Nom de l\'information"]').fill("Matériau");
    await panneau(page).locator('input[aria-label="Valeur de l\'information"]').fill("Béton");
    await panneau(page).locator("form.p3d-info-ajout button[type=submit]").click();
    await dormir(400);
    await selectionner(page, "M2");
    await selectionner(page, "M6");
    const texte = (await panneau(page).innerText()).replace(/\s+/g, " ");
    verif.controle("R-80 l'information « Matériau / Béton » reste a la resélection", /Matériau/.test(texte) && /Béton/.test(await panneau(page).locator("input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).join("|"))), texte.slice(0, 200));
    await annuler(page);
  }

  // R-88 : trois modifications, trois annulations, trois retablissements.
  {
    await selectionner(page, "M6");
    const origine = { epaisseur: await valeurChamp(page, "Épaisseur (cm)"), points: await pointsDe(page, "M6") };
    await saisir(page, "Épaisseur (cm)", "22");
    await selectionner(page, "O10");
    await saisir(page, "Largeur (cm)", "170");
    const pieceCible = (await nomsDePieces(page)).includes("wc") ? "WC" : null;
    verif.controle("R-88 une piece « WC » est disponible pour la 3e modification", pieceCible !== null);
    for (const id of IDENTIFIANTS_PIECES) {
      if ((await nomDePiece(page, id)) === "WC") {
        await saisir(page, "Nom de la pièce", "Cabinet");
        break;
      }
    }
    for (let i = 0; i < 3; i++) await annuler(page);
    await selectionner(page, "M6");
    verif.controle("R-88 trois annulations restituent l'etat d'origine", (await valeurChamp(page, "Épaisseur (cm)")) === origine.epaisseur && (await pointsDe(page, "M6")) === origine.points && (await nomsDePieces(page)).includes("wc"));
    verif.controle("R-88 icone annuler grisee quand il n'y a plus rien a annuler", await page.locator(BOUTON_ANNULER).isDisabled());
    for (let i = 0; i < 3; i++) await retablir(page);
    verif.controle("R-88 trois retablissements rejouent les modifications", (await nomsDePieces(page)).includes("cabinet") && (await page.locator(BOUTON_RETABLIR).isDisabled()));
  }

  verif.controle("console propre sur le parcours (aucune erreur de page, hors chargements de maquettes interrompus par un rechargement)", erreursUtiles(page).length === 0, erreursUtiles(page).slice(0, 3));
  void PLAN_SVG;
  await page.close();
}

export const test03: ITestDef = {
  numero: 3,
  nom: "2D -> 3D : plan d'exemple, proprietes et edition (valeurs, sans rendu)",
  couvre: ["R-65", "R-66", "R-67", "R-68", "R-69", "R-70", "R-71", "R-72", "R-73", "R-74", "R-76", "R-77", "R-79", "R-80", "R-88", "R-90"],
  laptop
};
