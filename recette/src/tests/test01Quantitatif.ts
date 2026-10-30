import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { estA4Portrait, lirePdf } from "../fichiers.js";
import { attendreMaquettes, dormir, envoyerPhrase, lancerPhraseExemple, naviguer, rect, seChevauchent, texteModale, etatScene, erreursUtiles } from "../aides.js";
import { simulateurQuantitatif } from "../mocksApi.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

const BOUTON_IA = "#quantitatifIABtn";
const OUI = '#quantitatifBandeau button:text-is("Oui")';
const NON = '#quantitatifBandeau button:text-is("Non")';

interface ITableau {
  entetes: string[];
  lignes: string[][];
  pied: string[][];
  /** Texte de chaque cellule `.qt-valeur` du corps, et celui du pied (null sans regroupement). */
  valeurs: string[];
  valeurTotal: string | null;
}

async function lireTableau(page: IPageSuivie): Promise<ITableau | null> {
  return page.evaluate(() => {
    const t = document.querySelector(".qt-tableau");
    if (!t) return null;
    const texte = (el: Element): string => (el as HTMLElement).innerText.trim();
    const rangees = (sel: string): string[][] => [...t.querySelectorAll(sel)].map((r) => [...r.children].map(texte));
    return {
      entetes: [...t.querySelectorAll("thead th")].map(texte),
      lignes: rangees("tbody tr"),
      pied: rangees("tfoot tr"),
      valeurs: [...t.querySelectorAll("tbody td.qt-valeur")].map(texte),
      valeurTotal: t.querySelector("tfoot td.qt-valeur") ? texte(t.querySelector("tfoot td.qt-valeur") as Element) : null
    };
  });
}

async function bandeauVisible(page: IPageSuivie): Promise<boolean> {
  return page.evaluate(() => {
    const b = document.querySelector<HTMLElement>("#quantitatifBandeau");
    return !!b && getComputedStyle(b).display !== "none" && !b.hidden && b.getBoundingClientRect().height > 0;
  });
}

async function viewerPuisQuantitatif(page: IPageSuivie): Promise<void> {
  await naviguer(page, "viewer");
  await attendreMaquettes(page);
  await naviguer(page, "quantitatif");
  await dormir(800);
}

/** Attend la relecture « Est-ce bien votre demande ? ». Pendant la confirmation l'application n'affiche que ce bandeau (le tableau est dans le DOM mais masque jusqu'a « Oui »). */
async function attendreTableau(page: IPageSuivie): Promise<void> {
  await page.waitForSelector("#quantitatifBandeau:not([hidden])", { timeout: 25_000 });
  await dormir(400);
}

function nombre(texte: string | undefined): number {
  return parseFloat((texte ?? "").replace(/[\s ]/g, "").replace(",", ".")) || 0;
}

function sommeColonne(t: ITableau): { somme: number; total: number } {
  return { somme: t.valeurs.reduce((a, v) => a + nombre(v), 0), total: nombre(t.valeurTotal ?? "") };
}

/** Exporte via le menu deroulant « Exporter » (29/10) : le bouton ouvre la liste des formats, puis un choix. Le PDF s'ouvre dans un onglet (blob lu depuis cet onglet), Excel et CSV se telechargent. */
async function telecharger(ctx: IContexteTest, page: IPageSuivie, format: "Excel" | "PDF" | "CSV"): Promise<string> {
  await page.click('button[aria-label="Exporter ce quantitatif"]');
  await page.waitForSelector('[role="listbox"][aria-label="Exporter en"]', { timeout: 5_000 });
  const choix = `[role="listbox"][aria-label="Exporter en"] [role="option"]:has-text("${format}")`;
  if (format === "PDF") {
    const [onglet] = await Promise.all([ctx.contexte.waitForEvent("page", { timeout: 40_000 }), page.click(choix)]);
    await onglet.waitForLoadState("domcontentloaded").catch(() => undefined);
    const base64 = await onglet.evaluate(async () => {
      const octets = new Uint8Array(await (await fetch(location.href)).arrayBuffer());
      let binaire = "";
      octets.forEach((o) => { binaire += String.fromCharCode(o); });
      return btoa(binaire);
    });
    await onglet.close();
    const chemin = join(ctx.dossierTelechargements, "quantitatif.pdf");
    writeFileSync(chemin, Buffer.from(base64, "base64"));
    return chemin;
  }
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 40_000 }), page.click(choix)]);
  const chemin = join(ctx.dossierTelechargements, dl.suggestedFilename());
  await dl.saveAs(chemin);
  return chemin;
}

