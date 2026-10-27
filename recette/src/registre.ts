import { test01 } from "./tests/test01Quantitatif.js";
import { test02 } from "./tests/test02Discussions.js";
import { test03 } from "./tests/test03Plan2D.js";
import { test04 } from "./tests/test04ImportPlan.js";
import { test05 } from "./tests/test05IAPlan.js";
import { test06 } from "./tests/test06Voir3D.js";
import { test07 } from "./tests/test07ViewerIA.js";
import { test08 } from "./tests/test08NonRegression.js";
import { test10 } from "./tests/test10Plan2DMobile.js";
import type { INonAutomatisable, ITestDef } from "./types.js";

/** Tests automatises, numerotes comme la recette condensee (Projets/Ouvra/recette-2026-10-27-condensee.md). Les Tests 9 et 11 n'ont pas de code propre, voir plus bas. */
export const TESTS: ITestDef[] = [test01, test02, test03, test04, test05, test06, test07, test08, test10];

/** Test 9 (iPhone) = la colonne « mobile » de ces Tests : Quantitatif (R-53), Discussions par IA (R-64, R-153), Viewer par IA (R-38), navigation (R-145). */
export const TEST_9_COMPOSE: number[] = [1, 2, 7, 8];

export const NON_AUTOMATISABLES: INonAutomatisable[] = [
  // ---- Test 1 : Quantitatif ----
  { numero: 1, categorie: "fichier-reel", libelle: "ouvrir le .xlsx dans Excel (feuille principale, onglet Informations, totaux SOUS.TOTAL en Excel francais) et le CSV dans Excel", raison: "le harnais relit la structure du fichier (en-tetes, fusions, filtres, formules, gras) mais ne lance pas Excel : rendu et locale du tableur non verifies" },
  { numero: 1, categorie: "rendu", libelle: "lisibilite du PDF du Quantitatif (logo flou, tableau coupe, accents) et de l'Excel", raison: "jugement a l'oeil ; le harnais verifie A4, logo present (image), pied de page, date et mention « estime » dans le texte extrait" },
  { numero: 1, categorie: "subjectif", libelle: "le nombre de portes (ou de vannes) est-il juste ? un « estime » qui choque devant un public BIM ?", raison: "aucun decompte independant n'existe dans l'outil : le harnais verifie la coherence interne (somme des lignes = total), pas la verite metier" },
  { numero: 1, categorie: "ia-payante", libelle: "etape 8 en reel : « Combien de cloisons au niveau 3 ? » et « Combien de trucs au niveau 2 ? » (2 appels, environ 0,02 $)", raison: "le harnais simule la reponse du modele ; sa comprehension reelle et la duree de 2 a 4 s ne sont pas mesurees" },
  // ---- Test 2 : Discussions ----
  { numero: 2, categorie: "ia-payante", libelle: "qualite reelle du classement par sujet et du rapport (5 appels, environ 0,10 $) ; aucune decision inventee par le vrai modele (bogue grave si oui)", raison: "le simulateur renvoie une synthese sourcee fidele ; le verificateur de l'application (sources, chiffres, decision) est teste, pas le modele. Outil d'essai reel journalise : node tools/essaiRecapDiscussions.mjs" },
  { numero: 2, categorie: "rendu", libelle: "lisibilite du PDF du rapport et placement du bandeau « Est-ce bien votre demande ? » par rapport a la fenetre du rapport", raison: "le harnais mesure le non-recouvrement des rectangles et lit le texte du PDF ; le rendu graphique reste a l'oeil" },
  { numero: 2, categorie: "fichier-reel", libelle: "« Copier » : le presse-papiers recoit le texte du rapport", raison: "WebKit/Playwright n'accorde pas l'acces au presse-papiers sans geste reel ; l'assertion est marquee « sautee » si le bouton ne passe pas a « Copie »" },
  // ---- Test 3 / 4 : 2D -> 3D ----
  { numero: 3, categorie: "rendu", libelle: "noms et surfaces lisibles et tenant dans chaque piece (y compris le WC), alignement du plan redessine sur l'image, rendu de l'oeil de visibilite", raison: "le harnais lit les valeurs (noms, surfaces, opacites, viewBox), pas les pixels" },
  { numero: 3, categorie: "tactile", libelle: "glisser un angle de mur de 50 cm a la souris et verifier que les murs relies suivent (R-81)", raison: "geste de glissement (pointerdown, pointermove, pointerup) pas encore ecrit dans le harnais ; faisable avec la souris Playwright, a ajouter si Gilles le demande" },
  { numero: 4, categorie: "fichier-reel", libelle: "import d'un PDF de plan reel, multipage, et d'un gros PDF (lenteur, memoire)", raison: "aucun PDF de plan n'existe dans le vault ni le depot ; le harnais fabrique un PDF de 2 pages (jsPDF) qui teste la mecanique multipage, pas un plan d'architecte ni la tenue en charge" },
  { numero: 4, categorie: "masque", libelle: "trace de murs et de pieces (R-84, R-85, R-86) et outils Porte / Fenetre / Coulissante (R-75)", raison: "outils retires de la barre d'outils par l'interrupteur MASQUE_DESSIN_PLAN (src/plan3d/plan3dPage.js, 27/10) : sans objet tant qu'il est vrai. Les assertions sont « sautees » avec cette raison et se reactivent d'elles-memes si les boutons reviennent (la trace par clics restera alors a scripter)" },
  // ---- Test 5 : IA du plan ----
  { numero: 5, categorie: "ia-payante", libelle: "tout Test 5 en reel : 6 appels, environ 0,09 $ (qualite de comprehension, compte rendu exact, duree de 2 a 4 s, resistance a l'injection R-110)", raison: "le harnais simule les reponses du modele et verifie ce que l'application en fait. Outil d'essai reel journalise : node tools/essaiIAPlan.mjs" },
  // ---- Test 6 : Voir en 3D ----
  { numero: 6, categorie: "rendu", libelle: "cadrage, dalle presente, 7 noms de pieces au sol lisibles et dans le bon sens, inversion de coupe haut/bas, taille des noms (decision 10 de passe-propre)", raison: "rendu graphique ; le harnais verifie la maquette chargee, la projection (ortho/perspective), la coupe horizontale, le retour et la disparition de la maquette" },
  { numero: 6, categorie: "ia-payante", libelle: "etape 8 : « Affiche uniquement les murs » sur la maquette du plan (1 appel)", raison: "types, niveaux et noms viennent de l'hopital : resultat vide ou « Critere introuvable » est une limite connue (passe-propre) ; non joue" },
  // ---- Test 7 : Viewer par IA ----
  { numero: 7, categorie: "rendu", libelle: "contraste de la surbrillance, transparence des murs, fantome autour de la vanne", raison: "le harnais lit l'etat de la scene (surbrillance, opacite, visibilite par type), pas le rendu" },
  { numero: 7, categorie: "ia-payante", libelle: "qualite reelle des relectures (« tuyaux du niveau 4 », « gaines et vannes du niveau 3 »), durees de 2 a 4 s, vanne introuvable (2 appels, environ 0,05 $)", raison: "reponses simulees" },
  { numero: 7, categorie: "masque", libelle: "zone nommee « Bloc operatoire » (R-34)", raison: "bouton « Zone » masque par l'interrupteur MASQUE_ZONES (src/main.js, 27/10) : assertion « sautee »" },
  // ---- Test 9 / 10 : iPhone ----
  { numero: 9, categorie: "tactile", libelle: "fermer le tiroir « ☰ Afficher » en glissant vers le bas ; toucher un element pour « Info sélection » ; defiler le tableau et le rapport au doigt (page de dessous immobile) ; ouvrir le tiroir au doigt", raison: "gestes tactiles reels (glissement, inertie, geste de bord) non reproduits par l'emulation WebKit ; le harnais mesure les rectangles, les tailles de cibles et la position des feuilles" },
  { numero: 9, categorie: "tactile", libelle: "telechargements Excel et PDF sur Safari iOS (ouverture dans Safari, feuille de partage ou echec)", raison: "comportement propre a iOS ; le harnais verifie seulement que le telechargement se declenche et que le PDF est un A4 valide" },
  { numero: 10, categorie: "tactile", libelle: "zoom au pincement a deux doigts (R-126), glisser un angle au doigt (R-130), tracer un mur avec « Terminer » (R-129, outil masque)", raison: "geste multi-touch reel ; le module de calcul du pincement a des tests unitaires (tests/plan3dPincement.test.js)" },
  { numero: 10, categorie: "tactile", libelle: "clavier virtuel d'iOS : il ne doit masquer ni le champ ni « Valider » ; plein ecran iOS et barres de Safari ; rotation paysage puis retour portrait (R-134)", raison: "clavier et barres de Safari absents de WebKit/Playwright ; le paysage n'est pas prevu (decision du 21/10)" },
  { numero: 10, categorie: "fichier-reel", libelle: "importer l'image et le PDF depuis Photos ou Fichiers de l'iPhone (R-131)", raison: "selecteur de fichiers iOS reel ; le harnais injecte un fichier par setInputFiles" },
  // ---- Hors Tests : dictee, demo ----
  { numero: null, categorie: "dictee", libelle: "dictee vocale sur laptop (Chrome, R-04), navigateur sans dictee (R-05), dictee iPhone (R-07)", raison: "SpeechRecognition et micro absents de WebKit/Playwright ; les cas « dictee indisponible » et la logique de la modale ont des tests unitaires (tests/reglesVoix.test.js, tests/iaSaisie.test.js). R-01 a R-07 sont d'ailleurs deja valides par Gilles" },
  { numero: 11, categorie: "subjectif", libelle: "impression d'ensemble de la demo du 3/11 : enchainement sans page noire longue, rythme, phrases a repeter, ce que Gilles masquerait", raison: "jugement du presentateur ; non automatisable par nature. La demo n'est pas figee (questions ouvertes dans Projets/Ouvra/figer-3-novembre)" },
  { numero: null, categorie: "ia-payante", libelle: "tout appel reel vers /api/* (par exemple les regles de collision en phrase libre R-20 a R-24, deja validees par Gilles)", raison: "payant (environ 0,0085 $ par appel) et plafonne a 15 $ par mois ; le harnais n'envoie JAMAIS d'appel reel (interception de toute requete /api/*, hors origine abandonnee). Un essai reel se lance a part, avec accord de Gilles, via les outils tools/essai*.mjs qui journalisent le cout" }
];
