// Page « Quantitatif » (24/10) : une question en francais sur les maquettes, le tableau de quantites en reponse.
// Deroulement : la demande est tapee ou dictee (Vocal) ; une phrase identique a un exemple est reconnue ici sans IA, sinon seuls des MOTS partent
// vers l'IA (POST /api/quantitatif) qui TRADUIT la phrase en requete ; le moteur local (src/quantitatif.js) calcule. Le tableau s'affiche tout de
// suite avec le bandeau « Est-ce bien votre demande ? » : Oui le valide, Non l'annule et rouvre la saisie prerenseignee.
// Module sans dependance a main.js : tout passe par les parametres de creerQuantitatifPage.
//   racine : element qui recoit la page (#quantitatifRoot)
//   obtenirDonnees() : promesse de { elements, notes, source: "scene" | "json" } ou null (aucune maquette lisible) ; ne rejette jamais
//   demander({ phrase, valeurs }) : src/quantitatifIAClient.js ; ne rejette jamais
//   voirDansViewer(criteres, retour) : facultatif, ouvre le Viewer sur { typesIfc, niveaux, maquettes, noms } avec le rappel de retour { libelle, surRetour } ; rend un message (texte) ou null
//   obtenirVersions() : promesse de [{ id, label, url, empreinte }] (src/quantitatifVersions.js) ; ne rejette jamais
//   historique : creerHistorique(...) (src/quantitatifHistorique.js), stockage remplacable ; chaque quantitatif demande y est garde et rouvrable sans IA
// Un rapport (src/quantitatifRapport.js) porte l'empreinte de version des seules maquettes concernees : a chaque affichage il est compare aux
// versions actuelles (comparerVersions), et s'il est OBSOLETE un badge rouge le dit, avec « Recalculer » (meme requete, sans IA).

import "./quantitatif.css";
import { calculer, exporterCsv } from "./quantitatif.js";
import { construireRapport, tableauDe, nomFichier, dateRelative } from "./quantitatifRapport.js";
import { comparerVersions, libelleStatut } from "./quantitatifVersions.js";
import { valeursPourQuantitatif } from "./quantitatifDonnees.js";
import { EXEMPLES_QUANTITATIF, reconnaitreExemple } from "./quantitatifExemples.js";
import { nettoyerPhrase } from "./reglesVoix.js";
import { creerIASaisie } from "./iaSaisie.js";
import { creerMenuChoix } from "./menuChoix.js";
import { creerCommandesBandeau } from "./commandesBandeau.js";
import { preparerOngletPdf } from "./discussionsIARapportOnglet.js";
import { REQUETE_MOBILE } from "./seuilMobile.js";

const TITRE_ONGLET_QUANTITATIF = "Quantitatif Ouvra";

// MASQUE_INFOS_QUANTITATIF (27/10, demande de Gilles) : retire de l'ecran les informations de contexte du calcul (elements exclus, objets spatiaux,
// niveaux regroupes, date de calcul, maquettes). Les donnees restent dans le rapport et les exports ne changent pas. Mettre false pour les reafficher.
const MASQUE_INFOS_QUANTITATIF = true;

const MESSAGE_VIDE = "Écrire la demande, par exemple « Combien de portes au niveau 2 ? ».";
const MESSAGE_SANS_DONNEES = "Aucune maquette lisible pour le moment. Ouvrir d'abord le Viewer et attendre la fin du chargement.";
const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

// Mobile (28/10) : mise en page dediee, le tableau d'abord. Meme seuil que quantitatif.css.
const MEDIA_MOBILE = REQUETE_MOBILE;
const ecranMobile = () => !!window.matchMedia && window.matchMedia(MEDIA_MOBILE).matches;

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

// Libelle lisible des criteres d'une ligne, pour le nom accessible du bouton « Voir dans le Viewer ».
const nomDeLigne = (cles) => (cles.length ? cles.join(", ") : "ensemble des éléments");

