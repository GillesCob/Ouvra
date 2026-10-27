// Viewer par commande (24/10) : le journal d'une presentation. Chaque changement d'etat d'un groupe d'elements (visibilite, opacite, fantome xray,
// aretes, surbrillance, materiau xray global) passe par lui ; il retient la valeur d'ORIGINE de chaque element la premiere fois qu'il le touche
// et sait tout rendre exactement (annuler), meme si une presentation touche plusieurs fois le meme element.
// Module sans dependance a main.js ni au DOM : la scene (xeokit ou fausse scene de test) est passee en parametre.

// propriete de l'objet xeokit -> methode de groupe de la scene
const PROPRIETES = {
  visible: "setObjectsVisible",
  opacity: "setObjectsOpacity",
  xrayed: "setObjectsXRayed",
  edges: "setObjectsEdges",
  highlighted: "setObjectsHighlighted"
};
const CHAMPS_MATERIAU_XRAY = ["fillAlpha", "edgeAlpha", "fillColor", "edgeColor"];

export function creerJournal(scene) {
  const origines = {}; // propriete -> Map(id -> valeur d'origine)
  let materiauOrigine = null;

  function changer(propriete, ids, valeur) {
    if (!ids || !ids.length) return;
    const memoire = origines[propriete] || (origines[propriete] = new Map());
    const aChanger = [];
    for (const id of ids) {
      const objet = scene.objects[id];
      if (!objet) continue;
      if (!memoire.has(id)) memoire.set(id, objet[propriete]);
      if (objet[propriete] !== valeur) aChanger.push(id);
    }
    if (aChanger.length) scene[PROPRIETES[propriete]](aChanger, valeur);
  }

  function annuler() {
    for (const [propriete, memoire] of Object.entries(origines)) {
      const parValeur = new Map();
      for (const [id, valeur] of memoire) {
        if (!parValeur.has(valeur)) parValeur.set(valeur, []);
        parValeur.get(valeur).push(id);
      }
      for (const [valeur, ids] of parValeur) scene[PROPRIETES[propriete]](ids, valeur);
      delete origines[propriete];
    }
    if (materiauOrigine && scene.xrayMaterial) {
      for (const champ of CHAMPS_MATERIAU_XRAY) scene.xrayMaterial[champ] = materiauOrigine[champ];
    }
    materiauOrigine = null;
  }

  // Regle le materiau xray GLOBAL (fantome des elements en x-ray) ; l'original est retenu une seule fois.
  function materielXray(valeurs) {
    const materiau = scene.xrayMaterial;
    if (!materiau) return;
    if (!materiauOrigine) {
      materiauOrigine = {};
      for (const champ of CHAMPS_MATERIAU_XRAY) materiauOrigine[champ] = Array.isArray(materiau[champ]) || ArrayBuffer.isView(materiau[champ]) ? Array.from(materiau[champ]) : materiau[champ];
    }
    for (const champ of CHAMPS_MATERIAU_XRAY) if (valeurs[champ] !== undefined) materiau[champ] = valeurs[champ];
  }

  return {
    visible: (ids, v) => changer("visible", ids, v),
    opacite: (ids, o) => changer("opacity", ids, o),
    fantome: (ids, v) => changer("xrayed", ids, v),
    aretes: (ids, v) => changer("edges", ids, v),
    surbrillance: (ids, v) => changer("highlighted", ids, v),
    materielXray,
    annuler
  };
}
