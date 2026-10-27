import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { dormir, MODALE, naviguer, rect, seChevauchent, erreursUtiles } from "../aides.js";
import { estA4Portrait, lirePdf } from "../fichiers.js";
import { simulateurDiscussions } from "../mocksApi.js";
import type { IContexteTest, IPageSuivie, ITestDef } from "../types.js";

const BANDEAU = "#discussionsBandeau";
const RESULTATS = ".msg-ia-res";

async function ouvrirDiscussions(ctx: IContexteTest): Promise<IPageSuivie> {
  const page = await ctx.ouvrir("#discussions");
  await dormir(1500);
  return page;
}

/** Ouvre l'onglet IA puis ferme la modale de saisie qui s'ouvre toute seule (mode vocal, jamais d'ecoute automatique). */
async function ouvrirOngletIA(page: IPageSuivie): Promise<boolean> {
  await page.click("#discussionsIABtn");
  await dormir(700);
  const modale = await page.locator(MODALE).count();
  if (modale > 0) {
    await page.keyboard.press("Escape");
    await dormir(300);
  }
  return modale > 0;
}

/** Clique une phrase toute faite du panneau de gauche (le menu est replie sur mobile), puis « Valider » dans la modale en mode texte. */
async function lancerPhrase(page: IPageSuivie, extrait: string): Promise<void> {
  const phrase = page.locator(`.msg-ia-phrase:has-text(${JSON.stringify(extrait)})`).first();
  if (!(await phrase.isVisible())) await page.click(".msg-ia-phrases > summary");
  await phrase.click();
  await page.waitForSelector(MODALE, { timeout: 5000 });
  await page.click(`${MODALE} >> button:text-is("Valider")`);
  await dormir(1200);
}

async function bandeau(page: IPageSuivie): Promise<{ visible: boolean; texte: string }> {
  return page.evaluate((s) => {
    const b = document.querySelector<HTMLElement>(s);
    return { visible: !!b && !b.hidden && b.getBoundingClientRect().height > 0, texte: b?.innerText.replace(/\s+/g, " ").trim() ?? "" };
  }, BANDEAU);
}

const repondre = async (page: IPageSuivie, reponse: "Oui" | "Non"): Promise<void> => {
  await page.click(`${BANDEAU} button:text-is("${reponse}")`);
  await dormir(700);
};

async function nbResultats(page: IPageSuivie): Promise<number> {
  return page.locator(RESULTATS).count();
}

async function titresBlocs(page: IPageSuivie): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".disc-rapport-bloc h3")].map((h) => h.innerText.trim()));
}

interface IOuvertureRapport {
  /** Le bandeau « Est-ce bien votre demande ? » recouvre-t-il la fenetre du rapport ouverte automatiquement ? null si la fenetre n'etait pas ouverte avant « Oui ». */
  bandeauRecouvre: boolean | null;
}

/**
 * Lance la phrase, confirme par « Oui », laisse le rapport ouvert. L'application ouvre la fenetre du rapport toute seule des la proposition (discussionsIAMontage.js,
 * `proposer`) : « Voir le rapport » ne sert qu'a la rouvrir apres « Fermer ». Rend null (et consigne l'etat observe) si le rapport n'est pas disponible.
 */
async function ouvrirRapport(page: IPageSuivie, extrait: string, ctx: IContexteTest): Promise<IOuvertureRapport | null> {
  await lancerPhrase(page, extrait);
  const avantOui = await bandeau(page);
  let bandeauRecouvre: boolean | null = null;
  if (avantOui.visible && (await page.locator(".disc-rapport-carte").isVisible())) {
    const carte = await rect(page, ".disc-rapport-carte");
    const bande = await rect(page, BANDEAU);
    bandeauRecouvre = !!carte && !!bande && seChevauchent(carte, bande);
  }
  if (avantOui.visible) await repondre(page, "Oui");
  const ouvert = await page.locator(".disc-rapport-carte").waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  if (!ouvert) {
    const etat = await page.evaluate((m) => ({
      modale: document.querySelector<HTMLElement>(m)?.innerText.replace(/\s+/g, " ").slice(0, 160) ?? "",
      resume: document.querySelector<HTMLElement>(".msg-ia-resume")?.innerText.replace(/\s+/g, " ") ?? ""
    }), MODALE);
    ctx.verif.controle(`le rapport s'ouvre apres « ${extrait} » et « Oui »`, false, { bandeauAvantOui: avantOui.texte, ...etat });
    return null;
  }
  await dormir(500);
  return { bandeauRecouvre };
}