export function creerQuantitatifPage({ racine, obtenirDonnees, demander, voirDansViewer = null, obtenirVersions = async () => [], historique = null }) {
  let jeton = 0; // numero de la demande en cours : une reponse tardive d'une demande abandonnee est ignoree
  let dernierResultat = null; // { rapport, phrase, nouveau } du rapport affiche

  // ---------- Construction ----------
  // Mise en page (refonte du 24/10) : en-tete, puis deux colonnes sur laptop (demande + resultat | historique), une seule colonne sur mobile.
  // Composants et couleurs de l'application (cartes --surface / --border, pastilles teintees comme .status-badge, bandeaux) : voir src/quantitatif.css.
  racine.textContent = "";
  racine.classList.add("qt-page");
  const entete = creer("header", "qt-entete");
  const titre = creer("h2", "qt-titre", "Quantitatif");
  titre.id = "quantitatifTitre";
  const statut = creer("p", "qt-statut");
  statut.id = "quantitatifStatut";
  entete.append(titre, statut);

  // Carte de depart (25/10, comme la page 2D -> 3D) : deux choix seulement, « Nouvelle demande » (ouvre la modale de saisie commune, src/iaSaisie.js, vocal
  // d'abord, avec ses phrases toutes faites) ou « Historique ». Ils ne vivent que sur la carte de depart (28/10).
  const boutonIA = creer("button", "qt-btn-ia", "Nouvelle demande");
  boutonIA.type = "button";
  boutonIA.id = "quantitatifIABtn";
  boutonIA.setAttribute("aria-haspopup", "dialog");
  boutonIA.setAttribute("aria-label", "Nouvelle demande à l'IA");
  boutonIA.title = "Demander à l'IA";
  const boutonHistorique = creer("button", "qt-btn", "Historique");
  boutonHistorique.type = "button";
  boutonHistorique.id = "quantitatifHistoriqueBtn";
  // Sur mobile, le bouton n'a plus de ligne dediee : il se loge en icone « ← » au debut de la premiere ligne du contenu (placerRetour). Le nom accessible reste « Retour ».
  const boutonRetour = creer("button", "qt-btn qt-btn-discret qt-btn-retour", "← ");
  boutonRetour.type = "button";
  boutonRetour.setAttribute("aria-label", "Retour");
  boutonRetour.appendChild(creer("span", "qt-retour-texte", "Retour"));
  const departCarte = creer("section", "qt-depart");
  departCarte.setAttribute("aria-label", "Choisir une action");
  // Barre des vues « resultat » et « historique » : « ← Retour » seulement (28/10). Nouvelle demande et Historique ne vivent que sur la carte de depart.
  const barre = creer("div", "qt-barre");
  barre.hidden = true;
  barre.appendChild(boutonRetour);

  const message = creer("p", "qt-message");
  message.id = "quantitatifMessage";
  message.setAttribute("role", "status");
  message.hidden = true;

  // Confirmation de la demande (28/10) : le MEME bandeau que le Viewer (src/commandesBandeau.js), sous la barre de navigation, pleine largeur.
  // Les rappels n'agissent qu'au clic, apres la creation de la page (majVue, saisie, enregistrer sont alors definis).
  const bandeau = creerCommandesBandeau({
    id: "quantitatifBandeau",
    variable: "--quantitatif-bandeau-h",
    classeActif: "quantitatif-confirm-actif",
    surOui: async () => {
      const courant = dernierResultat;
      if (!courant || !courant.nouveau) return;
      courant.nouveau = false;
      resultatZone.hidden = false;
      majVue();
      if (!barre.hidden) boutonRetour.focus({ preventScroll: true });
      await enregistrer(courant.rapport);
    },
    // « Non » : rien n'a ete enregistre ni affiche, la saisie est rouverte prerenseignee.
    surNon: () => {
      const courant = dernierResultat;
      const phrase = courant ? courant.phrase : "";
      jeton += 1;
      viderResultat();
      allerA("depart");
      dire("");
      saisie.reformuler(phrase); // la modale se rouvre en mode texte, phrase prerenseignee
    }
  });

  const resultatZone = creer("section", "qt-carte qt-resultat");
  resultatZone.setAttribute("aria-live", "polite");
  resultatZone.hidden = true;

  const histoBloc = creer("section", "qt-carte qt-historique");
  histoBloc.setAttribute("aria-label", "Historique des quantitatifs");

  // Une vue a la fois : depart | resultat | historique. Les zones sont masquees par leur conteneur, jamais en touchant a l'etat interne du bandeau ou du resultat.
  const zoneResultat = creer("div", "qt-zone");
  zoneResultat.append(resultatZone);
  zoneResultat.hidden = true;
  const zoneHistorique = creer("div", "qt-zone");
  zoneHistorique.appendChild(histoBloc);
  zoneHistorique.hidden = true;
  const principal = creer("div", "qt-principal");
  principal.append(departCarte, barre, message, zoneResultat, zoneHistorique);
  racine.append(entete, principal);
  departCarte.append(boutonIA, boutonHistorique);

  // ---------- Vues ----------
  let vue = "depart";
  // La vue « resultat » sans rapport affiche (demande abandonnee, « Non », rapport supprime) retombe sur le depart.
  function majVue() {
    const v = vue === "resultat" && resultatZone.hidden && !bandeau.visible() ? "depart" : vue;
    departCarte.hidden = v !== "depart";
    barre.hidden = v === "depart" || (v === "resultat" && bandeau.visible()); // pendant la confirmation, la relecture s'affiche seule
    zoneResultat.hidden = v !== "resultat";
    zoneHistorique.hidden = v !== "historique";
    racine.dataset.vue = v;
    racine.classList.toggle("qt-confirmation", bandeau.visible()); // sous le bandeau de confirmation, le titre de la page est retire (28/10)
    placerRetour();
  }
  // Mobile : « Retour » se loge dans la premiere ligne du quantitatif ou de l'historique affiche (gain d'une ligne entiere) ; sinon il reste dans la barre des vues.
  function placerRetour() {
    const mobile = ecranMobile();
    const cible = !mobile ? null : racine.dataset.vue === "resultat" ? resultatZone.querySelector(".qt-resultat-tete") : racine.dataset.vue === "historique" ? histoBloc.querySelector(".qt-histo-tete") : null;
    const destination = cible || barre;
    if (boutonRetour.parentElement === destination && (!cible || destination.firstChild === boutonRetour)) return;
    const avaitLeFocus = document.activeElement === boutonRetour;
    if (cible) cible.prepend(boutonRetour); else barre.appendChild(boutonRetour);
    if (avaitLeFocus) boutonRetour.focus({ preventScroll: true });
  }
  // Une zone qu'on vide ne doit pas emporter le bouton « Retour » : il retourne d'abord dans la barre.
  function viderZone(zone) {
    if (zone.contains(boutonRetour)) barre.appendChild(boutonRetour);
    zone.textContent = "";
  }
  window.addEventListener("resize", placerRetour);
  function allerA(nouvelle) { vue = nouvelle; majVue(); }
  // « ← Retour » depuis un quantitatif rouvert depuis l'historique ramene aux cartes de l'historique, sinon au depart (28/10).
  let retourVers = "depart";
  boutonRetour.addEventListener("click", () => {
    const cible = vue === "resultat" ? retourVers : "depart";
    retourVers = "depart";
    allerA(cible);
    if (cible === "historique") rafraichirHistorique();
  });
  boutonHistorique.addEventListener("click", () => { allerA("historique"); rafraichirHistorique(); });

  // ---------- Etat visuel ----------
  function dire(texte) {
    message.textContent = texte || "";
    message.hidden = !texte;
  }
  function occuper(occupe) {
    racine.classList.toggle("qt-occupe", occupe);
    racine.setAttribute("aria-busy", occupe ? "true" : "false");
    boutonIA.disabled = occupe;
  }
  function viderResultat() {
    dernierResultat = null;
    bandeau.masquer(false);
    resultatZone.hidden = true;
    viderZone(resultatZone);
    majVue();
  }

  // ---------- Saisie : modale commune (vocal d'abord) ----------
  const saisie = creerIASaisie({
    exemples: EXEMPLES_QUANTITATIF,
    libelle: "Demande de quantitatif par l'IA",
    placeholder: "Ex. : portes du niveau 2",
    messageVide: MESSAGE_VIDE,
    retourFocus: boutonIA,
    surEnvoi: (phrase, { annule }) => traiter(phrase, annule)
  });
  boutonIA.addEventListener("click", () => saisie.ouvrir({}));

  // ---------- Tableau ----------
  function cellule(tag, texte, classe) {
    return creer(tag, classe, texte);
  }

  function ligneTableau(resultat, ligne, estTotal) {
    const tr = creer("tr", estTotal ? "qt-total" : null);
    const nCles = Math.max(1, resultat.regroupements.length);
    if (estTotal) {
      const th = cellule("th", "Total", "qt-cle");
      th.scope = "row";
      if (nCles > 1) th.colSpan = nCles;
      tr.appendChild(th);
    } else {
      const cles = ligne.cles.length ? ligne.cles : ["Ensemble"];
      cles.forEach((cle, i) => {
        const c = cellule(i === 0 ? "th" : "td", cle, "qt-cle");
        if (i === 0) c.scope = "row";
        tr.appendChild(c);
      });
    }
    tr.appendChild(cellule("td", nombre.format(ligne.nombre + ligne.sansDonnee), "qt-num"));
    const quantite = cellule("td", nombre.format(ligne.valeur), "qt-num qt-valeur");
    if (resultat.mesure.unite) quantite.appendChild(creer("span", "qt-unite", " " + resultat.mesure.unite));
    tr.appendChild(quantite);
    const origine = cellule("td", null, "qt-origine-cellule qt-col-origine");
    origine.appendChild(creer("span", "qt-origine qt-origine-" + resultat.mesure.origine, resultat.mesure.origineLibelle));
    tr.appendChild(origine);
    if (voirDansViewer) {
      const td = cellule("td", null, "qt-action");
      if (ligne.nombre + ligne.sansDonnee > 0) {
        const b = creer("button", "qt-voir", "Voir");
        b.type = "button";
        const nom = estTotal ? "ensemble des éléments" : nomDeLigne(ligne.cles);
        b.setAttribute("aria-label", "Voir dans le Viewer : " + nom);
        b.title = "Voir dans le Viewer";
        b.addEventListener("click", () => {
          const retour = voirDansViewer(ligne.criteres, contexteRetour());
          if (typeof retour === "string" && retour) dire(retour);
        });
        td.appendChild(b);
      }
      tr.appendChild(td);
    }
    return tr;
  }

  // Rappel donne au bandeau « ← Retour au quantitatif » au moment de l'envoi vers le Viewer (src/retourContexte.js) : il re-affiche le MEME rapport,
  // relu depuis l'historique (sinon la copie en memoire), sans nouveau calcul ni appel IA. Le bandeau ne sait rien de cette page.
  function contexteRetour() {
    const rapportCourant = dernierResultat ? dernierResultat.rapport : null;
    return {
      libelle: "Retour au quantitatif",
      surRetour: async () => {
        if (!rapportCourant) return;
        const entree = historique ? await historique.obtenir(rapportCourant.id) : null;
        await afficherRapport(entree ? entree.rapport : rapportCourant, { nouveau: false });
        rafraichirHistorique();
      }
    };
  }

  // Badge d'etat du rapport : OBSOLETE (rouge, texte clair, maquettes nommees) ; version inconnue (ambre, dite honnetement) ; rien si a jour.
  function badgeStatut(statut, surRecalculer) {
    if (statut.etat === "a_jour") return null;
    const boite = creer("div", "qt-statut-rapport qt-statut-" + statut.etat);
    boite.setAttribute("role", statut.etat === "obsolete" ? "alert" : "status");
    boite.appendChild(creer("span", "qt-statut-texte", libelleStatut(statut).replace(/^OBSOLÈTE : /, "")));
    if (surRecalculer) {
      const b = creer("button", "qt-btn", "Recalculer");
      b.type = "button";
      b.addEventListener("click", surRecalculer);
      boite.appendChild(b);
    }
    return boite;
  }

  function telecharger(nomFichierSortie, contenu, type) {
    const url = URL.createObjectURL(contenu instanceof Blob ? contenu : new Blob([contenu], { type }));
    const a = creer("a");
    a.href = url;
    a.download = nomFichierSortie;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Exports : Excel et PDF chargent leur bibliotheque ICI, au clic (import dynamique), jamais au chargement de la page.
  async function exporter(format, rapport, statut) {
    dire("Préparation du fichier…");
    // Le PDF s'ouvre dans un nouvel onglet (28/10), comme le rapport des discussions : onglet ouvert ICI, dans le geste du clic, avant toute attente
    // (sinon les bloqueurs de pop-up le refusent). Bloque : onglet null, l'export retombe sur le telechargement.
    let onglet = null;
    if (format === "pdf") {
      onglet = window.open("", "_blank");
      if (onglet) {
        onglet.opener = null;
        preparerOngletPdf(onglet, { titre: TITRE_ONGLET_QUANTITATIF });
      }
    }
    try {
      // Test de recette (serveur de dev uniquement) : ?qtErreur=1 dans l'adresse fait echouer les exports Excel et PDF, pour voir le message d'erreur. Absent en production.
      if (import.meta.env?.DEV && format !== "csv" && new URLSearchParams(window.location.search).get("qtErreur") === "1") throw new Error("Echec simule (qtErreur)");
      if (format === "csv") {
        const remarques = [rapport.resultat.notes[0], ...(statut.etat === "a_jour" ? [] : [libelleStatut(statut)])];
        telecharger(nomFichier(rapport, "csv"), exporterCsv(rapport.resultat, remarques), "text/csv;charset=utf-8");
      } else if (format === "pdf") {
        await (await import("./quantitatifExportPdf.js")).exporterPdf(rapport, statut, { telecharger: (n, c) => telecharger(n, c, "application/pdf"), onglet, mobile: ecranMobile() });
      } else {
        await (await import("./quantitatifExportXlsx.js")).exporterXlsx(rapport, statut, { telecharger: (n, c) => telecharger(n, c) });
      }
      dire("");
    } catch {
      if (onglet && !onglet.closed) onglet.close();
      dire("L'export a échoué. Réessayer, ou utiliser le format CSV.");
    }
  }

  // Pastille d'etat (meme famille que .status-badge de l'application : teinte + mot en toutes lettres).
  function pastilleEtat(statut) {
    if (statut.etat === "obsolete") return creer("strong", "qt-pastille qt-pastille-obsolete", "OBSOLÈTE");
    if (statut.etat === "inconnue") return creer("span", "qt-pastille qt-pastille-inconnue", "Version inconnue");
    return creer("span", "qt-pastille qt-pastille-ajour", "À jour");
  }

  // Liste des formats d'export (29/10) : le menu commun (src/menuChoix.js), le MEME que les selecteurs Priorite / Statut (classes .collision-menu*, src/style.css), pose en
  // position fixe pres du bouton « Exporter » (le panneau coupe tout ce qui deborde). Un seul ouvert a la fois ; ferme par un clic en dehors, Echap, le choix d'un format,
  // un defilement ou un redimensionnement (ecouteurs retires a la fermeture). Meme rendu que le menu de conversation de la messagerie : au moins de la largeur du bouton, sur laptop comme sur mobile.
  const FORMATS_EXPORT = [["xlsx", "Excel"], ["pdf", "PDF"], ["csv", "CSV"]];
  const menuChoix = creerMenuChoix({ conteneur: document.body });
  const fermerMenuExport = () => menuChoix.fermer();
  function ouvrirMenuExport(bouton, rapport, statut) {
    menuChoix.ouvrir(bouton, {
      titre: "Exporter en",
      id: "quantitatifExportChoix",
      fermerAuDefilement: true,
      largeurAuto: true, // au moins la largeur du bouton, assez large pour le titre « Exporter en » sur une ligne
      options: FORMATS_EXPORT.map(([valeur, libelle]) => ({ valeur, libelle })),
      surChoix: (format) => exporter(format, rapport, statut),
    });
  }

  function dessinerRapport(rapport, statut, confirmation = false) {
    const resultat = rapport.resultat;
    fermerMenuExport();
    viderZone(resultatZone);
    const tete = creer("div", "qt-resultat-tete");
    const titres = creer("div", "qt-resultat-titres");
    const titre = creer("h3", "qt-resultat-titre", rapport.relecture);
    titres.appendChild(titre);
    const pastilles = creer("div", "qt-pastilles");
    pastilles.appendChild(creer("span", "qt-pastille qt-pastille-" + resultat.mesure.origine, resultat.mesure.origineLibelle.charAt(0).toUpperCase() + resultat.mesure.origineLibelle.slice(1)));
    pastilles.appendChild(pastilleEtat(statut));
    titres.appendChild(pastilles);
    tete.appendChild(titres);
    resultatZone.appendChild(tete);
    const badge = badgeStatut(statut, () => recalculer(rapport));
    if (badge) resultatZone.appendChild(badge);

    // Avertissement « estimé » (ne pas chiffrer ferme) en toutes lettres, au-dessus du tableau, jamais seulement dans une infobulle, sur mobile comme sur laptop.
    // L'explication « compté » n'a plus de bandeau sur la page (retour du 28/10) : elle reste dans le rapport exporté.
    if (resultat.mesure.origine === "estime") resultatZone.appendChild(creer("p", "qt-avertissement qt-avertissement-estime", tableauDe(rapport).metre.explication));

    if (resultat.aucunResultat) {
      resultatZone.appendChild(creer("p", "qt-vide", "Aucun élément ne correspond à cette demande dans les maquettes chargées."));
    } else {
      const enveloppe = creer("div", "qt-tableau-enveloppe");
      const table = creer("table", "qt-tableau");
      table.appendChild(creer("caption", "qt-legende", rapport.relecture));
      const thead = creer("thead");
      const tr = creer("tr");
      const colonnes = resultat.regroupements.length ? resultat.regroupements.map((r) => r.libelle) : ["Sélection"];
      colonnes.forEach((c) => { const th = cellule("th", c, "qt-cle"); th.scope = "col"; tr.appendChild(th); });
      const unite = resultat.mesure.unite ? " (" + resultat.mesure.unite + ")" : "";
      const libelleMesure = resultat.mesure.libelle.charAt(0).toUpperCase() + resultat.mesure.libelle.slice(1) + unite;
      ["Éléments", libelleMesure, "Origine"].forEach((c, i) => { const th = cellule("th", c, i < 2 ? "qt-num" : "qt-col-origine"); th.scope = "col"; tr.appendChild(th); });
      if (voirDansViewer) { const th = cellule("th", "Viewer", "qt-action"); th.scope = "col"; tr.appendChild(th); }
      thead.appendChild(tr);
      const tbody = creer("tbody");
      resultat.lignes.forEach((l) => tbody.appendChild(ligneTableau(resultat, l, false)));
      table.append(thead, tbody);
      if (resultat.regroupements.length > 0) {
        const tfoot = creer("tfoot");
        tfoot.appendChild(ligneTableau(resultat, resultat.totaux, true));
        table.appendChild(tfoot);
      }
      enveloppe.appendChild(table);
      resultatZone.appendChild(enveloppe);
    }

    if (!MASQUE_INFOS_QUANTITATIF) {
      const notes = resultat.notes.slice(1);
      if (resultat.elementsExclus > 0) notes.push(nombre.format(resultat.elementsExclus) + " objets spatiaux (projet, site, bâtiment, niveaux) ne sont jamais comptés.");
      if (resultat.requete.filtres.niveaux.length || resultat.regroupements.some((r) => r.nom === "niveau")) {
        notes.push("Les niveaux « Level 2 Ceiling » et « Level 2 TOS » sont comptés avec « Level 2 », comme dans le Viewer.");
      }
      notes.push("Calculé le " + new Date(rapport.calculeLe).toLocaleString("fr-FR") + " sur : " + (rapport.maquettes.map((m) => m.label).join(", ") || "aucune maquette") + ".");
      const liste = creer("ul", "qt-notes");
      notes.forEach((n) => liste.appendChild(creer("li", null, n)));
      resultatZone.appendChild(liste);
    }
    // Exports (27/10), puis suppression (28/10) : un bouton « Exporter » ouvre la liste des formats, « Supprimer » est a cote. Groupe en bas du panneau.
    const exports = creer("div", "qt-exports");
    exports.setAttribute("role", "group");
    exports.setAttribute("aria-label", "Exporter ou supprimer ce rapport");
    const boutonExporter = creer("button", "qt-btn qt-btn-exporter", "Exporter");
    boutonExporter.type = "button";
    boutonExporter.setAttribute("aria-haspopup", "listbox");
    boutonExporter.setAttribute("aria-expanded", "false");
    boutonExporter.setAttribute("aria-controls", "quantitatifExportChoix");
    boutonExporter.setAttribute("aria-label", "Exporter ce quantitatif");
    boutonExporter.appendChild(creer("span", "qt-chevron"));
    boutonExporter.addEventListener("click", () => {
      const etaitOuvert = menuChoix.ouvert();
      fermerMenuExport();
      if (!etaitOuvert) ouvrirMenuExport(boutonExporter, rapport, statut);
    });
    const supprimer = creer("button", "qt-btn qt-btn-supprimer", "Supprimer");
    supprimer.type = "button";
    supprimer.setAttribute("aria-label", "Supprimer ce quantitatif");
    supprimer.addEventListener("click", () => supprimerRapport(rapport));
    exports.append(boutonExporter, supprimer);
    resultatZone.appendChild(exports);
    resultatZone.hidden = !!confirmation;
  }

  // Affiche un rapport (nouveau ou rouvert) avec son etat de version actuel, recalcule a chaque affichage.
  async function afficherRapport(rapport, { nouveau }) {
    const statut = comparerVersions(rapport.maquettes, await obtenirVersions());
    dernierResultat = { rapport, phrase: rapport.phrase, nouveau };
    dessinerRapport(rapport, statut, nouveau); // nouveau : le resultat reste cache tant que « Oui » n'est pas cliquee
    if (nouveau) bandeau.montrer({ relecture: rapport.relecture }); else bandeau.masquer(false);
    allerA("resultat");
  }

  // ---------- Historique ----------
  async function rouvrir(rapport) {
    jeton += 1;
    occuper(false);
    dire("");
    retourVers = "historique";
    await afficherRapport(rapport, { nouveau: false });
    if (resultatZone.scrollIntoView) resultatZone.scrollIntoView({ block: "start" });
  }

  // Suppression depuis le quantitatif ouvert : on retombe sur l'historique s'il reste des entrees, sinon sur la carte de depart.
  async function supprimerRapport(rapport) {
    if (historique) await historique.supprimer(rapport.id);
    viderResultat();
    const reste = historique ? await historique.lister() : [];
    await rafraichirHistorique();
    allerA(reste.length ? "historique" : "depart");
  }

  async function rafraichirHistorique() {
    if (!historique) { boutonHistorique.disabled = true; return; }
    const entrees = await historique.lister();
    boutonHistorique.textContent = entrees.length ? "Historique · " + entrees.length : "Historique";
    boutonHistorique.disabled = entrees.length === 0;
    viderZone(histoBloc);
    const versions = await obtenirVersions();
    const tete = creer("div", "qt-histo-tete");
    tete.appendChild(creer("h3", "qt-carte-titre", "Historique"));
    tete.appendChild(creer("span", "qt-pastille qt-pastille-neutre", String(entrees.length)));
    histoBloc.appendChild(tete);
    placerRetour();
    if (!entrees.length) {
      histoBloc.appendChild(creer("p", "qt-histo-vide", "Les quantitatifs apparaîtront ici, avec leur date. Ils pourront être rouverts sans rappeler l'IA."));
      return;
    }
    const liste = creer("ul", "qt-histo-liste");
    entrees.forEach((entree) => {
      const rapport = entree.rapport;
      const statut = comparerVersions(rapport.maquettes, versions);
      const li = creer("li", "qt-histo-item");
      // Toute la carte est le bouton qui rouvre le quantitatif (28/10) : plus de boutons Rouvrir / Supprimer ; la suppression vit dans le quantitatif ouvert.
      const carte = creer("button", "qt-histo-carte");
      carte.type = "button";
      carte.setAttribute("aria-label", "Rouvrir : " + rapport.phrase);
      const ligne1 = creer("span", "qt-histo-ligne");
      ligne1.appendChild(pastilleEtat(statut));
      const quand = creer("time", "qt-histo-date", dateRelative(rapport.calculeLe));
      quand.dateTime = rapport.calculeLe;
      quand.title = new Date(rapport.calculeLe).toLocaleString("fr-FR");
      ligne1.appendChild(quand);
      const n = rapport.resultat.lignes.length;
      carte.append(
        ligne1,
        creer("span", "qt-histo-phrase", rapport.phrase),
        creer("span", "qt-histo-detail", n + " ligne" + (n > 1 ? "s" : "") + " · " + (rapport.maquettes.map((m) => m.label).join(", ") || "aucune maquette"))
      );
      carte.addEventListener("click", () => rouvrir(rapport));
      li.appendChild(carte);
      liste.appendChild(li);
    });
    histoBloc.appendChild(liste);
  }

  async function enregistrer(rapport) {
    if (!historique) return;
    const r = await historique.ajouter(rapport);
    if (!r.ok) dire(r.raison === "trop_volumineux" ? "Ce rapport est trop volumineux pour l'historique. Il reste affiché, l'exporter permet de le garder." : "L'historique n'est pas disponible sur cet appareil. Le rapport reste affiché, l'exporter permet de le garder.");
    rafraichirHistorique();
  }

  // « Recalculer » : meme requete structuree, sans IA, sur les maquettes actuelles ; le rapport garde son identifiant (l'historique est mis a jour).
  async function recalculer(ancien) {
    const moi = ++jeton;
    occuper(true);
    dire("Recalcul en cours…");
    const donnees = await obtenirDonnees();
    if (moi !== jeton) return;
    occuper(false);
    if (!donnees || !donnees.elements.length) { dire(MESSAGE_SANS_DONNEES); return; }
    const resultat = calculer(donnees.elements, ancien.requete);
    if (!resultat.ok) { dire(resultat.message); return; }
    dire("");
    const rapport = construireRapport({ resultat, phrase: ancien.phrase, versions: await obtenirVersions(), id: ancien.id });
    await enregistrer(rapport);
    await afficherRapport(rapport, { nouveau: false });
  }

  // ---------- Demande ----------
  // Rend { ok: true } ou { ok: false, message } (message vide : demande abandonnee). Utilisee par la modale de saisie (surEnvoi) et par les phrases toutes faites.
  async function afficher(requete, donnees, phrase) {
    const resultat = calculer(donnees.elements, requete);
    if (!resultat.ok) return { ok: false, message: resultat.message };
    const rapport = construireRapport({ resultat, phrase, versions: await obtenirVersions() });
    retourVers = "depart";
    await afficherRapport(rapport, { nouveau: true }); // enregistre dans l'historique seulement apres « Oui »
    return { ok: true };
  }

  async function traiter(phrase, annule = () => false) {
    viderResultat();
    const moi = ++jeton;
    const donnees = await obtenirDonnees();
    if (moi !== jeton || annule()) return { ok: false, message: "" };
    if (!donnees || !donnees.elements.length) return { ok: false, message: MESSAGE_SANS_DONNEES };
    const local = reconnaitreExemple(phrase);
    if (local) return afficher(local, donnees, phrase);
    const reponse = await demander({ phrase, valeurs: valeursPourQuantitatif(donnees.elements, phrase) });
    if (moi !== jeton || annule()) return { ok: false, message: "" };
    if (!reponse.ok || reponse.resultat !== "requete") return { ok: false, message: reponse.message };
    return afficher(reponse.requete, donnees, phrase);
  }

  // Phrase toute faite cliquee sur la page : meme traitement, sans modale (le resultat ou l'erreur s'affiche sur la page).
  async function lancer(texte) {
    const phrase = nettoyerPhrase(texte);
    dire("");
    if (!phrase) { dire(MESSAGE_VIDE); return; }
    occuper(true);
    dire("Prise en compte de la demande…");
    const r = await traiter(phrase);
    occuper(false);
    dire(r.ok ? "" : r.message || "");
  }

  // « Oui » (27/10) : le resultat apparait seulement maintenant, et le rapport entre alors dans l'historique.
  // ---------- Etat de la source ----------
  // Les maquettes peuvent encore charger (ouverture directe sur la page) : tant que la page est affichee, on relit un moment, jusqu'a la geometrie.
  let essaisSource = 0;
  let minuteurSource = null;
  async function actualiserSource() {
    clearTimeout(minuteurSource);
    statut.textContent = "Lecture des maquettes…";
    const donnees = await obtenirDonnees();
    const complet = !!donnees && donnees.elements.length > 0 && donnees.source === "scene";
    if (!complet && essaisSource < 30 && !racine.closest("[hidden]")) {
      essaisSource += 1;
      minuteurSource = setTimeout(actualiserSource, 2000);
    } else if (complet) {
      essaisSource = 0;
    }
    if (!donnees || !donnees.elements.length) { statut.textContent = MESSAGE_SANS_DONNEES; return; }
    statut.textContent = ""; // plus de ligne « N objets dans N maquettes » (retiree le 25/10, demande de Gilles) ; seuls le chargement et l'absence de donnees s'affichent
  }

  // Reouverture de la page : l'etat de version du rapport affiche est recalcule (une maquette a pu changer entre-temps).
  async function rafraichirRapportAffiche() {
    if (dernierResultat && !resultatZone.hidden) dessinerRapport(dernierResultat.rapport, comparerVersions(dernierResultat.rapport.maquettes, await obtenirVersions()));
  }

  // Passage du seuil mobile / laptop : les infos secondaires changent de forme, le rapport affiche est redessine.
  if (window.matchMedia) window.matchMedia(MEDIA_MOBILE).addEventListener("change", rafraichirRapportAffiche);

  return {
    // Appelee par main.js a chaque changement de page.
    surVueActivee(nomVue) {
      if (nomVue === "quantitatif") { allerA("depart"); essaisSource = 0; actualiserSource(); rafraichirHistorique(); rafraichirRapportAffiche(); }
      else { bandeau.masquer(false); saisie.fermer(false); clearTimeout(minuteurSource); jeton += 1; occuper(false); }
    },
    lancer,
    rafraichirHistorique,
    // Pour les tests et pour main.js : etat courant.
    dernierResultat: () => dernierResultat
  };
}