/** Test 1 laptop : rendu, historique, exports Excel/PDF/CSV, obsolescence. Reponses du modele simulees, comptages reels sur les vraies maquettes. */
async function laptop(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  ctx.simulerApi("/api/quantitatif", simulateurQuantitatif);
  ctx.simulerEtag({ mecanique: "v1", architecture: "a1" });
  const page = await ctx.ouvrir("#viewer");
  await attendreMaquettes(page);
  await naviguer(page, "quantitatif");
  await dormir(600);

  // R-39 : carte de depart, rien d'autre que « Nouvelle demande » et « Historique » (grise).
  {
    const r = await page.evaluate(() => {
      const racine = document.getElementById("view-quantitatif");
      if (!racine) return { boutons: [] as string[], texte: "", phrases: false };
      return {
        boutons: [...racine.querySelectorAll("button")]
          .filter((b) => b.getBoundingClientRect().width > 0)
          .map((b) => b.innerText.trim() + (b.disabled ? "(grisé)" : "")),
        texte: racine.innerText.replace(/\s+/g, " ").slice(0, 300),
        phrases: !!racine.querySelector(".regles-ia-exemple")
      };
    });
    verif.controle("R-39 « Nouvelle demande » presente", r.boutons.includes("Nouvelle demande"), r.boutons);
    verif.controle("R-39 « Historique » present et actif des la premiere ouverture (2 demandes de demonstration amorcees)", r.boutons.some((b) => /^Historique · 2$/.test(b)), r.boutons);
    verif.controle("R-39 aucune introduction ni encart « Pose une question »", !/Pose une question/.test(r.texte) && !r.phrases, r.texte);
  }

  // R-40 : phrase toute faite, resultat « Compte », aucun appel IA.
  {
    const avant = ctx.appelsApi.length;
    await lancerPhraseExemple(page, BOUTON_IA, "Combien de portes au niveau 2 ?");
    await attendreTableau(page);
    const t = await lireTableau(page);
    verif.controle("R-40 aucun appel IA (phrase toute faite)", ctx.appelsApi.length === avant, ctx.appelsApi.length - avant);
    // Sans regroupement l'application affiche une seule ligne « Ensemble » (pas de pied « Total ») : ecart avec le texte du plan (« une ligne Total »).
    verif.controle("R-40 une ligne « Ensemble » (ou « Total ») et origine « Compté »", !!t && t.lignes.length >= 1 && /Ensemble|Total/i.test(JSON.stringify(t)) && /compté/i.test(JSON.stringify(t)), { lignes: t?.lignes, pied: t?.pied });
    verif.controle("R-40 bandeau « Est-ce bien votre demande ? » avec Oui / Non", (await bandeauVisible(page)) && (await page.locator(OUI).count()) > 0 && (await page.locator(NON).count()) > 0);
    verif.controle("R-40 un nombre de portes calcule (a relire a la main, aucun decompte independant)", !!t && t.lignes.length > 0, t?.lignes);
    verif.controle("R-40 pendant la confirmation seule la relecture est affichee (tableau masque)", !(await page.locator(".qt-resultat").isVisible()));
    await page.click(OUI);
    await dormir(300);
    verif.controle("R-40 apres « Oui » le tableau est affiche", await page.locator(".qt-tableau").isVisible());
  }

  // R-41 : regroupements, somme des lignes = total.
  {
    await lancerPhraseExemple(page, BOUTON_IA, "Le nombre de gaines par niveau");
    await attendreTableau(page);
    const t1 = await lireTableau(page);
    await page.click(OUI);
    await dormir(300);
    await lancerPhraseExemple(page, BOUTON_IA, "Combien de murs par niveau et par type ?");
    await dormir(1200);
    const t2 = await lireTableau(page);
    await page.click(OUI);
    await dormir(300);
    const s1 = t1 ? sommeColonne(t1) : { somme: -1, total: -2 };
    const s2 = t2 ? sommeColonne(t2) : { somme: -1, total: -2 };
    verif.controle("R-41 gaines par niveau : plusieurs lignes, somme = total", !!t1 && t1.lignes.length > 1 && s1.somme === s1.total, { lignes: t1?.lignes.length, ...s1 });
    verif.controle("R-41 murs par niveau et type : plusieurs lignes, somme = total", !!t2 && t2.lignes.length > 1 && s2.somme === s2.total, { lignes: t2?.lignes.length, ...s2 });
  }

  // R-42 : mesure estimee, mention en toutes lettres.
  {
    await lancerPhraseExemple(page, BOUTON_IA, "Longueur totale des tuyaux (estimée)");
    await attendreTableau(page);
    const r = await page.evaluate(() => ({
      pastilles: [...document.querySelectorAll(".qt-resultat-tete .qt-pastille")].map((x) => (x as HTMLElement).innerText.trim()),
      avertissement: (document.querySelector(".qt-avertissement") as HTMLElement | null)?.innerText ?? "",
      couleur: (() => {
        const e = document.querySelector(".qt-origine-estime, .qt-pastille-estime");
        return e ? getComputedStyle(e).color : null;
      })()
    }));
    verif.controle("R-42 origine « Estimé » en couleur", /Estim/i.test(r.pastilles.join(" ")) && !!r.couleur, r);
    verif.controle("R-42 mention d'estimation sur boite englobante, pas de chiffrage ferme", /boîte englobante/i.test(r.avertissement) && /chiffrage|ferme/i.test(r.avertissement), r.avertissement);
    await page.click(OUI);
    await dormir(300);
  }

  // R-43 : « Non » retire l'entree, « Oui » la garde dans l'historique (cartes cliquables ; « Supprimer » vit dans le quantitatif ouvert, 28/10).
  {
    const lireHisto = (): Promise<string[]> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".qt-histo-item")].map((li) => li.innerText.replace(/\s+/g, " ")));
    await lancerPhraseExemple(page, BOUTON_IA, "Liste des vannes de la maquette CVC");
    await page.waitForSelector("#quantitatifBandeau", { timeout: 25_000 });
    await dormir(300);
    await page.click(NON);
    await dormir(500);
    // « Non » rouvre la saisie preremplie (comportement attendu, verifie ici) : on la ferme pour poursuivre.
    verif.controle("R-43 « Non » rouvre la saisie preremplie avec la phrase", (await texteModale(page)).length > 0 || (await page.locator(".regles-ia-fond-saisie:not([hidden]) textarea").count()) > 0);
    await page.keyboard.press("Escape");
    await dormir(300);
    await page.click("#quantitatifHistoriqueBtn");
    await dormir(400);
    const h1 = await lireHisto();
    await page.click('#view-quantitatif button[aria-label="Retour"]').catch(() => undefined);
    await lancerPhraseExemple(page, BOUTON_IA, "Quantité de faux plafonds du niveau 1");
    await attendreTableau(page);
    await page.click(OUI);
    await dormir(300);
    await page.click('#view-quantitatif button[aria-label="Retour"]'); // le bouton « Historique » ne vit que sur la carte de depart
    await page.click("#quantitatifHistoriqueBtn");
    await dormir(400);
    const h2 = await lireHisto();
    const cartes = await page.locator(".qt-histo-item button.qt-histo-carte").count();
    verif.controle("R-43 « Non » : l'entree « vannes » n'est pas dans l'historique", !h1.some((x) => /vannes/i.test(x)), h1);
    verif.controle("R-43 « Oui » : l'entree « faux plafonds du niveau 1 » est dans l'historique", h2.some((x) => /faux plafonds du niveau 1/.test(x)), h2);
    verif.controle("R-43 chaque entree est une carte cliquable (plus de boutons « Rouvrir » / « Supprimer »)", cartes === h2.length && (await page.locator(".qt-histo-item button:text-is('Supprimer'), .qt-histo-item button:text-is('Rouvrir')").count()) === 0, { cartes, entrees: h2.length });
  }

  // R-44 : rouvrir une carte sans appel IA, « Supprimer » (dans le quantitatif ouvert) retire une entree et ramene a l'historique.
  {
    const avant = ctx.appelsApi.length;
    const nb0 = await page.locator(".qt-histo-item").count();
    await page.click(".qt-histo-item button.qt-histo-carte");
    await dormir(900);
    const t = await lireTableau(page);
    await page.click('button[aria-label="Supprimer ce quantitatif"]');
    await dormir(400);
    const nb1 = await page.locator(".qt-histo-item").count();
    verif.controle("R-44 « Rouvrir » : aucun appel IA et tableau affiche", ctx.appelsApi.length === avant && !!t, { appels: ctx.appelsApi.length - avant, lignes: t?.lignes.length });
    verif.controle("R-44 « Supprimer » retire une entree", nb1 === nb0 - 1, { avant: nb0, apres: nb1 });
  }

  // R-45 : « Voir » dans le Viewer, bandeau de retour sans chevauchement, retour sans recalcul.
  {
    await page.reload();
    await dormir(1500);
    await viewerPuisQuantitatif(page);
    await lancerPhraseExemple(page, BOUTON_IA, "Combien de portes au niveau 2 ?");
    await attendreTableau(page);
    await page.click(OUI);
    await dormir(300);
    const avant = ctx.appelsApi.length;
    await page.click(".qt-voir >> nth=0");
    await dormir(2500);
    const retour = await page.evaluate(() => {
      const b = [...document.querySelectorAll<HTMLElement>("button")].find((x) => /Retour au quantitatif/.test(x.innerText) && x.getBoundingClientRect().width > 0);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom, largeur: r.width, hauteur: r.height };
    });
    const barre = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("#viewerToolbar button, #coupeToolbar button")]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom, largeur: r.width, hauteur: r.height };
        })
    );
    const scene = await etatScene(page);
    await page.evaluate(() => {
      [...document.querySelectorAll<HTMLElement>("button")].find((x) => /Retour au quantitatif/.test(x.innerText) && x.getBoundingClientRect().width > 0)?.click();
    });
    await dormir(1200);
    const t = await lireTableau(page);
    verif.controle("R-45 bandeau « Retour au quantitatif » present", !!retour);
    verif.controle("R-45 le bandeau ne recouvre aucun bouton de la barre d'outils", !!retour && barre.every((b) => !seChevauchent(retour, b)), { retour });
    verif.controle("R-45 elements isoles dans le Viewer", scene.visibles < scene.total, scene);
    verif.controle("R-45 retour : meme rapport sans recalcul ni appel IA", !!t && ctx.appelsApi.length === avant, { lignes: t?.lignes.length, appels: ctx.appelsApi.length - avant });
  }

  // R-46 a R-48 : exports reels, relus dans le fichier telecharge.
  {
    await lancerPhraseExemple(page, BOUTON_IA, "Longueur totale des tuyaux (estimée)");
    await attendreTableau(page);
    await page.click(OUI);
    await dormir(300);

    const xlsx = await telecharger(ctx, page, "Excel");
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.readFile(xlsx);
    const feuille = classeur.worksheets[0];
    const informations = classeur.worksheets.find((w) => /Informations/.test(w.name));
    const entetes = feuille ? (feuille.getRow(1).values as unknown[]).slice(1) : [];
    const formules: string[] = [];
    let estimeGras = 0;
    feuille?.eachRow((row) =>
      row.eachCell((cellule) => {
        const v = cellule.value as { formula?: string; result?: unknown } | string | number | null;
        if (v && typeof v === "object" && "formula" in v && v.formula) formules.push(v.formula);
        const lu = v && typeof v === "object" && "result" in v ? String(v.result) : String(v ?? "");
        if (/estim/i.test(lu) && cellule.font?.bold) estimeGras++;
      })
    );
    const fusions = feuille ? Object.keys((feuille as unknown as { _merges: Record<string, unknown> })._merges ?? {}).length : -1;
    verif.controle("R-46 Excel : en-tetes sur une ligne, aucune cellule fusionnee", entetes.length > 0 && entetes.every(Boolean) && fusions === 0, { entetes, fusions });
    verif.controle("R-46 Excel : filtres et volets figes", !!feuille?.autoFilter && !!feuille?.views.some((v) => v.state === "frozen"), { filtre: feuille?.autoFilter, volets: feuille?.views.map((v) => v.state) });
    verif.controle("R-46 Excel : totaux en formules SOUS.TOTAL (SUBTOTAL)", /SUBTOTAL|SOUS/i.test(formules.join(",")), formules.slice(0, 3));
    verif.controle("R-46 Excel : « estimé » en gras", estimeGras > 0, estimeGras);
    verif.controle("R-46 Excel : feuille « Informations »", !!informations, classeur.worksheets.map((w) => w.name));

    const pdf = await lirePdf(await telecharger(ctx, page, "PDF"));
    verif.controle("R-47 PDF A4 portrait", estA4Portrait(pdf.dimensions), pdf.dimensions);
    verif.controle("R-47 PDF avec logo (image incluse)", pdf.images >= 1, pdf.images);
    verif.controle("R-47 PDF : pied « Page n / N », date, mention estime", /Page\s*1\s*\/\s*\d/.test(pdf.texte) && /\d{2}\/\d{2}\/\d{4}/.test(pdf.texte) && /estim/i.test(pdf.texte), pdf.texte.slice(0, 200));

    const csv = await telecharger(ctx, page, "CSV");
    const brut = readFileSync(csv);
    const contenuCsv = brut.toString("utf8");
    const bom = brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf;
    const ligne1 = contenuCsv.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
    verif.controle("R-48 CSV : BOM UTF-8 et separateur « ; »", bom && ligne1.includes(";"), { bom, ligne1 });
    verif.controle("R-48 CSV : aucun caractere casse", !/Ã|�/.test(contenuCsv), statSync(csv).size);
  }

  // R-49 / R-50 : obsolescence (ETag simule, aucun fichier touche).
  {
    const rouvrirDernier = async (): Promise<void> => {
      await page.reload();
      await attendreMaquettes(page);
      await naviguer(page, "quantitatif");
      await page.click("#quantitatifHistoriqueBtn");
      await dormir(300);
      await page.click(".qt-histo-item button.qt-histo-carte");
      await dormir(1500);
    };
    await page.reload();
    await dormir(1500);
    await viewerPuisQuantitatif(page);
    await lancerPhraseExemple(page, BOUTON_IA, "Liste des vannes de la maquette CVC");
    await attendreTableau(page);
    await page.click(OUI);
    await dormir(300);
    ctx.simulerEtag({ mecanique: "v2", architecture: "a1" });
    await rouvrirDernier();
    const avantRecalcul = await page.evaluate(() => ({ badge: (document.querySelector(".qt-resultat .qt-pastille-obsolete") as HTMLElement | null)?.innerText ?? "" }));
    const appels = ctx.appelsApi.length;
    await page.click('button:text-is("Régénérer")');
    await page.waitForFunction(() => !document.querySelector(".qt-resultat .qt-pastille-obsolete"), null, { timeout: 15_000 }).catch(() => undefined);
    const apres = await page.evaluate(() => ({
      obsolete: !!document.querySelector(".qt-resultat .qt-pastille-obsolete"),
      message: document.getElementById("quantitatifMessage")?.innerText ?? "",
      titre: document.querySelector<HTMLElement>(".qt-resultat-titre")?.innerText ?? ""
    }));
    verif.controle("R-49 maquette concernee remplacee : badge « OBSOLETE »", /obsol/i.test(avantRecalcul.badge), avantRecalcul);
    verif.controle("R-49 « Régénérer » : plus obsolete, sans appel IA", !apres.obsolete && ctx.appelsApi.length === appels, { ...apres, appels: ctx.appelsApi.length - appels });

    ctx.simulerEtag({ mecanique: "v2", architecture: "a2" });
    await rouvrirDernier();
    const autre = await page.evaluate(() => ({ obsolete: !!document.querySelector(".qt-resultat .qt-pastille-obsolete") }));
    verif.controle("R-50 maquette non concernee changee : pas de badge obsolete", !autre.obsolete, autre);
  }

  // R-51 : phrases libres, refus, ambigu (reponses simulees).
  {
    await page.reload();
    await dormir(1200);
    await naviguer(page, "quantitatif");
    await dormir(500);
    const sorties: Array<{ phrase: string; bandeau: boolean; message: string }> = [];
    for (const phrase of ["Combien de cloisons au niveau 3 ?", "Combien de portes au niveau 12 ?", "Quelle heure est-il ?", "Combien de trucs au niveau 2 ?"]) {
      await envoyerPhrase(page, BOUTON_IA, phrase);
      await dormir(1500);
      const bandeau = await bandeauVisible(page);
      const message = (await texteModale(page)).replace(/\s+/g, " ").replace(/Valider Utiliser le micro/, "").trim();
      sorties.push({ phrase, bandeau, message: message.slice(0, 140) });
      if (bandeau) await page.click(OUI);
      else await page.keyboard.press("Escape");
      await dormir(300);
    }
    verif.controle("R-51 « cloisons au niveau 3 » : bandeau et tableau", sorties[0]?.bandeau === true, sorties[0]);
    verif.controle("R-51 niveau inexistant, hors sujet, ambigu : refus sans bandeau", sorties.slice(1).every((s) => !s.bandeau && s.message.length > 0), sorties.slice(1));
  }

  // R-52 : retour sur la page depuis la navbar = carte de depart.
  {
    await naviguer(page, "viewer");
    await dormir(800);
    await naviguer(page, "quantitatif");
    await dormir(600);
    const tableauVisible = await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>(".qt-tableau");
      return !!t && t.getBoundingClientRect().height > 0;
    });
    verif.controle("R-52 retour depuis la navbar : plus de tableau affiche", !tableauVisible, tableauVisible);
  }

  verif.controle("console propre sur le parcours (aucune erreur de page, hors chargements de maquettes interrompus par un rechargement)", erreursUtiles(page).length === 0, erreursUtiles(page).slice(0, 3));
  await page.close();
}

