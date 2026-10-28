// Regles de collision en langage naturel, etapes 2 et 3 (22/10) : la modale « Regle a valider » et l'aller-retour vers la 3D.
//
// Une regle « afficher » (23/10) ne change rien : la meme modale liste les collisions trouvees, sans case ni « Valider », avec « Voir en 3D » sur
// chaque ligne, et « Fermer » / « Reformuler » en bas.
// La modale liste les collisions que la regle changerait reellement (jamais celles deja a la valeur visee), toutes cochees. L'utilisateur
// peut en decocher, aller voir une collision en 3D (« Voir en 3D » ferme la modale, un bandeau « ← Retour a la regle » la rouvre avec la
// meme selection et le meme defilement), puis valider. La regle et la selection vivent en memoire de session seulement : rien n'est ecrit
// dans localStorage ici (seules les modifications de priorite et de statut le sont, par le mecanisme existant de main.js).
//
// Module sans dependance a main.js : tout passe par les parametres de creerReglesModale.
//   libellesPriorite / libellesStatut : { cle: "Libelle" }
//   numero(clash) : numero affiche de la collision (le meme que le critere « numeros » des regles, src/reglesCollision.js)
//   creerCarte(clash) : carte de la collision, le meme rendu que la ligne de la liste des collisions (buildCollisionCard de main.js)
//   lireElement(entityId) : descripteur { nom, typeIfc, niveau, ... } (descripteurElement de reglesCollision.js) ou null
//   voirEn3D(clash) : ouvre la collision dans la vue Collision (comme un clic dans la liste)
//   imageDe(clash) : optionnel ; adresse de l'image 3D deja generee de la collision (src/reglesImages.js), ou null : la ligne garde alors un espace vide
//   appliquer(selection, demande) : applique [{ clash, champ: "priorite"|"statut", vers }] et rafraichit l'interface
//   reformuler(phrase) : optionnel ; « Reformuler » (regle venue d'une phrase saisie, regle.saisie) ferme la modale comme « Annuler » puis rouvre le
//     panneau « IA » avec cette phrase pre-remplie, sans appel a l'IA
//   glisserPourFermer(element, fermer, estOuvert) : fermeture par glissement vers le bas sur mobile (celle des tiroirs et de la carte « Infos du sujet »)

import "./reglesModale.css";
import { messageAucuneCollision } from "./reglesCollision.js";

const MOBILE = "(max-width: 768px)";
const DUREE_FERMETURE_MS = 350;