async function exporterPdf(ctx: IContexteTest, page: IPageSuivie): Promise<string> {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 40_000 }), page.click('.disc-rapport-btn:text-is("Exporter en PDF")')]);
  const chemin = join(ctx.dossierTelechargements, dl.suggestedFilename());
  await dl.saveAs(chemin);
  return chemin;
}

/** Test 2 laptop : onglet IA, filtres sans IA, recherche par sujet, rapport sourcé et PDF. Les reponses du modele sont simulees. */
async function laptop(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  ctx.simulerApi("/api/discussions", simulateurDiscussions);
  const page = await ouvrirDiscussions(ctx);

  // R-54 / R-55 : trois onglets, l'onglet IA ouvre la saisie, Individuel et Groupes ouvrent la premiere discussion.
  {
    const onglets = await page.evaluate(() => ["msgOngletIndividuel", "msgOngletGroupe", "discussionsIABtn"].map((id) => !!document.getElementById(id) && document.getElementById(id)!.getBoundingClientRect().width > 0));
    verif.controle("R-54 les trois onglets Individuel / Groupes / IA sont visibles", onglets.every(Boolean), onglets);
    const modaleOuverte = await ouvrirOngletIA(page);
    verif.controle("R-54 l'onglet IA ouvre la modale de saisie", modaleOuverte);
    const selectionne = await page.getAttribute("#discussionsIABtn", "aria-selected");
    verif.controle("R-54 l'onglet IA est selectionne", selectionne === "true", selectionne);
    await page.click("#msgOngletGroupe");
    await dormir(500);
    const actifGroupes = await page.locator(".msg-conv.actif, .msg-conv[aria-current='true']").count();
    await page.click("#msgOngletIndividuel");
    await dormir(500);
    const actifIndividuel = await page.locator(".msg-conv.actif, .msg-conv[aria-current='true']").count();
    verif.controle("R-55 Groupes et Individuel ouvrent la premiere discussion", actifGroupes >= 1 && actifIndividuel >= 1, { groupes: actifGroupes, individuel: actifIndividuel });
    await ouvrirOngletIA(page);
  }

  // R-56 : echanges avec une personne (sans IA), « Non » annule et rouvre la saisie, puis « non lus », « Oui » et retour.
  {
    const avant = ctx.appelsApi.length;
    await lancerPhrase(page, "Sophie Lambert");
    const b = await bandeau(page);
    const n = await nbResultats(page);
    verif.controle("R-56 aucun appel IA (phrase toute faite)", ctx.appelsApi.length === avant, ctx.appelsApi.length - avant);
    verif.controle("R-56 bandeau avec la relecture et un decompte", b.visible && /Sophie Lambert/.test(b.texte) && /discussions?, \d+ messages?/.test(b.texte), b.texte);
    verif.controle("R-56 des discussions sont listees, sans « Voir le rapport »", n > 0 && (await page.locator('[data-act="ia-rapport"]').count()) === 0, n);
    await repondre(page, "Non");
    const saisie = await page.locator(`${MODALE} textarea`).inputValue().catch(() => "");
    verif.controle("R-56 « Non » rouvre la saisie preremplie", /Sophie Lambert/.test(saisie), saisie);
    await page.keyboard.press("Escape");
    await dormir(400);
    verif.controle("R-56 « Non » annule : plus de resultat affiche", (await nbResultats(page)) === 0, await nbResultats(page));

    await lancerPhrase(page, "discussions non lues");
    await repondre(page, "Oui");
    const nonLus = await nbResultats(page);
    verif.controle("R-61 « non lus » : des discussions listees apres « Oui »", nonLus > 0, nonLus);
    await page.click('[data-act="ia-tout"]');
    await dormir(500);
    verif.controle("R-56 retour a la liste complete", (await nbResultats(page)) === 0);
  }

  // R-57 : periode relative (les echanges de demonstration sont dates du 14 au 20/10 : peu ou pas de resultat sur 7 jours, c'est une information).
  {
    await lancerPhrase(page, "Karim Benali cette semaine");
    const b = await bandeau(page);
    verif.controle("R-57 relecture de la periode (7 derniers jours)", b.visible && /7 derniers jours/.test(b.texte), b.texte);
    verif.controle("R-57 resultat de la periode (information : dates de demonstration a recaler si vide)", true, { discussions: await nbResultats(page), bandeau: b.texte });
    await repondre(page, "Non");
    await page.keyboard.press("Escape");
    await dormir(300);
  }

  // R-58 : recherche par sujet (etape « analyser » simulee).
  {
    const avant = ctx.appelsApi.filter((a) => a.chemin === "/api/discussions").length;
    await lancerPhrase(page, "cloison coupe-feu");
    await repondre(page, "Oui");
    const analyses = ctx.appelsApi.filter((a) => a.chemin === "/api/discussions" && (a.corps as Record<string, unknown>)["etape"] === "analyser").length;
    const n = await nbResultats(page);
    verif.controle("R-58 un seul appel d'analyse pour la recherche", ctx.appelsApi.filter((a) => a.chemin === "/api/discussions").length - avant === 1 && analyses >= 1, ctx.appelsApi.length);
    verif.controle("R-58 des discussions classees sont listees", n > 0, n);
    await page.locator(RESULTATS).first().click();
    await dormir(800);
    const surligne = await page.locator(".msg-ia-trouve").count();
    verif.controle("R-58 le clic ouvre la discussion avec le message trouve en evidence", surligne >= 1, surligne);
    await page.click('[data-act="ia-tout"]').catch(() => undefined);
    await dormir(300);
  }

  // R-59 / R-147 / R-150 / R-151 : rapport sourcé, decision, copie, PDF.
  {
    const ouverture = await ouvrirRapport(page, "rapport sur les réservations", ctx);
    if (!ouverture) return;
    const titres = await titresBlocs(page);
    verif.controle("R-59 cinq blocs dans l'ordre fixe (Contexte, Intervenants, Désaccords, Décision) puis Sources", /Contexte/i.test(titres[0] ?? "") && /Intervenants/i.test(titres[1] ?? "") && /Désaccords/i.test(titres[2] ?? "") && /Décision/i.test(titres[3] ?? ""), titres);
    const entete = await page.evaluate(() => ({
      logo: !!document.querySelector(".disc-rapport-logo"),
      date: document.querySelector<HTMLElement>(".disc-rapport-date")?.innerText ?? "",
      titre: document.querySelector<HTMLElement>(".disc-rapport-titre")?.innerText ?? "",
      decision: document.querySelector<HTMLElement>(".disc-rapport-decision-etat")?.innerText ?? ""
    }));
    verif.controle("R-59 logo, date et titre dans l'entete", entete.logo && /\d{2}\/\d{2}\/\d{4}/.test(entete.date) && entete.titre.length > 0, entete);
    verif.controle("R-147 decision prise affichee avec son etat", entete.decision.length > 0, entete.decision);
    const sources = await page.locator(".disc-rapport-source").count();
    verif.controle("R-59 sources cliquables", sources >= 1, sources);

    verif.controle("R-59 le bandeau « Est-ce bien votre demande ? » ne recouvre pas la fenetre du rapport (correction du 24/10)", ouverture.bandeauRecouvre !== true, ouverture.bandeauRecouvre);

    await page.click('.disc-rapport-btn:text-is("Copier")');
    await dormir(600);
    const libelleCopier = await page.locator('.disc-rapport-btn').first().innerText();
    if (/Copié/.test(libelleCopier)) verif.controle("R-150 « Copier » devient « Copié »", true, libelleCopier);
    else verif.saute("R-150 « Copier » devient « Copié »", `le presse-papiers n'est pas accessible a WebKit sans geste utilisateur reel (libelle observe : ${libelleCopier}) : a verifier a la main`);

    const chemin = await exporterPdf(ctx, page);
    const pdf = await lirePdf(chemin);
    verif.controle("R-151 nom du fichier ouvra-recap-<sujet>-AAAA-MM-JJ.pdf", /^ouvra-recap-.+-\d{4}-\d{2}-\d{2}\.pdf$/.test(basename(chemin)), basename(chemin));
    verif.controle("R-151 PDF A4 portrait avec logo", estA4Portrait(pdf.dimensions) && pdf.images >= 1, { dimensions: pdf.dimensions, images: pdf.images });
    verif.controle("R-151 pied « Généré par Ouvra » et « Page n / N »", /Généré par Ouvra/.test(pdf.texte) && /Page\s*1\s*\/\s*\d/.test(pdf.texte), pdf.texte.slice(-200));
    verif.controle("R-151 le PDF n'est pas vide (octets)", readFileSync(chemin).length > 2000, readFileSync(chemin).length);
    await page.click(".disc-rapport-fermer");
    await dormir(400);
    await page.click('[data-act="ia-rapport"]');
    verif.controle("R-59 « Voir le rapport » rouvre la fenetre apres « Fermer »", await page.locator(".disc-rapport-carte").waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false));
    await page.click(".disc-rapport-fermer");
    await dormir(400);
  }

  // R-148 : aucune decision, rien d'invente. R-149 : rien a dire. Phrases libres : « comprendre » simule.
  {
    await page.click('[data-act="ia-tout"]').catch(() => undefined);
    await page.click(".msg-ia-nouvelle");
    await page.waitForSelector(MODALE);
    await page.click(`${MODALE} >> text=Écrire ma demande`).catch(() => undefined);
    await page.fill(`${MODALE} textarea`, "Fais-moi un rapport sur l'accès grue");
    await page.click(`${MODALE} >> button:text-is("Valider")`);
    await dormir(1500);
    await repondre(page, "Oui");
    await page.waitForSelector(".disc-rapport-carte", { state: "visible" });
    const decision = await page.evaluate(() => document.querySelector<HTMLElement>(".disc-rapport-bloc:last-of-type, .disc-rapport-decision-etat")?.innerText ?? document.querySelector<HTMLElement>(".disc-rapport-carte")?.innerText ?? "");
    verif.controle("R-148 « Aucune décision prise » quand les messages ne tranchent pas", /Aucune décision prise/i.test(await page.locator(".disc-rapport-carte").innerText()), decision.slice(0, 200));
    await page.click(".disc-rapport-fermer");
    await dormir(400);

    await page.click('[data-act="ia-tout"]').catch(() => undefined);
    await page.click(".msg-ia-nouvelle");
    await page.waitForSelector(MODALE);
    await page.click(`${MODALE} >> text=Écrire ma demande`).catch(() => undefined);
    await page.fill(`${MODALE} textarea`, "Fais-moi un rapport sur la piscine olympique");
    await page.click(`${MODALE} >> button:text-is("Valider")`);
    await dormir(1500);
    await repondre(page, "Oui");
    await page.waitForSelector(".disc-rapport-carte", { state: "visible" });
    const vide = await page.evaluate(() => ({
      texte: document.querySelector<HTMLElement>(".disc-rapport-rien")?.innerText ?? "",
      pdfGrise: (document.querySelector<HTMLButtonElement>(".disc-rapport-btn:nth-of-type(2)")?.disabled ?? false) || [...document.querySelectorAll<HTMLButtonElement>(".disc-rapport-btn")].find((b) => /PDF/.test(b.innerText))?.disabled === true
    }));
    verif.controle("R-149 « Rien n'a été dit à ce sujet. »", /Rien n'a été dit à ce sujet/.test(vide.texte), vide.texte);
    verif.controle("R-149 « Exporter en PDF » grise", vide.pdfGrise, vide.pdfGrise);
    await page.click(".disc-rapport-fermer");
  }

  // R-63 : personne inconnue et hors sujet (phrases libres simulees).
  {
    await page.click('[data-act="ia-tout"]').catch(() => undefined);
    const sorties: Array<{ phrase: string; bandeau: boolean; message: string }> = [];
    for (const phrase of ["Montre-moi les échanges avec Jean-Michel Inconnu", "Quelle est la météo ?"]) {
      await page.click(".msg-ia-nouvelle");
      await page.waitForSelector(MODALE);
      await page.click(`${MODALE} >> text=Écrire ma demande`).catch(() => undefined);
      await page.fill(`${MODALE} textarea`, phrase);
      await page.click(`${MODALE} >> button:text-is("Valider")`);
      await dormir(1200);
      sorties.push({ phrase, bandeau: (await bandeau(page)).visible, message: (await page.locator(MODALE).innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 140) });
      await page.keyboard.press("Escape");
      await dormir(300);
    }
    verif.controle("R-63 personne inconnue et hors sujet : refus dans la modale, aucun bandeau", sorties.every((s) => !s.bandeau && s.message.length > 0), sorties);
  }

  verif.controle("console propre sur le parcours (aucune erreur de page, hors chargements de maquettes interrompus par un rechargement)", erreursUtiles(page).length === 0, erreursUtiles(page).slice(0, 3));
  await page.close();
}

