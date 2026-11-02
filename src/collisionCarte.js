// Lecture d'une collision pour sa carte (02/11) : types en francais, identifiants Revit et niveau, deduits du libelle « zone » d'une collision.
// Pur (sans DOM, testable sous Node). Partage entre la liste de la page Collision (buildCollisionCard de main.js) et la page « Mon espace » : un seul calcul pour les deux.

// Type d'element en francais, deduit du nom Revit (liste des collisions, 19/10). Repli : premier segment du nom avant « : ».
const COLLISION_TYPES_FR = [
  [/Curtain Wall/i, "Mur-rideau"],
  [/Basic Wall.*Partition/i, "Cloison"],
  [/Basic Wall|Wall/i, "Mur"],
  [/Ceiling/i, "Faux plafond"],
  [/Duct/i, "Gaine"],
  [/Pipe/i, "Tuyau"],
  [/Diffuser/i, "Diffuseur"],
  [/Grill/i, "Grille"],
  [/MedGas/i, "Prise gaz médicaux"],
  [/VAV/i, "Caisson VAV"],
  [/Takeoff/i, "Piquage"],
  [/Valve/i, "Vanne"],
  [/Solar Panel/i, "Panneau solaire"],
  [/Cooling Tower/i, "Tour de refroidissement"]
];

// Libelles affiches du statut et de la priorite d'une collision (main.js y ajoute « Résolu » quand les priorites sont actives).
export const LIBELLES_STATUT_COLLISION = { nouveau: "Nouveau", confirme: "Confirmé", ecarte: "Écarté" };
export const LIBELLES_PRIORITE_COLLISION = { urgente: "Urgente", haute: "Haute", normale: "Normale", basse: "Basse" };

export function collisionTypeFr(name) {
  const hit = COLLISION_TYPES_FR.find(([re]) => re.test(name));
  return hit ? hit[1] : name.split(":")[0].trim();
}

// « Type A (#idA) ↔ Type B (#idB) · Level N » -> { typeA, typeB, ids: ["#idA", "#idB"], niveau, titre, sousTitre }, ou null si la zone n'a pas deux identifiants.
export function decrireCarteCollision(zone) {
  const ids = (String(zone).match(/\(#(\d+)\)/g) || []).map((m) => m.slice(1, -1));
  if (ids.length !== 2) return null;
  const niveauBrut = String(zone).match(/·\s*([^·]+)$/);
  const niveau = (niveauBrut ? niveauBrut[1].trim() : "").replace(/^Level\s*/i, "Niveau ");
  const [partA, partB] = String(zone).split(" ↔ ");
  const typeA = collisionTypeFr(partA || "");
  const typeB = collisionTypeFr((partB || "").split("·")[0]);
  return { typeA, typeB, ids, niveau, titre: typeA + " ↔ " + typeB, sousTitre: ids[0] + " ↔ " + ids[1] + (niveau ? " · " + niveau : "") };
}
