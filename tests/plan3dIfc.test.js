// 2D -> 3D (25/10) : export IFC4 (src/plan3d/exportIfc.js). Verifie la structure du texte STEP ; la relecture par un vrai lecteur IFC (web-ifc)
// est faite a part, voir le compte rendu de session.
import test from "node:test";
import assert from "node:assert/strict";
import { genererIfc, guidIfc, texteStep, reel } from "../src/plan3d/exportIfc.js";
import { creerModeleVide, ajouterNoeud, ajouterMur, ajouterOuverture, ajouterPiece, definirInfo } from "../src/plan3d/modele.js";

const DATE = new Date("2026-10-25T12:00:00Z");

function maison() {
  let m = creerModeleVide();
  const ids = [];
  for (const [x, y] of [[0, 0], [4, 0], [4, 3], [0, 3], [2, 0], [2, 3]]) { const r = ajouterNoeud(m, x, y); m = r.modele; ids.push(r.id); }
  const [n1, n2, n3, n4, n5, n6] = ids;
  for (const [a, b, type] of [[n1, n5, "exterieur"], [n5, n2, "exterieur"], [n2, n3, "exterieur"], [n3, n6, "exterieur"], [n6, n4, "exterieur"], [n4, n1, "exterieur"], [n5, n6, "interieur"]]) {
    m = ajouterMur(m, a, b, { type }).modele;
  }
  m = ajouterOuverture(m, "M2", "fenetre", 1).modele;
  m = ajouterOuverture(m, "M7", "porte", 1.5).modele;
  m = ajouterPiece(m, "Séjour d'été", [{ x: 0.1, y: 0.1 }, { x: 1.9, y: 0.1 }, { x: 1.9, y: 2.9 }, { x: 0.1, y: 2.9 }], 5.2).modele;
  m = ajouterPiece(m, "Chambre", [{ x: 2.1, y: 0.1 }, { x: 3.9, y: 0.1 }, { x: 3.9, y: 2.9 }, { x: 2.1, y: 2.9 }]).modele;
  return m;
}
const compter = (ifc, type) => ifc.split("\n").filter((l) => new RegExp(`^#\\d+=${type}\\(`).test(l)).length;

test("guidIfc : 22 caracteres du jeu IFC, stable, different selon la cle", () => {
  const g = guidIfc("mur-M1");
  assert.match(g, /^[0-3][0-9A-Za-z_$]{21}$/);
  assert.equal(guidIfc("mur-M1"), g);
  assert.notEqual(guidIfc("mur-M2"), g);
  assert.match(guidIfc(""), /^[0-3][0-9A-Za-z_$]{21}$/);
});

test("texteStep et reel : accents, apostrophe, antislash, point decimal", () => {
  assert.equal(texteStep("Mur M1"), "'Mur M1'");
  assert.equal(texteStep("Séjour"), "'S\\X2\\00E9\\X0\\jour'");
  assert.equal(texteStep("l'été"), "'l''\\X2\\00E9\\X0\\t\\X2\\00E9\\X0\\'");
  assert.equal(texteStep("a\\b"), "'a\\\\b'");
  assert.equal(texteStep(""), "''");
  assert.equal(reel(3), "3.");
  assert.equal(reel(0.5), "0.5");
  assert.equal(reel(-0), "0.");
  assert.equal(reel(1.23456789), "1.234568");
  assert.equal(reel(1e-12), "0.");
});

