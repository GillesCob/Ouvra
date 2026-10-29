// Flou de la demande IA (src/flouDemande.js) : etat pur (pose a l'affichage du bandeau, levee a Oui, Non, erreur, changement de vue) et branchement des quatre pages.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerCoeurFlou } from "../src/flouDemande.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const el = (visible = true) => ({ visible });

test("coeur : le flou est pose a l'affichage du bandeau et leve a Oui, a Non ou a l'erreur (lever)", () => {
  const c = creerCoeurFlou();
  assert.equal(c.actif(), false);
  c.poser("commandes", el());
  assert.equal(c.actif(), true);
  assert.equal(c.lever("commandes"), true); // Oui, Non, erreur : meme levee
  assert.equal(c.actif(), false);
  assert.equal(c.lever("commandes"), false); // lever deux fois ne fait rien
});

test("coeur : deux bandeaux, le flou reste tant qu'il en reste un ; poser deux fois la meme cle ne l'empile pas", () => {
  const c = creerCoeurFlou();
  c.poser("a", el());
  c.poser("a", el());
  c.poser("b", el());
  c.lever("a");
  assert.equal(c.actif(), true);
  c.lever("b");
  assert.equal(c.actif(), false);
});

test("coeur : changement de vue (bandeau masque ou retire) leve le flou par purger", () => {
  const c = creerCoeurFlou();
  const bandeau = el(true);
  c.poser("viewer", bandeau);
  assert.deepEqual(c.purger((e) => e.visible), []);
  assert.equal(c.actif(), true);
  bandeau.visible = false; // la vue change : le bandeau n'est plus affiche
  assert.deepEqual(c.purger((e) => e.visible), ["viewer"]);
  assert.equal(c.actif(), false);
});

test("branchement : chaque bandeau pose le flou a l'affichage et le leve a la disparition", () => {
  for (const [fichier, cle] of [["src/commandesBandeau.js", "id"], ["src/discussionsIABandeau.js", "discussionsBandeau"], ["src/plan3d/plan3dPage.js", "plan3d"]]) {
    const src = lire(fichier);
    assert.match(src, /import \{[^}]*poserFlou[^}]*\} from "\.{1,2}\/flouDemande\.js"/, fichier + " importe le mecanisme partage");
    assert.match(src, /poserFlou\(/, fichier + " pose le flou");
    assert.match(src, /leverFlou\(/, fichier + " leve le flou");
    assert.ok(cle);
  }
  const bandeau = lire("src/commandesBandeau.js");
  assert.match(bandeau, /function masquer[\s\S]*leverFlou/, "masquer (Oui, Non, erreur, changement de vue) leve le flou");
  assert.match(bandeau, /racine\.hidden = false;[\s\S]*poserFlou/, "montrer pose le flou");
});

test("CSS : calque sous le bandeau et au-dessus de la navbar, apparition courte, mouvement reduit respecte", () => {
  const css = lire("src/commandesIA.css");
  assert.match(css, /#flouDemande\s*\{[^}]*position:\s*fixed[^}]*backdrop-filter:\s*blur/);
  assert.match(css, /-webkit-backdrop-filter/);
  const z = (re) => Number((css.match(re) || [])[1]);
  const calque = z(/#flouDemande\s*\{[^}]*z-index:\s*(\d+)/);
  const bandeaux = z(/body\.flou-demande-actif\s+#commandesBandeau[^{]*\{[^}]*z-index:\s*(\d+)/);
  assert.ok(calque > 60, "au-dessus de la navbar (60)");
  assert.ok(bandeaux > calque, "bandeaux au-dessus du calque");
  assert.match(css, /prefers-reduced-motion[\s\S]*#flouDemande/);
});
