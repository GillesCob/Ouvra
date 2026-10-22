// Regles de collision en langage naturel, etapes 2 et 3 (22/10) : la modale « Regle a valider » et l'aller-retour vers la 3D.
//
// La modale liste les collisions que la regle changerait reellement (jamais celles deja a la valeur visee), toutes cochees. L'utilisateur
// peut en decocher, aller voir une collision en 3D (« Voir en 3D » ferme la modale, un bandeau « ← Retour a la regle » la rouvre avec la
// meme selection et le meme defilement), puis valider. La regle et la selection vivent en memoire de session seulement : rien n'est ecrit
// dans localStorage ici (seules les modifications de priorite et de statut le sont, par le mecanisme existant de main.js).
//
// Module sans dependance a main.js : tout passe par les parametres de creerReglesModale.
//   libellesPriorite / libellesStatut : { cle: "Libelle" }
//   numero(clash) : numero affiche de la collision
//   lireElement(entityId) : descripteur { nom, typeIfc, niveau, ... } (descripteurElement de reglesCollision.js) ou null
//   voirEn3D(clash) : ouvre la collision dans la vue Collision (comme un clic dans la liste)
//   appliquer(selection, demande) : applique [{ clash, champ: "priorite"|"statut", vers }] et rafraichit l'interface
//   glisserPourFermer(element, fermer, estOuvert) : fermeture par glissement vers le bas sur mobile (celle des tiroirs et de la carte « Infos du sujet »)

import "./reglesModale.css";

const MOBILE = "(max-width: 768px)";
const DUREE_FERMETURE_MS = 350;

export function creerReglesModale({ libellesPriorite, libellesStatut, numero, lireElement, voirEn3D, appliquer, glisserPourFermer }) {
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

  function elementLigne(id) {
    const d = lireElement(id);
    const el = creer("span", "regles-element");
    const type = creer("strong", null, d && d.typeIfc ? d.typeIfc : "Élément inconnu");
    const nom = creer("span", "regles-nom", d && d.nom ? d.nom : "");
    if (d && d.nom) nom.title = d.nom;
    el.append(type, nom);
    return el;
  }

  function creerLigne(ligne, index) {
    const li = creer("li", "regles-ligne");
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
    const texte = creer("span", "regles-texte");
    texte.append(
      creer("span", "regles-numero", "n° " + numero(ligne.clash) + (niveau ? " · " + niveau : "")),
      elementLigne(ligne.clash.entityIds[0]),
      elementLigne(ligne.clash.entityIds[1]),
      creer("span", "regles-changement", changement)
    );
    label.append(caseEl, texte);
    const voir = creer("button", "msg-fantome regles-voir", "Voir en 3D");
    voir.type = "button";
    voir.dataset.act = "voir";
    voir.dataset.i = String(index);
    voir.setAttribute("aria-label", "Voir la collision n° " + numero(ligne.clash) + " en 3D");
    li.append(label, voir);
    return li;
  }

  function rendre() {
    carte.textContent = "";
    const tete = creer("div", "regles-tete");
    const titre = creer("h3", null, "Règle à valider");
    titre.id = "reglesTitre";
    const demande = creer("p", "regles-demande", "« " + session.regle.demande + " »");
    demande.title = session.regle.demande;
    tete.append(titre, demande);
    const croix = creer("button", "msg-croix", "✕");
    croix.type = "button";
    croix.dataset.act = "annuler";
    croix.setAttribute("aria-label", "Fermer");
    const actions = creer("div", "regles-actions msg-rangee");

    if (!session.lignes.length) {
      const vide = creer("p", "regles-vide", "Aucune collision ne correspond à cette règle.");
      vide.setAttribute("role", "status");
      const fermerBtn = creer("button", "msg-fantome", "Fermer");
      fermerBtn.type = "button";
      fermerBtn.dataset.act = "annuler";
      actions.append(fermerBtn);
      const corpsVide = creer("div", "regles-corps");
      corpsVide.appendChild(vide);
      carte.append(tete, corpsVide, actions, croix);
      return;
    }

    const barre = creer("div", "regles-barre");
    const compteur = creer("span", "regles-compteur", texteCompteur());
    compteur.id = "reglesCompteur";
    compteur.setAttribute("role", "status");
    const outils = creer("span", "regles-outils");
    const tout = creer("button", "msg-fantome", "Tout cocher");
    tout.type = "button";
    tout.dataset.act = "tout-cocher";
    const rien = creer("button", "msg-fantome", "Tout décocher");
    rien.type = "button";
    rien.dataset.act = "tout-decocher";
    outils.append(tout, rien);
    barre.append(compteur, outils);
    tete.appendChild(barre);

    const corps = creer("ul", "regles-corps");
    corps.setAttribute("aria-label", "Collisions touchées par la règle");
    session.lignes.forEach((l, i) => corps.appendChild(creerLigne(l, i)));

    const annuler = creer("button", "msg-fantome", "Annuler");
    annuler.type = "button";
    annuler.dataset.act = "annuler";
    const valider = creer("button", "msg-primaire", "Valider");
    valider.type = "button";
    valider.dataset.act = "valider";
    actions.append(annuler, valider);
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
    valider.textContent = "Valider (" + k + ")";
    valider.disabled = k === 0;
  }

  // ---------- Evenements ----------
  function surChangement(e) {
    const caseEl = e.target.closest('input[type="checkbox"][data-i]');
    if (!caseEl || !session) return;
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
      case "tout-cocher": cocherTout(true); break;
      case "tout-decocher": cocherTout(false); break;
      case "valider": valider(); break;
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
  function ouvrir(regle, touchees) {
    assurerSquelette();
    montrerBandeau(false);
    if (!ouverte()) declencheur = document.activeElement;
    session = {
      regle,
      defilement: 0,
      enVisite: false,
      lignes: (touchees || []).filter((t) => !t.inchange)
        .map((t) => ({ clash: t.clash, champ: regle.action.champ, de: t.de, vers: t.vers, coche: true }))
    };
    afficher(false);
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
  }

  // L'utilisateur quitte la vue Collision autrement que par le bandeau : le bandeau disparait et la regle est oubliee.
  function oublier() {
    if (!session || !session.enVisite) return;
    montrerBandeau(false);
    session = null;
  }

  return { ouvrir, oublier, ouverte };
}