test("genererIfc : entete IFC4, entites numerotees sans doublon, parentheses equilibrees, que de l'ASCII", () => {
  const ifc = genererIfc(maison(), { date: DATE });
  assert.ok(ifc.startsWith("ISO-10303-21;\nHEADER;"));
  assert.ok(ifc.includes("FILE_SCHEMA(('IFC4'));"));
  assert.ok(ifc.trimEnd().endsWith("END-ISO-10303-21;"));
  const lignes = ifc.split("\n").filter((l) => l.startsWith("#"));
  const ids = lignes.map((l) => l.match(/^#(\d+)=/)[1]);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach((id, i) => assert.equal(Number(id), i + 1));
  for (const l of lignes) {
    assert.equal((l.match(/\(/g) || []).length, (l.match(/\)/g) || []).length, l);
    assert.ok(l.endsWith(";"), l);
    for (const ref of l.match(/#\d+/g).slice(1)) assert.ok(Number(ref.slice(1)) <= ids.length, `reference inconnue ${ref} dans ${l}`);
  }
  assert.ok(!/[^\x00-\x7F]/.test(ifc), "aucun caractere hors ASCII");
});

test("genererIfc : un element IFC par element du modele, avec les pieces en IfcSpace", () => {
  const ifc = genererIfc(maison(), { date: DATE });
  assert.equal(compter(ifc, "IFCPROJECT"), 1);
  assert.equal(compter(ifc, "IFCSITE"), 1);
  assert.equal(compter(ifc, "IFCBUILDING"), 1);
  assert.equal(compter(ifc, "IFCBUILDINGSTOREY"), 1);
  assert.equal(compter(ifc, "IFCWALL"), 7);
  assert.equal(compter(ifc, "IFCSLAB"), 1);
  assert.equal(compter(ifc, "IFCOPENINGELEMENT"), 2);
  assert.equal(compter(ifc, "IFCWINDOW"), 1);
  assert.equal(compter(ifc, "IFCDOOR"), 1);
  assert.equal(compter(ifc, "IFCRELVOIDSELEMENT"), 2);
  assert.equal(compter(ifc, "IFCRELFILLSELEMENT"), 2);
  assert.equal(compter(ifc, "IFCSPACE"), 2);
  assert.ok(ifc.includes("IFCSPACE("));
  assert.ok(ifc.includes("'S\\X2\\00E9\\X0\\jour d''\\X2\\00E9\\X0\\t\\X2\\00E9\\X0\\'"), "nom de piece accentue echappe");
  // surface calculee : 1.8 x 2.8 = 5.04 ; surface lue sur le plan 5.2 gardee a part
  assert.ok(ifc.includes("IFCQUANTITYAREA('NetFloorArea',$,$,5.04,$)"));
  assert.ok(ifc.includes("IFCAREAMEASURE(5.2)"));
  assert.equal((ifc.match(/IFCAREAMEASURE/g) || []).length, 1, "pas de surface lue pour la piece sans surfacePlan");
});

test("genererIfc : meme modele, meme fichier ; modele vide et modele sans pieces restent exportables", () => {
  const m = maison();
  assert.equal(genererIfc(m, { date: DATE }), genererIfc(m, { date: DATE }));
  const vide = genererIfc(creerModeleVide(), { date: DATE });
  assert.equal(compter(vide, "IFCWALL"), 0);
  assert.equal(compter(vide, "IFCSPACE"), 0);
  assert.equal(compter(vide, "IFCBUILDINGSTOREY"), 1);
  assert.ok(!vide.includes("IFCRELCONTAINEDINSPATIALSTRUCTURE"));
  const sansPieces = { ...m };
  delete sansPieces.pieces;
  assert.equal(compter(genererIfc(sansPieces, { date: DATE }), "IFCSPACE"), 0);
});

test("genererIfc : les informations libres deviennent un jeu Ouvra_Infos sur l'element, rien sans information", () => {
  const sans = genererIfc(maison(), { date: DATE });
  assert.ok(!sans.includes("Ouvra_Infos"));
  let m = definirInfo(maison(), "mur", "M1", "Matériau", "Béton d'agglo");
  m = definirInfo(m, "piece", "P1", "Usage", "Séjour");
  m = definirInfo(m, "ouverture", "O1", "Vitrage", "Double");
  const ifc = genererIfc(m, { date: DATE });
  assert.equal((ifc.match(/'Ouvra_Infos'/g) || []).length, 3);
  assert.ok(ifc.includes("IFCPROPERTYSINGLEVALUE('Mat\\X2\\00E9\\X0\\riau',$,IFCTEXT('B\\X2\\00E9\\X0\\ton d''agglo'),$)"));
  assert.ok(!/[^\x00-\x7F]/.test(ifc));
});

test("genererIfc : le haut du plan est le nord, y est inverse a l'ecriture", () => {
  let m = creerModeleVide();
  const a = ajouterNoeud(m, 1, 2); m = a.modele;
  const b = ajouterNoeud(m, 5, 2); m = b.modele;
  m = ajouterMur(m, a.id, b.id, { type: "exterieur" }).modele;
  const ifc = genererIfc(m, { date: DATE });
  assert.ok(ifc.includes("IFCCARTESIANPOINT((1.,-2.,0.))"), "origine du mur : y du plan 2 devient -2");
  assert.ok(!ifc.includes("-0.,"), "pas de -0 dans le fichier");
  assert.ok(ifc.includes("IFCDIRECTION((1.,0.,0.))"));
  const pt = (m2) => genererIfc(m2, { date: DATE });
  const sud = ajouterNoeud(m, 1, 6); // plus bas sur le plan = plus au sud = y IFC plus petit : un mur vers le bas du plan va vers -y
  assert.ok(pt(ajouterMur(sud.modele, a.id, sud.id, { type: "interieur" }).modele).includes("IFCDIRECTION((0.,-1.,0.))"));
});

test("IFC : une porte coulissante est une IfcDoor SLIDING, sans changer le nombre de portes", async () => {
  const { genererIfc } = await import("../src/plan3d/exportIfc.js");
  const { ajouterOuverture, modifierOuverture } = await import("../src/plan3d/modele.js");
  const base = { unite: "m", fond: null, niveau: { nom: "RDC", hauteur: 2.5, epaisseurDalle: 0.2 }, noeuds: [{ id: "N1", x: 0, y: 0 }, { id: "N2", x: 5, y: 0 }], murs: [{ id: "M1", a: "N1", b: "N2", epaisseur: 0.1, type: "interieur" }], ouvertures: [], pieces: [] };
  const r = ajouterOuverture(base, "M1", "coulissante", 2.5);
  assert.ok(r.id);
  const ifc = genererIfc(r.modele);
  assert.match(ifc, /IFCDOOR\([^\n]*\.DOOR\.,\.SLIDING_TO_LEFT\.,\$\)/);
  assert.equal(modifierOuverture(r.modele, r.id, { genre: "porte" }).ouvertures[0].genre, "porte");
});