/** Test 1 mobile : R-53, mise en page du tableau sur iPhone simule. Les telechargements reels sur iPhone restent a Gilles. */
async function mobile(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  ctx.simulerApi("/api/quantitatif", simulateurQuantitatif);
  const page = await ctx.ouvrir("#viewer");
  await attendreMaquettes(page);
  await naviguer(page, "quantitatif");
  await dormir(700);
  await lancerPhraseExemple(page, BOUTON_IA, "Combien de murs par niveau et par type ?");
  await attendreTableau(page);
  const boutonsBandeau = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#quantitatifBandeau button")].map((b) => ({ texte: b.innerText.trim(), hauteur: Math.round(b.getBoundingClientRect().height) })));
  await page.click(OUI);
  await dormir(500);
  const g = await page.evaluate(() => {
    const t = document.querySelector(".qt-tableau");
    const env = document.querySelector(".qt-tableau-enveloppe");
    if (!t || !env) return null;
    const position = (el: Element | null): string => (el ? getComputedStyle(el).position : "");
    const boutons = [...document.querySelectorAll<HTMLElement>(".qt-exports button")].map((b) => ({ texte: b.innerText.trim(), hauteur: Math.round(b.getBoundingClientRect().height) }));
    return {
      colonnes: t.querySelectorAll("thead th").length,
      enteteCollant: position(t.querySelector("thead th")),
      colonne1Collante: position(t.querySelector("tbody th")),
      boutons,
      largeurPage: document.documentElement.scrollWidth,
      largeurEcran: window.innerWidth
    };
  });
  verif.controle("R-53 le tableau existe", !!g);
  verif.controle("R-53 boutons « Oui » / « Non » de 40 px ou plus", boutonsBandeau.length === 2 && boutonsBandeau.every((b) => b.hauteur >= 40), boutonsBandeau);
  if (g) {
    verif.controle("R-53 aucun defilement horizontal de la page", g.largeurPage <= g.largeurEcran + 1, { page: g.largeurPage, ecran: g.largeurEcran });
    verif.controle("R-53 boutons d'export de 40 px ou plus", g.boutons.length > 0 && g.boutons.every((b) => b.hauteur >= 40), g.boutons);
    verif.controle("R-53 en-tete et premiere colonne collants", /sticky|fixed/.test(g.enteteCollant) && /sticky|fixed/.test(g.colonne1Collante), { entete: g.enteteCollant, colonne1: g.colonne1Collante });
  }
  await page.click('#view-quantitatif button[aria-label="Retour"]'); // le bouton « Historique » ne vit que sur la carte de depart
  await page.click("#quantitatifHistoriqueBtn");
  await dormir(400);
  const historique = await page.evaluate(() => {
    const h = document.querySelector<HTMLElement>(".qt-historique");
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { visible: !h.hidden && r.height > 0, droite: Math.round(r.right), entrees: h.querySelectorAll(".qt-histo-item").length };
  });
  verif.controle("R-53 l'historique s'ouvre, dans la largeur de l'ecran", !!historique && historique.visible && historique.entrees >= 1 && historique.droite <= (page.viewportSize()?.width ?? 0) + 1, historique);
  const barre = await rect(page, ".qt-barre");
  verif.controle("R-53 la barre d'actions reste dans l'ecran", !barre || barre.droite <= (page.viewportSize()?.width ?? 0) + 1, barre);
  await page.close();
}

export const test01: ITestDef = {
  numero: 1,
  nom: "Quantitatif : rendu, exports Excel/PDF/CSV, historique, obsolescence",
  couvre: ["R-39", "R-40", "R-41", "R-42", "R-43", "R-44", "R-45", "R-46", "R-47", "R-48", "R-49", "R-50", "R-51", "R-52", "R-53"],
  laptop,
  mobile
};
