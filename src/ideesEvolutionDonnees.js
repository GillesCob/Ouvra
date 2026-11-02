// Donnees de la page « Idees d'evolution » (portage de vault-perso/Projets/Ouvra/mockups/ouvra-idees-fonctionnalites.html, 02/11).
// Quatre frises-scenarios : contenu pur, rendu par src/ideesEvolutionRendu.js. Pas de donnee de projet ici, seulement des idees a evoquer.
// type d'un noeud : "humain" (rond neutre), "auto" (pastille Auto), "ia" (pastille IA), "ouvert" (suite non definie, rond en pointilles).
// lien : navigation interne (vue de l'application), jamais un fichier .html.

export const TYPES_NOEUD = ["humain", "auto", "ia", "ouvert"];

// Icones : contenu des <symbol viewBox="0 0 24 24"> du mockup (traits, une seule epaisseur posee par le CSS).
export const ICONES = {
  mic: "<rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5 11a7 7 0 0 0 14 0M12 18v3\"/>",
  wave: "<path d=\"M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4\"/>",
  text: "<path d=\"M4 6h16M4 11h16M4 16h10\"/>",
  screen: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M8 20h8M12 16v4\"/>",
  report: "<path d=\"M6 3h8l4 4v14H6z\"/><path d=\"M14 3v4h4\"/><path d=\"M9 17v-3M12 17v-5M15 17v-2\"/>",
  tasks: "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14 9.5h3M14 15.5h3\"/>",
  export: "<path d=\"M12 15V3M7 8l5-5 5 5\"/><path d=\"M4 14v6h16v-6\"/>",
  inbox: "<path d=\"M3 13l3-8h12l3 8v6H3z\"/><path d=\"M3 13h5l1 3h6l1-3h5\"/>",
  cloud: "<path d=\"M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5\"/><path d=\"M12 21v-8M9 15.5l3-3 3 3\"/>",
  refresh: "<path d=\"M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3\"/><path d=\"M18 3v4h-4M6 21v-4h4\"/>",
  search: "<circle cx=\"10\" cy=\"10\" r=\"6\"/><path d=\"M15 15l6 6\"/>",
  compare: "<path d=\"M4 8h14M14 4l4 4-4 4\"/><path d=\"M20 16H6M10 12l-4 4 4 4\"/>",
  dots: "<circle cx=\"5\" cy=\"12\" r=\"1.6\"/><circle cx=\"12\" cy=\"12\" r=\"1.6\"/><circle cx=\"19\" cy=\"12\" r=\"1.6\"/>",
  cursor: "<path d=\"M5 3l6 16 2.5-6.5L20 10z\"/>",
  eye: "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  link: "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>",
  bubble: "<path d=\"M4 5h16v11H10l-4 4v-4H4z\"/>",
  check: "<path d=\"M5 12.5l4.5 4.5L19 7\"/>",
  pencil: "<path d=\"M4 20l1-4L16 5l3 3L8 19z\"/><path d=\"M14 7l3 3\"/>",
  wand: "<path d=\"M5 19L17 7\"/><path d=\"M15 5l4 4\"/><path d=\"M19 2v3M17.5 3.5h3M6 3v2.5M4.75 4.25h2.5\"/>",
};

export const SCENARIOS = [
  {
    batiment: "batiment-estime-4-construire.svg",
    titre: "Réunion de synthèse",
    noeuds: [
      { type: "humain", icone: "mic", label: "Réunion de synthèse", sub: "Sujets tirés des conversations" },
      { type: "auto", icone: "wave", label: "Écoute de l'échange" },
      { type: "ia", icone: "text", label: "Retranscription" },
      { type: "auto", icone: "report", label: "Rapport automatisé" },
      { type: "ia", icone: "tasks", label: "Tâches projeteurs" },
      { type: "humain", icone: "export", label: "Export vers Revit" }
    ]
  },
  {
    batiment: "batiment-estime-3-preparer.svg",
    titre: "Mise à jour des maquettes",
    noeuds: [
      { type: "humain", icone: "inbox", label: "Maquette mise à jour" },
      { type: "humain", icone: "cloud", label: "Dépôt sur la GED" },
      { type: "auto", icone: "refresh", label: "Mise à jour d'Ouvra" },
      { type: "ia", icone: "wand", label: "L'IA comprend la convention", sub: "et choisit les outils d'analyse" },
      { type: "ia", icone: "search", label: "Analyse selon la convention" },
      { type: "auto", icone: "compare", label: "Rapport des écarts (GUID)" },
      { type: "ouvert", icone: "dots", srSeul: "Suite non définie" }
    ]
  },
  {
    batiment: "batiment-estime-2-consulter.svg",
    titre: "Lien vers les documents de la GED",
    noeuds: [
      { type: "humain", icone: "cursor", label: "Je sélectionne un élément de la maquette" },
      { type: "ia", icone: "link", label: "Documents de la GED reliés à l'élément" },
      { type: "auto", icone: "cloud", label: "Un lien pour l'ouvrir dans la GED" },
      { type: "auto", icone: "export", label: "Ou téléchargement direct depuis Ouvra" }
    ]
  },
  {
    batiment: "batiment-estime-2-consulter.svg",
    titre: "Échéances tirées des discussions",
    noeuds: [
      { type: "humain", icone: "bubble", label: "Discussions de l'équipe" },
      { type: "ia", icone: "search", label: "L'IA repère dates et engagements" },
      { type: "humain", icone: "check", label: "Je valide" },
      { type: "auto", icone: "tasks", label: "Échéances dans mon planning" },
      { type: "auto", icone: "refresh", label: "Rappel avant la date" }
    ]
  },
  {
    batiment: "batiment-estime-3-preparer.svg",
    titre: "Un dashboard personnalisé",
    noeuds: [
      { type: "humain", icone: "mic", label: "Je dis ce que je veux" },
      { type: "ia", icone: "wand", label: "L'IA comprend" },
      { type: "auto", icone: "screen", label: "Ma page se compose" },
      { type: "auto", icone: "eye", label: "Vues, alertes et documents suivis" },
      { type: "ia", icone: "tasks", label: "Todo tirée des échanges" },
      { type: "humain", icone: "pencil", label: "J'ajuste par une phrase" }
    ],
    lien: { vue: "espace", texte: "Voir la page personnelle →" }
  },
];

