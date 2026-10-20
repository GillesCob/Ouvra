// Echantillon de collisions de l'hopital (19/10), pour la page Collision.
//
// Source : sortie brute d'un vrai run IfcClash (mode "collision") entre
// WestRiverSide-Architecture-IFC4.ifc et WestRiverSide-Mechanical-IFC4.ifc,
// fichier Chantier/tools/big-model-test/clashes-hospital.json (3 504
// collisions, script run_clash_hospital.py). Rien n'est invente : GUID, noms,
// classes IFC et point de contact viennent de ce fichier ; seuls le choix des
// 15 lignes, le libelle "zone" (noms Revit sans leur suffixe d'identifiant,
// numero d'element repris entre parentheses, niveau en fin de ligne) et le
// statut (etat de triage de demonstration) sont des choix d'affichage.
//
// Verification des identifiants (19/10) : les entityIds sont les GlobalId IFC
// ; ils ont ete retrouves un a un dans la liste des ids d'entites des XKT v12
// public/models/hospital/architecture.xkt (premier id) et mechanical.xkt
// (second id), ce qui est ce que xeokit utilise comme id d'objet de scene.
//
// Criteres de selection (15 collisions sur 3 504, Architecture contre
// Mecanique/CVC) :
// - lisibles : les deux elements portent un nom, aucun doublon d'element
//   (chaque element d'architecture et de CVC n'apparait qu'une fois), pas de
//   garde-corps ni de petit accessoire sans nom ;
// - repartis sur 6 niveaux (Level 1 a 5 et Level 7A, toiture) ;
// - plusieurs familles de conflits : gaine contre cloison (4), tuyau contre
//   cloison (2), diffuseur/grille contre faux plafond (3), equipement contre
//   cloison (prise de gaz medicaux, caisson VAV, piquage), vanne contre faux
//   plafond, gaine contre mur-rideau, equipement de toiture (tour de
//   refroidissement contre panneau solaire) ;
// - statut mele pour la demonstration : "nouveau" (a traiter), "confirme"
//   (conflit reel retenu) et "ecarte" (diffuseurs/grilles poses dans un faux
//   plafond : intersection voulue par le design, donc ecartee).
//
// Memes champs que DEMO_CLASHES (src/main.js). ifcPoint = milieu de p1/p2 en
// repere IFC Z-up (converti en Y-up a l'affichage par ifcPointToViewer).
// Aucune discussion simulee : IfcClash ne produit que de la geometrie.

export const HOSPITAL_DETECTIONS = [
  { id: "hopital-arch-mep", modeles: ["hosp-arch", "hosp-mep"], label: "Architecture ↔ Mécanique (CVC)" },
  // 20/10 : second couple, avec des collisions FICTIVES (HOSPITAL_CLASHES_FACTICES) pour montrer la mise en page de la liste
  // des couples. Rien n'est calcule : a retirer (ou remplacer par une vraie detection IfcClash) avant toute vraie demonstration.
  { id: "hopital-struct-mep", modeles: ["hosp-struct", "hosp-mep"], label: "Structure ↔ Mécanique (CVC)", exemple: true }
];

