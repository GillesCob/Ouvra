// Images des collisions dans la modale « Regle a valider » (etape 4 des regles de collision, decision du 22/10) : une vue 3D par collision, generee une
// fois et rangee dans le projet (public/images/vues/, meme banque que les vignettes de Discussions, voir src/messagerie/vuesMessagerie.js), jamais
// rendue a l'ouverture de la modale. Sans image pour une collision : null, la ligne garde un espace vide a cote de « Voir en 3D ».
// Fonctions pures : la banque (index.json lu par chargerBanque) est fournie par l'appelant.

const ID_SUR = /^[A-Za-z0-9_-]{1,64}$/; // meme regle que le plugin qui ecrit les JPEG (tools/viteRecolteVues.js)

// banque : [{ id, version }] ; base : import.meta.env.BASE_URL. Rend l'adresse du JPEG de la collision, ou null.
export function urlVueCollision(banque, clashId, base = "/") {
  if (!Array.isArray(banque) || typeof clashId !== "string" || !ID_SUR.test(clashId)) return null;
  const entree = banque.find((v) => v && v.id === clashId);
  if (!entree) return null;
  return base + "images/vues/" + clashId + ".jpg" + (entree.version ? "?v=" + encodeURIComponent(entree.version) : "");
}

// Collisions [{ id }] qui n'ont pas encore d'image dans la banque.
export function collisionsSansVue(banque, clashes) {
  return (clashes || []).filter((c) => urlVueCollision(banque, c.id) === null);
}
