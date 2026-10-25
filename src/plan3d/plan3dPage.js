// Page « 2D -> 3D » (25/10) : un plan 2D (PDF, PNG ou JPEG) devient un plan editable, puis une maquette 3D et un IFC.
// Le MODELE (src/plan3d/modele.js) est la seule source de verite : l'editeur 2D (editeur2d.js) et l'IFC (exportIfc.js) en sont derives.
// Interface : le plan occupe tout l'ecran, avec des cartes flottantes (outils, proprietes de l'element selectionne, informations libres) ; la page ne defile jamais.
// La maquette 3D n'est PAS dessinee ici : « Voir en 3D » genere l'IFC et l'ouvre dans le vrai Viewer d'Ouvra (voirDansViewer, fourni par main.js), avec
// tous ses outils (coupe, vitesse, isolation, commande IA, discussions) et un bandeau « ← Retour au plan 2D ».
// Premiere version : un seul niveau, murs droits, portes, fenetres, pieces, dalle. Pas de lecture par IA.
// Module sans dependance a main.js : creerPlan3dPage({ racine, voirDansViewer }) rend { surVueActivee(nom) }.

import "./plan3d.css";
import { creerEditeur2d } from "./editeur2d.js";
import { lireFichierPlan, libererFond } from "./importPlan.js";
import { genererIfc } from "./exportIfc.js";
import { planchePiece } from "./texteSol.js";
import { creerIASaisie } from "../iaSaisie.js";
import { demanderPlan } from "./ia/planIAClient.js";
import { creerFluxPlanIA } from "./ia/planIAFlux.js";
import {
  creerModeleVide, validerModele, murDe, ouvertureDe, longueurMur, definirLongueur, modifierMur, modifierOuverture, modifierPiece, calibrer,
  surfaceContour, infosDe, definirInfo, supprimerInfo, TYPES_MUR
} from "./modele.js";

const HISTORIQUE_MAX = 100;
const EXEMPLE_JSON = "/plan3d-local/plan-salome.json";
const EXEMPLE_IMAGE = "/plan3d-local/plan-salome.jpg";

// Icones (SVG 24 x 24, traits). Constantes du code : jamais de texte venu de l'utilisateur.
const NOM_GENRE = { porte: "Porte", fenetre: "Fenêtre", coulissante: "Porte coulissante" };
const ICONES = {
  selection: '<path d="M5 3l14 8-6.5 1.5L10 19z"/>',
  mur: '<path d="M4 20L20 4"/><rect x="2.5" y="18.5" width="3" height="3"/><rect x="18.5" y="2.5" width="3" height="3"/>',
  porte: '<path d="M5 20V4M5 4a16 16 0 0 1 16 16"/><path d="M3 20h18"/>',
  fenetre: '<path d="M3 8h18M3 16h18M3 12h18"/>',
  coulissante: '<path d="M3 10h12M9 14h12"/><path d="M3 20h18M3 4h18"/>',
  piece: '<path d="M4 6l10-2 6 6-3 9-12 1z"/>',
  calibrer: '<path d="M3 16l13-13 5 5L8 21z"/><path d="M7 12l3 3M10 9l2 2M13 6l3 3"/>',
  annuler: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  retablir: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  recadrer: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  vitesse: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
  oeil: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  importer: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'
};

const OUTILS = [
  ["selection", "Sélection"], ["mur", "Mur"], ["porte", "Porte"], ["fenetre", "Fenêtre"], ["coulissante", "Coulissante"], ["piece", "Pièce"], ["calibrer", "Échelle"]
];

function creer(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

function icone(nom) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", "p3d-icone");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONES[nom]; // constante du code, voir ICONES
  return s;
}

// Bouton : icone et/ou libelle. `titre` sert d'infobulle et de nom accessible quand il n'y a pas de libelle.
function bouton(libelle, { classe = "p3d-btn", ico = null, titre = null } = {}) {
  const b = creer("button", classe);
  b.type = "button";
  if (ico) b.appendChild(icone(ico));
  if (libelle) b.appendChild(creer("span", null, libelle));
  if (titre) { b.title = titre; if (!libelle) b.setAttribute("aria-label", titre); }
  return b;
}

// Champ etiquete. Les longueurs sont affichees en cm et rendues en metres a la validation.
function champ(libelle, { pas = 1, min = 0, type = "number" } = {}) {
  const label = creer("label", "p3d-champ");
  label.appendChild(creer("span", null, libelle));
  const input = creer("input");
  input.type = type;
  if (type === "number") { input.step = String(pas); input.min = String(min); input.inputMode = "decimal"; }
  label.appendChild(input);
  return { label, input };
}

const cm = (m) => Math.round(m * 1000) / 10;
const m2 = (v) => `${v.toFixed(2).replace(".", ",")} m²`;
const metres = (v) => `${cm(v)} cm`;