// Priorite (19/10, COLLISION_PRIORITES) : "urgente" | "haute" | "normale" |
// "basse" ; valeur par defaut "normale" si absent. Repartition CHOISIE POUR LA
// DEMONSTRATION (pas issue d'IfcClash) : urgentes 2 et 10 (confirmees), hautes
// 1, 5, 6, 15, normales 3, 4, 9, 11, 12, 13, basses 7, 8 (ecartees) et 14.
// Statut (ou en est la collision) et priorite (urgence) sont deux notions
// separees.
export const HOSPITAL_CLASHES = [
  // Level 1 : IfcWallStandardCase (Architecture) contre IfcDuctSegment (Mecanique)
  {
    id: "hosp-clash-1",
    priorite: "haute",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 123mm Partition (#635412) ↔ Round Duct : Taps (#956059) · Level 1",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["02tyyfw351vwZxOF5ISD9J","3G76MC4Pj5yg3O_Eb_pDy$"],
    ifcPoint: [66.047,58.7931,169.6618],
    discussion: []
  },
  // Level 2 : IfcWallStandardCase (Architecture) contre IfcDuctSegment (Mecanique)
  {
    id: "hosp-clash-2",
    priorite: "urgente",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 123mm Partition (#753881) ↔ Rectangular Duct : Mitered Elbows / Taps (#967393) · Level 2",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "confirme",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["1d8rs7_dn4VeMRJrvvg9e$","3E$Lj2RdbFy8XntbU1QWpw"],
    ifcPoint: [2.1541,81.0642,175.9128],
    discussion: []
  },
  // Level 3 : IfcWallStandardCase (Architecture) contre IfcDuctSegment (Mecanique)
  {
    id: "hosp-clash-3",
    priorite: "normale",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 183mm Partition (#564706) ↔ Rectangular Duct : Mitered Elbows / Taps (#822487) · Level 3",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["2Vmr1Ti7jER94ybNBhQISI","2ShiOhijX9CvUx7cIjrNHX"],
    ifcPoint: [60.7859,85.421,180.4924],
    discussion: []
  },
  // Level 5 : IfcWallStandardCase (Architecture) contre IfcDuctSegment (Mecanique)
  {
    id: "hosp-clash-4",
    priorite: "normale",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 183mm Partition (#565338) ↔ Rectangular Duct : Mitered Elbows / Taps (#835400) · Level 5",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["2Vmr1Ti7jER94ybNBhQHgg","0CaEFXSVX2vxEp1b2f0bOF"],
    ifcPoint: [63.5362,115.2952,190.5049],
    discussion: []
  },
  // Level 4 : IfcWallStandardCase (Architecture) contre IfcPipeSegment (Mecanique)
  {
    id: "hosp-clash-5",
    priorite: "haute",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 183mm Partition (#594457) ↔ Pipe Types : Standard (#1135763) · Level 4",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "confirme",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["2QRZsMKYn35ff5LwqHZ$7w","0pMtlmTKPArvWnv3JFYTkp"],
    ifcPoint: [10.8285,116.9038,184.9473],
    discussion: []
  },
  // Level 1 : IfcWallStandardCase (Architecture) contre IfcPipeSegment (Mecanique)
  {
    id: "hosp-clash-6",
    priorite: "haute",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 123mm Partition (#636648) ↔ Pipe Types : Standard (#1166287) · Level 1",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["3ircTiac1Blh9Ab5I8VdeN","3n1jIE7yrENwPiXyMkbaIS"],
    ifcPoint: [58.9698,65.635,168.9473],
    discussion: []
  },
  // Level 2 : IfcCovering (Architecture) contre IfcBuildingElementProxy (Mecanique)
  {
    id: "hosp-clash-7",
    priorite: "basse",
    detectionId: "hopital-arch-mep",
    zone: "Compound Ceiling : 600 x 600mm grid (#711616) ↔ M_Supply Diffuser - Rectangular Face Round Neck - Hosted (#927465) · Level 2",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "ecarte",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["3MIR_i909FB9vn9qCnDswx","0UUg_p$mn6Fe9mHLCdU2_q"],
    ifcPoint: [81.7267,75.0155,174.6132],
    discussion: []
  },
  // Level 4 : IfcCovering (Architecture) contre IfcBuildingElementProxy (Mecanique)
  {
    id: "hosp-clash-8",
    priorite: "basse",
    detectionId: "hopital-arch-mep",
    zone: "Compound Ceiling : Gyp Ceiling (#604677) ↔ M_Exhaust Grill : 600 x 600 Face 300 x 300 Connection (#763905) · Level 4",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "ecarte",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["2mQ4QNTd59f9qNxU4_oelz","0jC3eX7Wj55gspuxnjaECq"],
    ifcPoint: [51.5626,89.4242,184.3682],
    discussion: []
  },
  // Level 1 : IfcCovering (Architecture) contre IfcBuildingElementProxy (Mecanique)
  {
    id: "hosp-clash-9",
    priorite: "normale",
    detectionId: "hopital-arch-mep",
    zone: "Compound Ceiling : 600 x 600mm grid (#708365) ↔ Return Diffuser - Hosted : Workplane-based Return Diffuser (#954314) · Level 1",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["1uAItwbGfF6hhQfTk4IvDZ","1x6TfEQKXD0gdSuVgmPRLz"],
    ifcPoint: [33.156,112.5369,168.3632],
    discussion: []
  },
  // Level 3 : IfcWallStandardCase (Architecture) contre IfcBuildingElementProxy (Mecanique)
  {
    id: "hosp-clash-10",
    priorite: "urgente",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 123mm Partition (#564707) ↔ MedGasOutlet Triple - Hosted : MedGasOutlet Triple - Hosted (#1129899) · Level 3",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "confirme",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["2Vmr1Ti7jER94ybNBhQISJ","2kiAne$$n56eHBJkyVm5uW"],
    ifcPoint: [61.0943,85.8975,177.9721],
    discussion: []
  },
  // Level 1 : IfcWallStandardCase (Architecture) contre IfcBuildingElementProxy (Mecanique)
  {
    id: "hosp-clash-11",
    priorite: "normale",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 123mm Partition (#676149) ↔ M_VAV Unit - Bypass : 250 mm (#990250) · Level 1",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["3GKM_ZECz7W9zLWaxxFO2N","2Y8P3M7$v29Ot0VmFMfbJX"],
    ifcPoint: [19.2892,84.6338,169.7878],
    discussion: []
  },
  // Level 1 : IfcWallStandardCase (Architecture) contre IfcDuctFitting (Mecanique)
  {
    id: "hosp-clash-12",
    priorite: "normale",
    detectionId: "hopital-arch-mep",
    zone: "Basic Wall : Interior - 123mm Partition (#675084) ↔ M_Round Takeoff : Standard (#960125) · Level 1",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["3GKM_ZECz7W9zLWaxxFPok","2qP17kDeP7DgzqI9A1BDwZ"],
    ifcPoint: [24.457,69.1422,169.6362],
    discussion: []
  },
  // Level 3 : IfcCovering (Architecture) contre IfcValve (Mecanique)
  {
    id: "hosp-clash-13",
    priorite: "normale",
    detectionId: "hopital-arch-mep",
    zone: "Compound Ceiling : 600 x 600mm grid (#618990) ↔ M_Ball Valve - 50-150 mm : 25 mm (#1113336) · Level 3",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["1_U0abofb2x96Zk8Hyv14C","0Da$jOx5510AJAhJy6embe"],
    ifcPoint: [6.2358,118.93,179.6132],
    discussion: []
  },
  // Level 4 : IfcMember (Architecture) contre IfcDuctSegment (Mecanique)
  {
    id: "hosp-clash-14",
    priorite: "basse",
    detectionId: "hopital-arch-mep",
    zone: "Curtain Wall : Storefront (#407) ↔ Rectangular Duct : Mitered Elbows / Taps (#854802) · Level 4",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["2pw9duL$jBS82bFqOjndCu","2nt2LYCN9989XGGlsEhRUH"],
    ifcPoint: [61.5709,66.0793,185.0612],
    discussion: []
  },
  // Level 7A : IfcBuildingElementProxy (Architecture) contre IfcBuildingElementProxy (Mecanique)
  {
    id: "hosp-clash-15",
    priorite: "haute",
    detectionId: "hopital-arch-mep",
    zone: "Sunpower E19 Solar Panel : Sunpower E19 Solar Panel (#780569) ↔ Cooling Tower - Closed Circuit - Counterflow - 67-189 kW (#1081253) · Level 7A",
    disciplineA: "Architecture",
    disciplineB: "Mécanique (CVC)",
    severite: "À qualifier",
    statut: "confirme",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["3kAGQjYaL5K8DdxPJdyKEm","1o4ip7curF0OtNjCYAZgKC"],
    ifcPoint: [58.23,121.8773,197.6886],
    discussion: []
  }
];

// Collisions FICTIVES du couple Structure / Mecanique (20/10), pour voir la mise en page d'un second jeu de collisions. Noms et
// identifiants inventes, aucun IfcClash derriere : pas de point 3D ni d'elements (entityIds), donc non cliquables dans la liste
// (factice: true). Meme forme de "zone" que les vraies collisions pour que la liste les affiche pareil.
export const HOSPITAL_CLASHES_FACTICES = [
  { id: "ex-sm-1", priorite: "urgente", statut: "confirme", zone: "Floor : Concrete 250mm (#300114) ↔ Round Duct : Taps (#912004) · Level 2" },
  { id: "ex-sm-2", priorite: "haute", statut: "nouveau", zone: "Structural Column : Concrete-Rectangular 400x400 (#300227) ↔ Rectangular Duct : Mitered Elbows (#912318) · Level 1" },
  { id: "ex-sm-3", priorite: "haute", statut: "nouveau", zone: "Structural Framing : Steel Beam W16x31 (#300391) ↔ Pipe Types : Standard (#912455) · Level 3" },
  { id: "ex-sm-4", priorite: "normale", statut: "nouveau", zone: "Floor : Concrete 250mm (#300118) ↔ Pipe Types : Standard (#912601) · Level 4" },
  { id: "ex-sm-5", priorite: "normale", statut: "confirme", zone: "Structural Framing : Steel Beam W12x26 (#300402) ↔ Round Duct : Taps (#912733) · Level 5" },
  { id: "ex-sm-6", priorite: "normale", statut: "resolu", zone: "Structural Column : Concrete-Rectangular 400x400 (#300230) ↔ Pipe Types : Standard (#912810) · Level 2" },
  { id: "ex-sm-7", priorite: "basse", statut: "ecarte", zone: "Floor : Concrete 250mm (#300121) ↔ Round Duct : Taps (#912944) · Level 6" }
].map((c) => ({
  detectionId: "hopital-struct-mep",
  disciplineA: "Structure",
  disciplineB: "Mécanique (CVC)",
  severite: "À qualifier",
  auteur: "Exemple (données fictives)",
  tagged: [],
  discussion: [],
  factice: true,
  ...c
}));