export function creerReglesModale({ libellesPriorite, libellesStatut, numero, creerCarte, lireElement, voirEn3D, imageDe, appliquer, reformuler, glisserPourFermer }) {
  // Etat de session : { regle, lignes: [{ clash, champ, de, vers, coche }], defilement, enVisite }, ou null.
  let session = null;
  let fond = null;
  let carte = null;
  let bandeau = null;
  let minuteurFermeture = 0;
  let declencheur = null;

  const mobile = () => window.matchMedia(MOBILE).matches;
  const ouverte = () => !!fond && !fond.hidden && fond.classList.contains("ouvert");

  function creer(tag, classe, texte) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texte != null) el.textContent = texte;
    return el;
  }

  // Bouton d'action de la rangee du bas (meme composant pour Reformuler, Annuler, Fermer et Valider).
  function creerAction(classe, act, texte) {
    const bouton = creer("button", classe, texte);
    bouton.type = "button";
    bouton.dataset.act = act;
    return bouton;
  }

  // « Reformuler » seulement pour une regle venue d'une phrase saisie dans le panneau « IA » (pas pour une phrase d'exemple).
  function actionReformuler() {
    return reformuler && session.regle.saisie ? [creerAction("msg-fantome", "reformuler", "Reformuler")] : [];
  }

  // Regle d'affichage : aucune modification a valider, la modale ne fait que lister.
  const enAffichage = () => !!session && session.regle.action.champ === "afficher";

  function libellesDe(champ) {
    return champ === "priorite" ? libellesPriorite : libellesStatut;
  }
  const nomChamp = (champ) => (champ === "priorite" ? "Priorité" : "Statut");

  // ---------- Squelette (cree une fois) ----------
  function assurerSquelette() {
    if (fond) return;
    fond = creer("div", "regles-fond");
    fond.id = "reglesFond";
    fond.hidden = true;
    carte = creer("div", "regles-carte");
    carte.id = "reglesCarte";
    carte.setAttribute("role", "dialog");
    carte.setAttribute("aria-modal", "true");
    carte.setAttribute("aria-labelledby", "reglesTitre");
    fond.appendChild(carte);
    document.body.appendChild(fond);
    // Clic sur le fond autour de la carte (laptop) : fermeture, comme Echap.
    fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
    // Les clics de la modale ne remontent pas jusqu'au document : xeokit y annule l'action par defaut de tout clic tant que le pointeur est reste
    // sur le canevas 3D (case a cocher sans effet apres un aller-retour vers la 3D).
    fond.addEventListener("click", (e) => e.stopPropagation());
    carte.addEventListener("click", surClicCarte);
    carte.addEventListener("change", surChangement);
    document.addEventListener("keydown", surTouche, true);
    if (glisserPourFermer) glisserPourFermer(carte, () => fermer(), ouverte);
  }

  // ---------- Rendu ----------
  function selectionnees() {
    return session.lignes.filter((l) => l.coche);
  }

  function texteCompteur() {
    const n = session.lignes.length;
    const k = selectionnees().length;
    if (k === n) return n + (n > 1 ? " collisions touchées" : " collision touchée");
    return k + " sur " + n + (k > 1 ? " sélectionnées" : " sélectionnée");
  }

  // Niveau de la collision : celui de sa zone (« ... · Level 2 », comme la liste des collisions), sinon les niveaux lus sur ses elements.
  function niveauDe(ligne) {
    const zone = String(ligne.clash.zone || "");
    if (zone.includes("·")) return zone.split("·").pop().trim();
    const niveaux = [];
    ligne.clash.entityIds.forEach((id) => {
      const d = lireElement(id);
      if (d && d.niveau && !niveaux.includes(d.niveau)) niveaux.push(d.niveau);
    });
    return niveaux.join(" / ");
  }

  // Valeur de priorite ou de statut, precedee de sa pastille de couleur (celles de la liste des collisions) : la pastille de l'ancienne valeur et
  // celle de la nouvelle, collees a leur nom (retour de Gilles du 22/10).
  function valeurChamp(champ, cle, classe) {
    const val = creer("span", "regles-valeur " + classe);
    const libelle = libellesDe(champ)[cle] || cle;
    if (champ === "priorite") {
      const groupe = creer("span", "collision-groupe-titre prio-" + cle);
      const point = creer("i", "collision-groupe-dot");
      point.setAttribute("aria-hidden", "true");
      groupe.appendChild(point);
      val.append(groupe, libelle);
    } else {
      const point = creer("i", "collision-statut-dot " + cle);
      point.setAttribute("aria-hidden", "true");
      val.append(point, libelle);
    }
    return val;
  }

  // Image 3D de la collision, a droite du texte (deja generee, jamais rendue ici). Sans image : espace vide de meme taille, la colonne reste alignee.
  function creerVue(clash) {
    const url = imageDe ? imageDe(clash) : null;
    const vue = creer("span", "regles-vue" + (url ? "" : " regles-vue-vide"));
    vue.setAttribute("aria-hidden", "true");
    if (url) {
      const img = creer("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      vue.appendChild(img);
    }
    return vue;
  }

  // Ligne « Priorite : Normale → Haute » : le nom du champ en clair, l'ancienne valeur grisee, la nouvelle mise en valeur.
  function ligneChangement(ligne) {
    const el = creer("span", "regles-changement");
    el.append(
      creer("span", "regles-champ", nomChamp(ligne.champ) + " :"),
      " ",
      valeurChamp(ligne.champ, ligne.de, "regles-avant"),
      " → ",
      valeurChamp(ligne.champ, ligne.vers, "regles-apres")
    );
    return el;
  }

  function creerLigne(ligne, index) {
    const li = creer("li", "regles-ligne");
    if (enAffichage()) return creerLigneAffichage(ligne, index, li);
    const idCase = "reglesCase" + index;
    const label = creer("label", "regles-choix");
    label.htmlFor = idCase;
    const caseEl = creer("input");
    caseEl.type = "checkbox";
    caseEl.id = idCase;
    caseEl.checked = ligne.coche;
    caseEl.dataset.i = String(index);
    const labels = libellesDe(ligne.champ);
    const changement = nomChamp(ligne.champ) + " " + (labels[ligne.de] || ligne.de) + " → " + (labels[ligne.vers] || ligne.vers);
    const niveau = niveauDe(ligne);
    caseEl.setAttribute("aria-label", "Collision n° " + numero(ligne.clash) + (niveau ? ", " + niveau : "") + " : " + changement);
    // Meme carte que la liste des collisions ; son libelle d'accessibilite est porte par la case.
    const carteClash = creerCarte(ligne.clash);
    carteClash.removeAttribute("aria-label");
    const contenu = creer("span", "regles-contenu");
    contenu.append(carteClash, ligneChangement(ligne));
    label.append(caseEl, contenu, creerVue(ligne.clash));
    const voir = creer("button", "regles-voir", "Voir en 3D et infos");
    voir.type = "button";
    voir.dataset.act = "voir";
    voir.dataset.i = String(index);
    voir.setAttribute("aria-label", "Voir la collision n° " + numero(ligne.clash) + " en 3D, avec ses infos");
    li.append(label, voir);
    return li;
  }

  // Ligne d'une regle d'affichage : la carte de la collision (sans case a cocher ni ligne de changement) et « Voir en 3D ».
  function creerLigneAffichage(ligne, index, li) {
    const bloc = creer("div", "regles-choix regles-choix-simple");
    const contenu = creer("span", "regles-contenu");
    contenu.appendChild(creerCarte(ligne.clash));
    bloc.append(contenu, creerVue(ligne.clash));
    const voir = creer("button", "regles-voir", "Voir en 3D et infos");
    voir.type = "button";
    voir.dataset.act = "voir";
    voir.dataset.i = String(index);
    voir.setAttribute("aria-label", "Voir la collision n° " + numero(ligne.clash) + " en 3D, avec ses infos");
    li.append(bloc, voir);
    return li;
  }

  // Liste d'une regle d'affichage : compteur, lignes, et seulement « Reformuler » / « Fermer » en bas.
  function rendreAffichage(tete, croix, actions) {
    const n = session.lignes.length;
    const compteur = creer("p", "regles-barre regles-barre-simple", n + (n > 1 ? " collisions trouvées" : " collision trouvée"));
    compteur.setAttribute("role", "status");
    tete.appendChild(compteur);
    const corps = creer("ul", "regles-corps");
    corps.setAttribute("aria-label", "Collisions trouvées");
    session.lignes.forEach((l, i) => corps.appendChild(creerLigne(l, i)));
    actions.append(...actionReformuler(), creerAction("msg-fantome", "annuler", "Fermer"));
    carte.append(tete, corps, actions, croix);
  }

  function rendre() {
    carte.textContent = "";
    const tete = creer("div", "regles-tete");
    const titre = creer("h3", null, enAffichage() ? "Collisions trouvées" : "Règle à valider");
    titre.id = "reglesTitre";
    // Espaces insecables autour des guillemets : le "»" ne peut pas rester seul en debut de ligne, ni le "«" seul en fin de ligne.
    const demande = creer("p", "regles-demande", "«\u00a0" + session.regle.demande + "\u00a0»");
    demande.title = session.regle.demande;
    tete.append(titre, demande);
    const croix = creer("button", "msg-croix", "✕");
    croix.type = "button";
    croix.dataset.act = "annuler";
    croix.setAttribute("aria-label", "Fermer");
    const actions = creer("div", "regles-actions msg-rangee");

    if (!session.lignes.length) {
      const vide = creer("p", "regles-vide", messageAucuneCollision(session.regle, session.numerosExistants));
      vide.setAttribute("role", "status");
      actions.append(...actionReformuler(), creerAction("msg-fantome", "annuler", "Fermer"));
      const corpsVide = creer("div", "regles-corps");
      corpsVide.appendChild(vide);
      carte.append(tete, corpsVide, actions, croix);
      return;
    }

    if (enAffichage()) { rendreAffichage(tete, croix, actions); return; }

    // Case maitresse tri-etat (cochee, decochee, indeterminee) et compteur, alignes sur les cases des lignes.
    const barre = creer("label", "regles-barre");
    const maitre = creer("input");
    maitre.type = "checkbox";
    maitre.id = "reglesMaitre";
    maitre.dataset.maitre = "1";
    maitre.setAttribute("aria-label", "Sélectionner ou désélectionner toutes les collisions touchées par la règle");
    const compteur = creer("span", "regles-compteur", texteCompteur());
    compteur.id = "reglesCompteur";
    compteur.setAttribute("role", "status");
    barre.htmlFor = maitre.id;
    barre.append(maitre, compteur);
    tete.appendChild(barre);

    const corps = creer("ul", "regles-corps");
    corps.setAttribute("aria-label", "Collisions touchées par la règle");
    session.lignes.forEach((l, i) => corps.appendChild(creerLigne(l, i)));

    actions.append(...actionReformuler(), creerAction("msg-fantome", "annuler", "Annuler"), creerAction("msg-primaire btn-principal", "valider", "Valider"));
    carte.append(tete, corps, actions, croix);
    majCompteur();
  }

  // Compteur, libelle et etat du bouton Valider apres chaque changement de selection.
  function majCompteur() {
    const compteur = carte.querySelector("#reglesCompteur");
    const valider = carte.querySelector('[data-act="valider"]');
    if (!compteur || !valider) return;
    const k = selectionnees().length;
    compteur.textContent = texteCompteur();
    const maitre = carte.querySelector("#reglesMaitre");
    const n = session.lignes.length;
    maitre.checked = k === n;
    maitre.indeterminate = k > 0 && k < n;
    maitre.setAttribute("aria-checked", maitre.indeterminate ? "mixed" : String(maitre.checked));
    valider.textContent = "Valider (" + k + ")";
    valider.disabled = k === 0;
  }

  // ---------- Evenements ----------
  function surChangement(e) {
    if (!session) return;
    // Case maitresse : tout cocher si tout n'est pas coche, sinon tout decocher.
    if (e.target.closest('input[data-maitre]')) {
      cocherTout(selectionnees().length < session.lignes.length);
      return;
    }
    const caseEl = e.target.closest('input[type="checkbox"][data-i]');
    if (!caseEl) return;
    session.lignes[Number(caseEl.dataset.i)].coche = caseEl.checked;
    majCompteur();
  }

  function cocherTout(valeur) {
    session.lignes.forEach((l) => { l.coche = valeur; });
    carte.querySelectorAll('input[type="checkbox"][data-i]').forEach((c) => { c.checked = valeur; });
    majCompteur();
  }

  function surClicCarte(e) {
    const bouton = e.target.closest("[data-act]");
    if (!bouton || !session) return;
    switch (bouton.dataset.act) {
      case "annuler": fermer(); break;
      case "valider": valider(); break;
      case "reformuler": reformulerPhrase(); break;
      case "voir": voir(Number(bouton.dataset.i)); break;
      default: break;
    }
  }

  function surTouche(e) {
    if (!ouverte()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fermer();
      return;
    }
    if (e.key !== "Tab") return;
    // Le focus reste dans la modale (aria-modal).
    const focalisables = Array.from(carte.querySelectorAll("button:not([disabled]), input:not([disabled])"));
    if (!focalisables.length) return;
    const premier = focalisables[0];
    const dernier = focalisables[focalisables.length - 1];
    if (!carte.contains(document.activeElement)) { premier.focus(); e.preventDefault(); }
    else if (e.shiftKey && document.activeElement === premier) { dernier.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === dernier) { premier.focus(); e.preventDefault(); }
  }

  // ---------- Ouverture / fermeture ----------
  // sansAnim : retour depuis la 3D, la modale reprend sa place sans rejouer l'apparition.
  function afficher(sansAnim) {
    clearTimeout(minuteurFermeture);
    rendre();
    if (sansAnim) fond.classList.add("sans-anim");
    fond.hidden = false;
    void fond.offsetHeight;
    fond.classList.add("ouvert");
    const corps = carte.querySelector(".regles-corps");
    if (corps && session.defilement) {
      corps.scrollTop = session.defilement;
      requestAnimationFrame(() => { corps.scrollTop = session.defilement; });
    }
    if (sansAnim) { void fond.offsetHeight; fond.classList.remove("sans-anim"); }
    const premier = carte.querySelector(".msg-croix");
    if (premier) premier.focus({ preventScroll: true });
  }

  // Ferme l'affichage (animation de sortie sur mobile). La session est gardee ou non selon l'appelant.
  function masquer(instantane) {
    if (!fond || fond.hidden) return;
    fond.classList.remove("ouvert");
    clearTimeout(minuteurFermeture);
    if (instantane || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !mobile()) fond.hidden = true;
    else minuteurFermeture = setTimeout(() => { fond.hidden = true; }, DUREE_FERMETURE_MS);
  }

  function rendreFocus() {
    if (declencheur && document.contains(declencheur) && declencheur.focus) declencheur.focus({ preventScroll: true });
    declencheur = null;
  }

  // Annuler, croix, fond, Echap, glissement : la regle et la selection sont oubliees.
  function fermer() {
    if (!ouverte()) return;
    masquer(false);
    session = null;
    rendreFocus();
  }

  // touchees : resultat de appliquerRegle. Seules les collisions qui changeraient reellement sont listees, toutes cochees.
  // numerosExistants : numeros affiches des collisions de la detection (sert au message d'un numero cite qui n'existe pas).
  function ouvrir(regle, touchees, numerosExistants = []) {
    assurerSquelette();
    montrerBandeau(false);
    if (!ouverte()) declencheur = document.activeElement;
    session = {
      regle,
      numerosExistants,
      defilement: 0,
      enVisite: false,
      lignes: (touchees || []).filter((t) => !t.inchange)
        .map((t) => ({ clash: t.clash, champ: regle.action.champ, de: t.de, vers: t.vers, coche: true })) // pour « afficher », rien n'est « inchange » : tout est liste
    };
    afficher(false);
  }

  // Comme « Annuler » (regle et selection oubliees), puis le panneau « IA » se rouvre avec la phrase envoyee, a corriger et renvoyer.
  function reformulerPhrase() {
    const phrase = session.regle.demande;
    fermer();
    reformuler(phrase);
  }

  function valider() {
    const choisies = selectionnees();
    if (!choisies.length) return;
    const demande = session.regle.demande;
    masquer(true);
    session = null;
    appliquer(choisies.map((l) => ({ clash: l.clash, champ: l.champ, vers: l.vers })), demande);
    rendreFocus();
  }

  // ---------- Aller-retour vers la 3D ----------
  function voir(index) {
    const ligne = session.lignes[index];
    if (!ligne) return;
    const corps = carte.querySelector(".regles-corps");
    session.defilement = corps ? corps.scrollTop : 0;
    session.enVisite = true;
    masquer(true);
    montrerBandeau(true);
    voirEn3D(ligne.clash);
  }

  function retourner() {
    if (!session || !session.enVisite) return;
    montrerBandeau(false);
    session.enVisite = false;
    afficher(true);
  }

  // Meme composant visuel et meme placement que « ← Retour a la conversation » de la messagerie (#msgBandeauRetour).
  function montrerBandeau(visible) {
    if (visible && !bandeau) {
      bandeau = creer("div");
      bandeau.id = "reglesBandeauRetour";
      bandeau.setAttribute("role", "region");
      bandeau.setAttribute("aria-label", "Retour à la règle");
      bandeau.hidden = true;
      const bouton = creer("button", null, "← Retour à la règle");
      bouton.type = "button";
      bouton.addEventListener("click", retourner);
      bandeau.appendChild(bouton);
      document.body.appendChild(bandeau);
    }
    if (!bandeau) return;
    bandeau.hidden = !visible;
    document.body.classList.toggle("regles-retour-actif", visible); // decale la barre d'outils du Viewer sous le bandeau
    mesurerBandeau(visible);
  }

  // Bas et hauteur REELS du bandeau en variables CSS (reglesModale.css) : la feuille des infos d'une collision commence sous lui, sans valeur fixe.
  function mesurerBandeau(visible) {
    const racine = document.documentElement.style;
    if (!visible) { racine.removeProperty("--regles-bandeau-bas"); racine.removeProperty("--regles-bandeau-h"); return; }
    const boite = bandeau.getBoundingClientRect();
    racine.setProperty("--regles-bandeau-bas", Math.round(boite.bottom) + "px");
    racine.setProperty("--regles-bandeau-h", Math.round(boite.height) + "px");
  }

  // L'utilisateur quitte la vue Collision autrement que par le bandeau : le bandeau disparait et la regle est oubliee.
  function oublier() {
    if (!session || !session.enVisite) return;
    montrerBandeau(false);
    session = null;
  }

  return { ouvrir, oublier, ouverte };
}
