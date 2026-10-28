// Interface des retours de visiteurs (28/10) : bouton « Bug ou idée ? » (barre de navigation) -> modale -> POST /api/retour. Logique pure testee ici ;
// le comportement de la modale est verifie a part dans un navigateur.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpsRetour, libellePage, messageEchec, envoyerRetour, placeholderRetour, MESSAGE_MAX } from "../src/retourVisiteur.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("corpsRetour : type, message nettoye, page, contact et piege tels que la route les attend", () => {
  assert.deepEqual(corpsRetour({ type: "idee", message: "  Un mode sombre  ", contact: " a@b.fr ", page: "Viewer", site: "" }), { type: "idee", message: "Un mode sombre", contact: "a@b.fr", page: "Viewer", site: "" });
  assert.equal(corpsRetour({ type: "bug", message: "x".repeat(MESSAGE_MAX + 50) }).message.length, MESSAGE_MAX);
  assert.equal(corpsRetour({ type: "bug", message: "x" }).site, "");
});

test("libellePage : nom lisible de la vue, repli sur la vue brute, jamais vide", () => {
  assert.equal(libellePage("discussions"), "Discussions");
  assert.equal(libellePage("plan3d"), "2D → 3D");
  assert.equal(libellePage("inconnue"), "inconnue");
  assert.equal(libellePage(""), "Application");
  assert.equal(libellePage(null), "Application");
});

test("messageEchec : un message clair par cas, celui du serveur quand il est fourni, jamais de detail technique", () => {
  assert.match(messageEchec(400, { message: "Écris ton retour." }), /Écris ton retour/);
  assert.match(messageEchec(429, { message: "Tu as envoyé beaucoup de retours. Réessaie dans 30 secondes." }), /30 secondes/);
  assert.match(messageEchec(503, { code: "retours_indisponibles" }), /pas disponible/);
  assert.match(messageEchec(502, {}), /Réessaie/);
  assert.match(messageEchec(0, null), /connexion|Réessaie/i);
  assert.match(messageEchec(500, "<html>erreur</html>"), /Réessaie/);
});

test("envoyerRetour : POST JSON vers /api/retour ; succes -> ok ; refus serveur -> message ; panne reseau -> message", async () => {
  const appels = [];
  const ok = await envoyerRetour({ type: "bug", message: "m", contact: "", page: "p", site: "" }, { fetch: async (u, i) => { appels.push({ u, i }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } });
  assert.deepEqual(ok, { ok: true });
  assert.equal(appels[0].u, "/api/retour");
  assert.equal(appels[0].i.method, "POST");
  assert.equal(JSON.parse(appels[0].i.body).type, "bug");
  const refus = await envoyerRetour({ type: "bug", message: "m" }, { fetch: async () => ({ ok: false, status: 429, json: async () => ({ ok: false, message: "Réessaie dans 20 secondes." }) }) });
  assert.equal(refus.ok, false);
  assert.match(refus.message, /20 secondes/);
  const panne = await envoyerRetour({ type: "bug", message: "m" }, { fetch: async () => { throw new Error("hors ligne"); } });
  assert.equal(panne.ok, false);
  assert.equal(typeof panne.message, "string");
});

test("page : le bouton est dans la barre de navigation, hors des onglets (.nav-link) ; branche dans main.js ; route montee en local", () => {
  const html = lire("index.html");
  // Deux exemplaires, un seul visible a la fois : dans la barre (ordinateur, a droite, loin de « Me contacter » centre) et dans le menu ☰ (mobile).
  assert.match(html, /<button type="button" class="nav-avis" id="navbarAvisBarre">Bug ou idée \?<\/button>/);
  assert.match(html, /<button type="button" class="nav-avis" id="navbarAvisTiroir">Bug ou idée \?<\/button>/);
  assert.ok(html.indexOf('id="navbarAvisBarre"') > html.indexOf("</nav>") && html.indexOf('id="navbarAvisBarre"') < html.indexOf('id="projectSelect"'), "exemplaire de la barre apres le menu, hors du menu");
  assert.ok(html.indexOf('id="navbarAvisTiroir"') < html.indexOf("</nav>"), "exemplaire du tiroir dans le menu");
  assert.equal(/class="nav-link[^"]*" id="navbarAvis/.test(html), false);
  assert.ok(lire("src/main.js").includes("creerRetourVisiteur(") && lire("src/main.js").includes('querySelectorAll(".nav-avis")'));
  assert.ok(lire("tools/viteRelaisIA.js").includes('"/api/retour"'));
});

test("modale : piege a robots invisible, e-mail facultatif, aucun tiret quadratin", () => {
  const code = lire("src/retourVisiteur.js");
  assert.ok(code.includes('name = "site"') && code.includes('tabIndex = -1') && code.includes('aria-hidden'));
  assert.equal(code.includes(String.fromCharCode(0x2014)), false);
  assert.equal(lire("src/retourVisiteur.css").includes(String.fromCharCode(0x2014)), false);
});

test("placeholderRetour : un texte d'aide different pour un bug et pour une idee, jamais vide", () => {
  const bug = placeholderRetour("bug");
  const idee = placeholderRetour("idee");
  assert.notEqual(bug, idee);
  assert.match(bug, /attendais|passé/i);
  assert.match(idee, /idée|permettrait/i);
  assert.equal(placeholderRetour("autre"), idee, "type inconnu : texte de l'idee (le plus general)");
});

test("modale : le choix Bug / Idee reprend la pastille qui glisse de la barre de navigation (memes valeurs que #navbarThumb)", () => {
  const css = lire("src/retourVisiteur.css");
  const barre = lire("src/style.css");
  const bloc = (texte, selecteur) => texte.slice(texte.indexOf(selecteur), texte.indexOf("}", texte.indexOf(selecteur)));
  const thumb = bloc(barre, "#navbarThumb {");
  const pastille = bloc(css, ".retour-pastille {");
  for (const valeur of ["border-radius: 6px", "background: color-mix(in srgb, var(--accent) 24%, transparent)", "border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent)", "transition: transform 0.3s ease, width 0.3s ease"]) {
    assert.ok(thumb.includes(valeur), "valeur absente de #navbarThumb : " + valeur);
    assert.ok(pastille.includes(valeur), "valeur absente de .retour-pastille : " + valeur);
  }
  const code = lire("src/retourVisiteur.js");
  assert.ok(code.includes("retour-pastille") && code.includes("offsetLeft") && code.includes("offsetWidth"), "pastille placee comme placerPastilleNavbar");
  assert.ok(code.includes("placeholderRetour(") && code.includes('addEventListener("change"'));
});

test("libelle : « Bug ou idée ? » (les deux choix de la modale), titre « Un bug, une idée ? », plus aucune trace des anciens noms", () => {
  const code = lire("src/retourVisiteur.js");
  assert.ok(code.includes('creer("h2", "retour-titre", "Un bug, une idée ?")'));
  for (const f of ["index.html", "src/retourVisiteur.js", "src/retourVisiteur.css", "src/main.js", "src/style.css", "tests/retour.test.js", "tests/navbarSeuil.test.js"]) {
    const texte = lire(f);
    assert.equal(texte.includes("Donner mon " + "avis"), false, f + " : ancien nom");
    assert.equal(texte.includes("Faire un " + "retour"), false, f + " : nom intermediaire");
  }
});