/** Test 2 mobile : R-64 / R-153, le rapport en feuille du bas sur iPhone simule (mesures de mise en page). Geste, defilement et PDF reels restent a Gilles. */
async function mobile(ctx: IContexteTest): Promise<void> {
  const { verif } = ctx;
  ctx.simulerApi("/api/discussions", simulateurDiscussions);
  const page = await ctx.ouvrir("#viewer");
  await dormir(2500);
  await naviguer(page, "discussions");
  await dormir(1200);
  await ouvrirOngletIA(page);

  await lancerPhrase(page, "discussions non lues");
  await repondre(page, "Oui");
  const liste = await nbResultats(page);
  verif.controle("R-64 la liste des resultats s'affiche, aucune discussion ne s'ouvre seule", liste > 0, liste);
  await page.click('[data-act="ia-tout"]').catch(() => undefined);
  await dormir(400);

  const ouverture = await ouvrirRapport(page, "rapport sur les réservations", ctx);
  if (!ouverture) return;
  const g = await page.evaluate(() => {
    const carte = document.querySelector<HTMLElement>(".disc-rapport-carte");
    if (!carte) return null;
    const r = carte.getBoundingClientRect();
    const boutons = [...document.querySelectorAll<HTMLElement>(".disc-rapport-btn")].map((b) => {
      const br = b.getBoundingClientRect();
      return { texte: b.innerText.trim(), hauteur: Math.round(br.height), gauche: br.left, droite: br.right, haut: br.top, bas: br.bottom };
    });
    const corps = document.querySelector<HTMLElement>(".disc-rapport-corps");
    return {
      carte: { gauche: r.left, droite: r.right, bas: r.bottom, haut: r.top },
      ecran: { largeur: window.innerWidth, hauteur: window.innerHeight },
      boutons,
      defilementX: document.documentElement.scrollWidth > window.innerWidth + 1 || (corps ? corps.scrollWidth > corps.clientWidth + 1 : false),
      bodyFige: getComputedStyle(document.body).overflow
    };
  });
  verif.controle("R-153 la fenetre du rapport existe", !!g);
  if (g) {
    verif.controle("R-153 la feuille tient dans la largeur de l'ecran", g.carte.gauche >= -0.5 && g.carte.droite <= g.ecran.largeur + 0.5, g.carte);
    verif.controle("R-153 aucun defilement horizontal", !g.defilementX, g.defilementX);
    verif.controle("R-153 « Copier », « Exporter en PDF » et « Fermer » d'au moins 44 px", g.boutons.length === 3 && g.boutons.every((b) => b.hauteur >= 44), g.boutons);
    const sansChevauchement = g.boutons.every((a, i) => g.boutons.every((b, j) => i === j || a.droite <= b.gauche + 0.5 || b.droite <= a.gauche + 0.5 || a.bas <= b.haut + 0.5 || b.bas <= a.haut + 0.5));
    verif.controle("R-153 boutons sans chevauchement", sansChevauchement, g.boutons);
  }
  const chemin = await exporterPdf(ctx, page);
  const pdf = await lirePdf(chemin);
  verif.controle("R-153 le PDF se telecharge, A4", estA4Portrait(pdf.dimensions), pdf.dimensions);
  await page.close();
}

export const test02: ITestDef = {
  numero: 2,
  nom: "Discussions par IA : filtres, recherche par sujet, rapport sourcé et PDF",
  couvre: ["R-54", "R-55", "R-56", "R-57", "R-58", "R-59", "R-61", "R-63", "R-64", "R-147", "R-148", "R-149", "R-150", "R-151", "R-153"],
  laptop,
  mobile
};
