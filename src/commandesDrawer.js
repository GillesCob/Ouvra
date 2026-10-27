// Viewer par commande (24/10) : les cases du drawer « Niveaux / Maquettes » suivent le resultat d'une commande. Calculs purs, sans DOM ni xeokit.
//
// Regle : apres une commande, une maquette est cochee si au moins un de ses elements est visible, un niveau est coche si au moins un de ses elements
// visibles lui appartient ; sinon decoche. Les fonctions rendent de nouveaux etats, rien n'est modifie ici ; main.js les reporte sur MAQUETTES[].shown,
// niveauxState[].checked et les cases du drawer, SANS rappeler applyVisibility (qui redefairait ce que la commande vient d'appliquer).
//
//   etatDrawerDepuisVisibles({ idsParMaquette, niveaux, visibles })
//     idsParMaquette : Map ou objet { idMaquette: [ids des elements] } ; niveaux : [{ name, objectsByMaquette: { idMaquette: [ids] } }]
//     visibles : Set (ou tableau) des ids d'elements visibles dans la scene
//     rend { maquettes: Map idMaquette -> bool, niveaux: Map nom -> bool }
//   capturerEtatDrawer({ maquettes, niveaux }) : meme forme, depuis [{ id, shown }] et [{ name, checked }] (pour « Non » et la sortie du Viewer)

function entrees(source) {
  if (!source) return [];
  return source instanceof Map ? Array.from(source.entries()) : Object.entries(source);
}

export function etatDrawerDepuisVisibles({ idsParMaquette, niveaux = [], visibles }) {
  const visiblesSet = visibles instanceof Set ? visibles : new Set(visibles || []);
  const unVisible = (ids) => Array.isArray(ids) && ids.some((id) => visiblesSet.has(id));
  const maquettes = new Map(entrees(idsParMaquette).map(([id, ids]) => [id, unVisible(ids)]));
  const etatNiveaux = new Map(niveaux.map((niveau) => [
    niveau.name,
    Object.values(niveau.objectsByMaquette || {}).some(unVisible)
  ]));
  return { maquettes, niveaux: etatNiveaux };
}

export function capturerEtatDrawer({ maquettes = [], niveaux = [] }) {
  return {
    maquettes: new Map(maquettes.map((m) => [m.id, !!m.shown])),
    niveaux: new Map(niveaux.map((n) => [n.name, !!n.checked]))
  };
}

// Boite a cadrer apres une commande IA : celle des seuls elements visibles (getAABB = viewer.scene.getAABB). null si rien de visible ou boite invalide.
export function boiteDesVisibles(idsVisibles, getAABB) {
  if (!idsVisibles || idsVisibles.length === 0) return null;
  const boite = getAABB(idsVisibles);
  if (!Array.isArray(boite) || boite.length !== 6 || !boite.every(Number.isFinite)) return null;
  return boite[0] <= boite[3] && boite[1] <= boite[4] && boite[2] <= boite[5] ? boite : null;
}