export function creerPlan3dPage({ racine, voirDansViewer = null }) {
  let modele = creerModeleVide();
  let fond = null;
  let pile = [];
  let reprise = [];
  let selection = null;
  let calibration = null;
  let mode = "selection";
  let focusNomPiece = false; // une piece vient d'etre tracee : le champ Nom prend le focus

  racine.replaceChildren();
  const page = creer("div", "p3d-page");
  racine.appendChild(page);

  // ---- En-tete : interrupteur de vue a gauche, actions a droite ----
  const entete = creer("header", "p3d-entete");

  const actions = creer("div", "p3d-actions");
  const fichierInput = creer("input");
  fichierInput.type = "file";
  fichierInput.accept = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
  fichierInput.hidden = true;
  const btnImport = bouton("Importer un plan", { ico: "importer" });
  btnImport.title = "PDF, PNG ou JPEG";
  const selectPage = creer("select", "p3d-select");
  selectPage.setAttribute("aria-label", "Page du PDF");
  selectPage.hidden = true;
  btnImport.setAttribute("aria-label", "Importer un plan (PDF, PNG ou JPEG)"); // le libelle disparait sur ecran etroit
  const btnVoir3d = bouton("Voir en 3D", { ico: "cube" }); // style neutre comme les autres boutons : le vert (accent) se lirait comme « selectionne »
  btnVoir3d.title = "Ouvre la maquette dans le Viewer d'Ouvra";
  btnVoir3d.setAttribute("aria-label", "Voir la maquette 3D dans le Viewer");
  actions.append(btnImport, selectPage, btnVoir3d, fichierInput);
  entete.append(actions);
  page.appendChild(entete);

  // ---- Scene : les deux vues se superposent, une seule est affichee ----
  const scene = creer("div", "p3d-scene");
  const etagePlan = creer("section", "p3d-etage p3d-etage-plan");
  const surface2d = creer("div", "p3d-surface");

  const outils = creer("div", "p3d-outils");
  outils.setAttribute("role", "toolbar");
  outils.setAttribute("aria-label", "Outils du plan");
  const boutonsOutils = {};
  // Pastille qui glisse sous l'outil choisi : meme effet que la bascule Individuel / Groupes des Discussions (0,3 s, position et taille mesurees sur le bouton).
  const pastille = creer("span", "p3d-outils-thumb");
  pastille.setAttribute("aria-hidden", "true");
  outils.appendChild(pastille);
  for (const [id, libelle] of OUTILS) {
    const b = bouton(libelle, { classe: "p3d-outil p3d-outil-mode", ico: id });
    b.title = libelle; // les etiquettes disparaissent sur ecran etroit : l'infobulle prend le relais
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => choisirMode(id));
    boutonsOutils[id] = b;
    outils.appendChild(b);
  }
  // « IA » : une phrase ecrite ou dictee modifie le plan (src/plan3d/ia/). Meme format de bouton que les autres pages ; hors de la pastille des outils exclusifs.
  const btnIA = bouton("IA", { classe: "p3d-outil p3d-outil-ia", titre: "Modifier le plan par une phrase" });
  btnIA.id = "plan3dIABtn";
  btnIA.setAttribute("aria-haspopup", "dialog");
  const separateur = creer("span", "p3d-separateur");
  separateur.setAttribute("aria-hidden", "true");
  const btnAnnuler = bouton("", { classe: "p3d-outil p3d-outil-carre", ico: "annuler", titre: "Annuler (Ctrl Z)" });
  const btnRetablir = bouton("", { classe: "p3d-outil p3d-outil-carre", ico: "retablir", titre: "Rétablir (Ctrl Maj Z)" });
  const btnRecadrer = bouton("", { classe: "p3d-outil p3d-outil-carre", ico: "recadrer", titre: "Recadrer le plan" });
  // Plan de base (l'image importee) : un oeil dans la barre d'outils, la ou on travaille. Allume = visible ; eteint = seul le plan redessine reste.
  const btnFond = bouton("", { classe: "p3d-outil p3d-outil-carre", ico: "oeil", titre: "Visibilité des plans" });
  btnFond.setAttribute("aria-pressed", "true");
  btnFond.disabled = true;
  const btnVitesse = bouton("", { classe: "p3d-outil p3d-outil-carre", ico: "vitesse", titre: "Vitesse du zoom" });
  btnVitesse.setAttribute("aria-pressed", "false");
  outils.append(btnIA, separateur, btnFond, btnAnnuler, btnRetablir, btnRecadrer, btnVitesse);

  // Vitesse du zoom (molette) : 10 a 200 %, 50 % au depart, memorisee dans le navigateur (comme la vitesse de camera du Viewer).
  const vitesse = creer("div", "p3d-vitesse");
  vitesse.hidden = true;
  const vitesseCurseur = creer("input");
  vitesseCurseur.type = "range"; vitesseCurseur.min = "10"; vitesseCurseur.max = "200"; vitesseCurseur.step = "5";
  vitesseCurseur.setAttribute("aria-label", "Vitesse du zoom");
  const vitesseValeur = creer("span", "p3d-vitesse-valeur");
  const libelleVitesse = creer("label", "p3d-vitesse-titre");
  libelleVitesse.append(creer("span", null, "Vitesse du zoom"), vitesseValeur, vitesseCurseur);
  vitesse.appendChild(libelleVitesse);

  // Visibilite du plan de base (l'image importee) : curseur de 0 a 100 %, 35 % au depart ; a 0 le plan de base est masque, seul le plan redessine reste.
  const fondVolet = creer("div", "p3d-vitesse");
  fondVolet.hidden = true;
  const fondCurseur = creer("input");
  fondCurseur.type = "range"; fondCurseur.min = "0"; fondCurseur.max = "100"; fondCurseur.step = "5"; fondCurseur.value = "35";
  fondCurseur.setAttribute("aria-label", "Visibilité du plan de base");
  const fondValeur = creer("span", "p3d-vitesse-valeur");
  const fondLibelle = creer("label", "p3d-vitesse-titre");
  fondLibelle.append(creer("span", null, "Plan de base"), fondValeur, fondCurseur);
  fondVolet.appendChild(fondLibelle);
  // Meme curseur pour le plan redessine (murs, pieces, ouvertures, noms) : de 0 a 100 %, 100 % au depart.
  const maquetteCurseur = creer("input");
  maquetteCurseur.type = "range"; maquetteCurseur.min = "0"; maquetteCurseur.max = "100"; maquetteCurseur.step = "5"; maquetteCurseur.value = "100";
  maquetteCurseur.setAttribute("aria-label", "Visibilité du plan redessiné");
  const maquetteValeur = creer("span", "p3d-vitesse-valeur");
  const maquetteLibelle = creer("label", "p3d-vitesse-titre");
  maquetteLibelle.append(creer("span", null, "Plan redessiné"), maquetteValeur, maquetteCurseur);
  fondVolet.appendChild(maquetteLibelle);

  // Murs neufs : exterieur ou interieur (l'exterieur donne la dalle). Visible seulement avec l'outil Mur.
  const typeMur = creer("div", "p3d-type-mur");
  typeMur.setAttribute("role", "group");
  typeMur.setAttribute("aria-label", "Type du mur à tracer");
  const choixType = {};
  let typeChoisi = "interieur";
  const majTypeMur = () => { for (const [v, b] of Object.entries(choixType)) b.setAttribute("aria-pressed", String(v === typeChoisi)); };
  for (const [valeur, libelle] of [["exterieur", "Extérieur"], ["interieur", "Intérieur"]]) {
    const b = bouton(libelle, { classe: "p3d-puce" });
    b.addEventListener("click", () => { typeChoisi = valeur; majTypeMur(); });
    choixType[valeur] = b;
    typeMur.appendChild(b);
  }
  majTypeMur();

  // Bandeau de verification de la demande IA : le plan est DEJA modifie, « Oui » le garde, « Non » le defait et rouvre la saisie.
  const bandeau = creer("div", "p3d-bandeau");
  bandeau.setAttribute("role", "group");
  bandeau.setAttribute("aria-label", "Vérification de la demande");
  bandeau.hidden = true;
  const bandeauTexte = creer("p", "p3d-bandeau-texte");
  const bandeauBoutons = creer("div", "p3d-bandeau-boutons");
  const boutonOui = creer("button", "p3d-btn p3d-btn-fort", "Oui");
  boutonOui.type = "button";
  const boutonNon = creer("button", "p3d-btn", "Non");
  boutonNon.type = "button";
  bandeauBoutons.append(boutonOui, boutonNon);
  bandeau.append(creer("p", "p3d-bandeau-question", "Est-ce bien votre demande ?"), bandeauTexte, bandeauBoutons);

  // « Terminer » : le tracé d'un mur ou d'une pièce se finit d'ordinaire par double clic, Entrée ou Échap, qui n'existent pas au doigt.
  const btnTerminer = bouton("Terminer", { classe: "p3d-btn p3d-btn-fort p3d-terminer" });
  btnTerminer.hidden = true;
  btnTerminer.addEventListener("click", () => editeur.finirTrace());

  const astuce = creer("p", "p3d-astuce");
  astuce.setAttribute("role", "status");
  astuce.setAttribute("aria-live", "polite");

  const vide = creer("div", "p3d-vide");
  vide.append(creer("p", "p3d-vide-titre", "Commence par un plan"), creer("p", "p3d-vide-texte", "Importe un PDF ou une image, cale l'échelle, puis redessine les murs par-dessus."));
  const videImport = bouton("Importer un plan", { ico: "importer", classe: "p3d-btn p3d-btn-fort" });
  const videExemple = bouton("Essayer avec un plan d'exemple", { classe: "p3d-lien" });
  videExemple.hidden = true;
  vide.append(videImport, videExemple);

  const panneau = creer("aside", "p3d-carte p3d-carte-plan");

  // Ecran etroit : la carte de proprietes occupe le bas de l'ecran ; les volets et « Terminer » se posent au-dessus (hauteur mesuree), et tout remonte quand le clavier
  // virtuel s'ouvre (visualViewport : sur iOS le clavier ne reduit pas la page, seulement la partie visible).
  const ecranEtroit = window.matchMedia ? window.matchMedia("(max-width: 820px)") : { matches: false };
  const majDecalages = () => {
    const carte = ecranEtroit.matches && !panneau.hidden && panneau.dataset.sel === "oui" ? panneau.getBoundingClientRect().height + 12 : 0;
    surface2d.style.setProperty("--p3d-carte-h", `${Math.round(carte)}px`);
    const vv = window.visualViewport;
    const clavier = ecranEtroit.matches && vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    surface2d.style.setProperty("--p3d-clavier", `${Math.round(clavier)}px`);
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(majDecalages).observe(panneau);
  new MutationObserver(majDecalages).observe(panneau, { attributes: true, attributeFilter: ["data-sel", "hidden"] });
  if (window.visualViewport) { window.visualViewport.addEventListener("resize", majDecalages); window.visualViewport.addEventListener("scroll", majDecalages); }

  panneau.setAttribute("aria-label", "Propriétés");
  surface2d.append(outils, typeMur, vitesse, fondVolet, bandeau, btnTerminer, astuce, vide, panneau);
  etagePlan.appendChild(surface2d);
  scene.appendChild(etagePlan);
  page.appendChild(scene);

  // ---- Editeur 2D ----
  const editeur = creerEditeur2d({
    conteneur: surface2d,
    surChangement: (m, { fusion } = {}) => enregistrer(m, fusion),
    surSelection: (sel) => {
      focusNomPiece = Boolean(sel && sel.type === "piece" && mode === "piece");
      selection = sel;
      dessinerPanneau();
    },
    surCalibrer: (p, q) => { calibration = { p, q }; dessinerPanneau(); },
    surCote: () => { const i = panneau.querySelector("[data-champ='longueur']"); if (i) { i.focus(); i.select(); } },
    surTrace: (etat) => { btnTerminer.hidden = !etat; btnTerminer.firstChild && (btnTerminer.querySelector("span").textContent = etat === "piece" ? "Fermer la pièce" : "Terminer"); },
    typeMurNeuf: () => typeChoisi
  });
  editeur.definirModele(modele);

  let pourcentVitesse = 50;
  try { const v = parseInt(localStorage.getItem("ouvra-plan3d-vitesse-zoom"), 10); if (v >= 10 && v <= 200) pourcentVitesse = v; } catch (e) { /* stockage indisponible : on garde 50 */ }
  const appliquerVitesse = (v) => { pourcentVitesse = v; vitesseValeur.textContent = `${v} %`; editeur.definirVitesseZoom(v); };
  vitesseCurseur.value = String(pourcentVitesse);
  appliquerVitesse(pourcentVitesse);
  vitesseCurseur.addEventListener("input", () => {
    appliquerVitesse(Number(vitesseCurseur.value));
    try { localStorage.setItem("ouvra-plan3d-vitesse-zoom", String(pourcentVitesse)); } catch (e) { /* pas bloquant */ }
  });
  const fermerVitesse = (e) => { if (!vitesse.contains(e.target) && !btnVitesse.contains(e.target)) basculerVitesse(false); };
  function basculerVitesse(ouvert) {
    if (ouvert) basculerFond(false); // un seul volet ouvert a la fois
    vitesse.hidden = !ouvert;
    btnVitesse.setAttribute("aria-pressed", String(ouvert));
    if (ouvert) document.addEventListener("pointerdown", fermerVitesse); else document.removeEventListener("pointerdown", fermerVitesse);
  }
  btnVitesse.addEventListener("click", () => basculerVitesse(vitesse.hidden));

  function appliquerFond(pourcent) {
    fondValeur.textContent = pourcent === 0 ? "masqué" : `${pourcent} %`;
    editeur.opaciteFond(pourcent / 100);
    editeur.afficherFond(pourcent > 0);
    btnFond.setAttribute("aria-pressed", String(pourcent > 0));
  }
  // Nouveau plan importe ou exemple charge : le plan de base revient a 35 %, meme si le curseur etait a 0.
  function reinitialiserFond() { fondCurseur.value = "35"; appliquerFond(35); maquetteCurseur.value = "100"; appliquerMaquette(100); }
  function appliquerMaquette(pourcent) {
    maquetteValeur.textContent = pourcent === 0 ? "masqué" : `${pourcent} %`;
    editeur.opaciteMaquette(pourcent / 100);
  }
  maquetteCurseur.addEventListener("input", () => appliquerMaquette(Number(maquetteCurseur.value)));
  fondCurseur.addEventListener("input", () => appliquerFond(Number(fondCurseur.value)));
  const fermerFond = (e) => { if (!fondVolet.contains(e.target) && !btnFond.contains(e.target)) basculerFond(false); };
  function basculerFond(ouvert) {
    if (ouvert) basculerVitesse(false);
    fondVolet.hidden = !ouvert;
    if (ouvert) document.addEventListener("pointerdown", fermerFond); else document.removeEventListener("pointerdown", fermerFond);
  }
  btnFond.addEventListener("click", () => basculerFond(fondVolet.hidden));
  fondValeur.textContent = "35 %";
  maquetteValeur.textContent = "100 %";

  // L'encart du bas ne montre plus d'aides ni de confirmations : seulement une erreur (fichier refuse, distance invalide, export impossible).
  function dire(texte, erreur = false) {
    astuce.textContent = erreur ? texte : "";
    astuce.classList.toggle("p3d-astuce-erreur", erreur);
    astuce.hidden = !(erreur && texte);
  }

  // ---- Historique et diffusion du modele ----
  function enregistrer(m, fusion = false) {
    if (m === modele) return;
    if (!fusion) { pile.push(modele); if (pile.length > HISTORIQUE_MAX) pile.shift(); reprise = []; }
    modele = m;
    apresChangement();
  }

  // Changement venu de la page (panneaux, import) : l'editeur doit etre mis a jour aussi.
  function appliquer(m, fusion = false) {
    enregistrer(m, fusion);
    editeur.definirModele(modele);
  }

  function apresChangement() {
    flux.surChangement(modele);
    majEtat();
    if (selection) dessinerPanneau(true);
  }

  function majEtat() {
    btnAnnuler.disabled = pile.length === 0;
    btnRetablir.disabled = reprise.length === 0;
    btnFond.disabled = !fond;
    btnVoir3d.disabled = modele.murs.length === 0;
    vide.hidden = Boolean(fond) || modele.murs.length > 0;
    // Etat de depart : tout passe par la carte « Commence par un plan » (importer, exemple). Ni outils ni en-tete (importer, voir en 3D) avant.
    const demarre = Boolean(fond) || modele.murs.length > 0;
    outils.hidden = !demarre;
    entete.hidden = !demarre;
  }

  const annuler = () => {
    if (!pile.length) return;
    reprise.push(modele);
    modele = pile.pop();
    editeur.definirModele(modele);
    apresChangement();
  };
  const retablir = () => {
    if (!reprise.length) return;
    pile.push(modele);
    modele = reprise.pop();
    editeur.definirModele(modele);
    apresChangement();
  };
  btnAnnuler.addEventListener("click", annuler);
  btnRetablir.addEventListener("click", retablir);
  page.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
    if (e.target && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    e.preventDefault();
    if (e.shiftKey) retablir(); else annuler();
  });


  // ---- Outils ----
  // Pose la pastille sous l'outil actif. Premiere pose et changement de taille (fenetre, passage sur deux lignes) : sans animation ; un clic : elle glisse.
  let pastillePosee = false;
  function placerPastille(sansAnimation = false) {
    const actif = boutonsOutils[mode];
    if (!actif || !actif.offsetWidth) return; // page masquee : remesure a l'affichage
    const immediat = sansAnimation || !pastillePosee;
    if (immediat) pastille.style.transition = "none";
    pastille.style.width = actif.offsetWidth + "px";
    pastille.style.height = actif.offsetHeight + "px";
    pastille.style.transform = `translate(${actif.offsetLeft}px, ${actif.offsetTop}px)`;
    if (immediat) {
      void pastille.offsetWidth; // applique la position sans transition avant de la remettre
      pastille.style.transition = "";
      pastillePosee = true;
    }
  }
  new ResizeObserver(() => placerPastille(true)).observe(outils);

  function choisirMode(id) {
    mode = id;
    calibration = null;
    for (const [cle, b] of Object.entries(boutonsOutils)) b.setAttribute("aria-pressed", String(cle === id));
    placerPastille();
    typeMur.hidden = id !== "mur";
    editeur.definirMode(id);
    dire("");
    dessinerPanneau();
  }

  // ---- Carte de proprietes (sur le plan) : modifier l'element selectionne ----
  function dessinerPanneau(conserverFocus = false) {
    const actif = document.activeElement;
    if (conserverFocus && actif && panneau.contains(actif) && actif.tagName === "INPUT") return; // ne pas ecraser une saisie en cours
    panneau.replaceChildren();
    panneau.hidden = false;
    panneau.dataset.sel = selection || calibration ? "oui" : "non"; // sur ecran etroit, la carte n'apparait que s'il y a quelque chose a modifier
    if (calibration) return panneauCalibration();
    if (selection && selection.type === "mur") return panneauMur();
    if (selection && selection.type === "ouverture") return panneauOuverture();
    if (selection && selection.type === "noeud") return panneauNoeud();
    if (selection && selection.type === "piece") return panneauPiece();
    panneau.hidden = true; // rien de selectionne : pas de carte (hauteur 2,50 m et dalle 20 cm par defaut, voir creerModeleVide)
  }

  const titrePanneau = (texte) => panneau.appendChild(creer("h3", "p3d-carte-titre", texte));
  const note = (texte) => panneau.appendChild(creer("p", "p3d-note", texte));
  function ligneChamps(...elements) {
    const l = creer("div", "p3d-champs");
    l.append(...elements.map((c) => c.label || c));
    panneau.appendChild(l);
  }

  // Branche un champ : Entree ou sortie du champ valide, une valeur invalide remet l'ancienne.
  function relier(c, lire, ecrire) {
    c.input.value = String(lire());
    const valider = () => {
      const v = Number(c.input.value.replace(",", "."));
      if (c.input.value.trim() === "" || !Number.isFinite(v)) { c.input.value = String(lire()); return; }
      ecrire(v / 100);
    };
    c.input.addEventListener("change", valider);
    c.input.addEventListener("keydown", (e) => { if (e.key === "Enter") { valider(); c.input.blur(); } });
  }

  function listeDeroulante(libelle, options, valeur, surChangement) {
    const label = creer("label", "p3d-champ");
    label.appendChild(creer("span", null, libelle));
    const sel = creer("select", "p3d-select");
    for (const [v, t] of options) { const o = creer("option", null, t); o.value = v; sel.appendChild(o); }
    sel.value = valeur;
    sel.addEventListener("change", () => surChangement(sel.value));
    label.appendChild(sel);
    return { label };
  }

  function boutonSupprimer(texte) {
    const b = bouton(texte, { classe: "p3d-btn p3d-btn-danger" });
    b.addEventListener("click", () => editeur.supprimerSelection());
    panneau.appendChild(b);
  }

  // Champ « Nom » d'une piece : le nom s'affiche sur le plan 2D et sur la maquette 3D.
  function champNomPiece(pc) {
    const nom = champ("Nom de la pièce", { type: "text" });
    nom.input.value = pc.nom;
    nom.input.maxLength = 60;
    nom.input.addEventListener("change", () => appliquer(modifierPiece(modele, pc.id, { nom: nom.input.value })));
    nom.input.addEventListener("keydown", (e) => { if (e.key === "Enter") nom.input.blur(); });
    return nom;
  }

  function panneauMur() {
    const w = murDe(modele, selection.id);
    if (!w) return;
    titrePanneau(`Mur ${w.id}`);
    const l = champ("Longueur (cm)", { min: 5 });
    l.input.dataset.champ = "longueur";
    const e = champ("Épaisseur (cm)", { min: 1 });
    relier(l, () => cm(longueurMur(modele, w)), (v) => appliquer(definirLongueur(modele, w.id, v)));
    relier(e, () => cm(w.epaisseur), (v) => appliquer(modifierMur(modele, w.id, { epaisseur: v })));
    const type = listeDeroulante("Type", TYPES_MUR.map((t) => [t, t === "exterieur" ? "Extérieur" : "Intérieur"]), w.type, (v) => appliquer(modifierMur(modele, w.id, { type: v })));
    ligneChamps(l, e, type);
    sectionInfos("mur", w.id);
    boutonSupprimer("Supprimer le mur");
    note("Changer la longueur déplace l'extrémité du mur : les murs reliés suivent.");
  }

  function panneauOuverture() {
    const o = ouvertureDe(modele, selection.id);
    if (!o) return;
    titrePanneau(`${NOM_GENRE[o.genre]} ${o.id}`);
    const largeur = champ("Largeur (cm)", { min: 5 });
    const hauteur = champ("Hauteur (cm)", { min: 5 });
    const allege = champ("Allège (cm)");
    const decalage = champ("Position (cm)");
    relier(largeur, () => cm(o.largeur), (v) => appliquer(modifierOuverture(modele, o.id, { largeur: v })));
    relier(hauteur, () => cm(o.hauteur), (v) => appliquer(modifierOuverture(modele, o.id, { hauteur: v })));
    relier(allege, () => cm(o.allege), (v) => appliquer(modifierOuverture(modele, o.id, { allege: v })));
    relier(decalage, () => cm(o.decalage), (v) => appliquer(modifierOuverture(modele, o.id, { decalage: v })));
    const genre = listeDeroulante("Genre", [["porte", "Porte"], ["fenetre", "Fenêtre"], ["coulissante", "Porte coulissante"]], o.genre, (v) => appliquer(modifierOuverture(modele, o.id, { genre: v })));
    ligneChamps(largeur, hauteur, allege, decalage, genre);
    sectionInfos("ouverture", o.id);
    boutonSupprimer("Supprimer l'ouverture");
  }

  function panneauPiece() {
    const pc = (modele.pieces || []).find((p) => p.id === selection.id);
    if (!pc) return;
    titrePanneau("Pièce");
    const nom = champNomPiece(pc);
    const lue = champ("Surface lue sur le plan (m²)", { pas: 0.1 });
    lue.input.value = pc.surfacePlan == null ? "" : String(pc.surfacePlan);
    lue.input.addEventListener("change", () => {
      const v = Number(lue.input.value.replace(",", "."));
      appliquer(modifierPiece(modele, pc.id, { surfacePlan: lue.input.value.trim() === "" || !Number.isFinite(v) || v <= 0 ? null : v }));
    });
    ligneChamps(nom, lue);
    note(`Surface calculée : ${m2(surfaceContour(pc.contour))}. Le contour ne suit pas les murs : si un mur bouge, redessine la pièce.`);
    sectionInfos("piece", pc.id);
    boutonSupprimer("Supprimer la pièce");
    if (focusNomPiece) { focusNomPiece = false; setTimeout(() => { nom.input.focus(); nom.input.select(); }, 0); } // piece tout juste tracee : on ecrit son nom
  }

  function panneauNoeud() {
    titrePanneau(`Angle ${selection.id}`);
    note("Glisse ce point pour déplacer l'angle : les murs rattachés suivent. Le supprimer retire ces murs.");
    boutonSupprimer("Supprimer l'angle et ses murs");
  }

  function panneauCalibration() {
    titrePanneau("Échelle du plan");
    const mesuree = Math.hypot(calibration.q.x - calibration.p.x, calibration.q.y - calibration.p.y);
    note(`Distance actuelle entre les deux points : ${cm(mesuree)} cm. Quelle est la distance réelle ?`);
    const c = champ("Distance réelle (cm)", { min: 1 });
    c.input.value = "";
    const ok = bouton("Appliquer", { classe: "p3d-btn p3d-btn-fort" });
    const non = bouton("Annuler");
    const valider = () => {
      const v = Number(c.input.value.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) { dire("Saisis une distance en centimètres, supérieure à 0.", true); c.input.focus(); return; }
      const m = calibrer(modele, calibration.p, calibration.q, v / 100);
      calibration = null;
      appliquer(m);
      editeur.cadrer();
      choisirMode("selection");
      dire(`Échelle appliquée : ${cm(v / 100)} cm entre les deux points.`);
    };
    ok.addEventListener("click", valider);
    c.input.addEventListener("keydown", (e) => { if (e.key === "Enter") valider(); });
    non.addEventListener("click", () => { calibration = null; dessinerPanneau(); });
    ligneChamps(c, ok, non);
    setTimeout(() => c.input.focus(), 0);
  }

  // ---- Informations libres d'un element (nom / valeur, vides au depart) ----
  // Ajoutees ici, sur la carte de l'element selectionne ; elles partent dans l'IFC (jeu de proprietes Ouvra_Infos) et se lisent dans la fiche du Viewer.
  function sectionInfos(type, id) {
    panneau.appendChild(creer("h4", "p3d-infos-sous-titre", "Informations"));
    const existantes = infosDe(modele, type, id);
    for (const info of existantes) {
      const ligne = creer("div", "p3d-info-ligne");
      ligne.appendChild(creer("span", "p3d-info-cle", info.cle));
      const valeur = creer("input", "p3d-info-valeur");
      valeur.value = info.valeur;
      valeur.setAttribute("aria-label", `Valeur de ${info.cle}`);
      valeur.addEventListener("change", () => appliquer(definirInfo(modele, type, id, info.cle, valeur.value)));
      valeur.addEventListener("keydown", (e) => { if (e.key === "Enter") valeur.blur(); });
      const retirer = bouton("×", { classe: "p3d-info-retirer", titre: `Retirer ${info.cle}` });
      retirer.addEventListener("click", () => { appliquer(supprimerInfo(modele, type, id, info.cle)); dessinerPanneau(); });
      ligne.append(valeur, retirer);
      panneau.appendChild(ligne);
    }
    const ajout = creer("form", "p3d-info-ajout");
    const cle = creer("input", "p3d-info-nouvelle-cle");
    cle.placeholder = "Nom (ex. Matériau)";
    cle.maxLength = 60;
    cle.setAttribute("aria-label", "Nom de l'information");
    const val = creer("input", "p3d-info-nouvelle-valeur");
    val.placeholder = "Valeur";
    val.maxLength = 500;
    val.setAttribute("aria-label", "Valeur de l'information");
    const ok = bouton("Ajouter", { classe: "p3d-btn" });
    ok.type = "submit";
    ajout.append(cle, val, ok);
    ajout.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!cle.value.trim()) { cle.focus(); return; }
      appliquer(definirInfo(modele, type, id, cle.value, val.value));
      dessinerPanneau(); // la nouvelle information apparait tout de suite, meme si le focus est dans le formulaire
    });
    panneau.appendChild(ajout);
  }

  // ---- IA du plan ----
  const flux = creerFluxPlanIA({
    obtenirModele: () => modele,
    appliquer: (m) => appliquer(m),
    annuler: () => annuler(),
    demander: demanderPlan,
    surBandeau: ({ visible, texte }) => { bandeau.hidden = !visible; bandeauTexte.textContent = texte; }
  });
  const saisie = creerIASaisie({
    exemples: [],
    libelle: "Modification du plan par l'IA",
    placeholder: "Ex. : la fenêtre nord du salon fait 210 cm",
    messageVide: "Écris ta demande, par exemple « la fenêtre nord du salon fait 210 cm ».",
    retourFocus: btnIA,
    surEnvoi: (phrase, options) => flux.traiter(phrase, options)
  });
  btnIA.addEventListener("click", () => saisie.ouvrir({}));
  boutonOui.addEventListener("click", () => flux.confirmer());
  boutonNon.addEventListener("click", () => saisie.reformuler(flux.refuser()));

  // ---- Import ----
  async function importerFichier(fichier, pageDemandee = 1) {
    dire("Lecture du plan…");
    try {
      const f = await lireFichierPlan(fichier, { page: pageDemandee });
      libererFond(fond);
      fond = f;
      // Echelle de depart arbitraire (le plan fait 12 m de large), a caler avec l'outil « Échelle ».
      const echelle = modele.fond ? modele.fond.echelle : 12 / f.l;
      pile = []; // plan charge : nouveau depart, rien a annuler
      reprise = [];
      modele = { ...modele, fond: { echelle, x: modele.fond ? modele.fond.x : 0, y: modele.fond ? modele.fond.y : 0 } };
      editeur.definirFond(fond);
      reinitialiserFond();
      editeur.definirModele(modele);
      editeur.cadrer();
      apresChangement();
      remplirPages(f, fichier);
      const sansMurs = modele.murs.length === 0;
      choisirMode(sansMurs ? "calibrer" : "selection");
      dire(sansMurs ? "Plan importé. Cale l'échelle : clique deux points dont tu connais la distance." : "Plan importé. Vérifie l'échelle avec l'outil Échelle.");
    } catch (erreur) {
      dire(erreur.message, true);
    }
  }

  function remplirPages(f, fichier) {
    selectPage.replaceChildren();
    selectPage.hidden = !(f.pages > 1);
    if (f.pages > 1) {
      for (let i = 1; i <= f.pages; i++) { const o = creer("option", null, `Page ${i} / ${f.pages}`); o.value = String(i); selectPage.appendChild(o); }
      selectPage.value = String(f.page || 1);
      selectPage.onchange = () => importerFichier(fichier, Number(selectPage.value));
    }
  }

  btnImport.addEventListener("click", () => fichierInput.click());
  videImport.addEventListener("click", () => fichierInput.click());
  fichierInput.addEventListener("change", () => {
    const f = fichierInput.files && fichierInput.files[0];
    fichierInput.value = "";
    if (f) importerFichier(f);
  });

  // Plan d'exemple : fichiers locaux de public/plan3d-local/ (ignores par git, donc absents d'un deploiement). Le lien n'apparait que s'ils repondent.
  fetch(EXEMPLE_JSON, { method: "HEAD" })
    .then((r) => { videExemple.hidden = !(r.ok && !(r.headers.get("content-type") || "").includes("text/html")); })
    .catch(() => {});
  videExemple.addEventListener("click", async () => {
    dire("Chargement de l'exemple…");
    try {
      const [rj, ri] = await Promise.all([fetch(EXEMPLE_JSON), fetch(EXEMPLE_IMAGE)]);
      if (!rj.ok || !ri.ok) throw new Error("absent");
      const m = await rj.json();
      const f = await lireFichierPlan(new File([await ri.blob()], "plan-exemple.jpg", { type: "image/jpeg" }));
      const verdict = validerModele(m);
      if (!verdict.valide) throw new Error(verdict.erreurs[0]);
      libererFond(fond);
      fond = f;
      pile = []; // plan charge : nouveau depart, rien a annuler
      reprise = [];
      modele = m;
      selectPage.hidden = true;
      editeur.definirFond(fond);
      reinitialiserFond();
      editeur.definirModele(modele);
      editeur.cadrer();
      apresChangement();
      choisirMode("selection");
    } catch (erreur) {
      dire(erreur.message === "absent" ? "Le plan d'exemple n'est pas disponible ici." : `Exemple illisible : ${erreur.message}`, true);
    }
  });

  // ---- Maquette 3D : le Viewer d'Ouvra (main.js, voirPlanDansViewer) ----
  btnVoir3d.addEventListener("click", async () => {
    if (modele.murs.length === 0 || !voirDansViewer) return;
    const verdict = validerModele(modele);
    if (!verdict.valide) { dire(`Maquette impossible : ${verdict.erreurs[0]}`, true); return; }
    btnVoir3d.disabled = true;
    try {
      const noms = (modele.pieces || []).map(planchePiece).filter(Boolean); // noms des pieces, poses au sol dans le Viewer
      const probleme = await voirDansViewer({ ifc: new TextEncoder().encode(genererIfc(modele)).buffer, noms });
      if (probleme) dire(probleme, true);
    } finally {
      majEtat();
    }
  });

  btnRecadrer.addEventListener("click", () => editeur.cadrer());

  choisirMode("selection");
  majEtat();

  return {
    // Page affichee : le plan est recadre (la page peut avoir ete masquee avec une taille nulle).
    surVueActivee(nom) { if (nom === "plan3d") { editeur.cadrer(); placerPastille(true); } }
  };
}
