// Tests du moteur de quantitatif (src/quantitatif.js) : registres, validation de requete, comptage, filtres, regroupements, mesures estimees, CSV.
import test from "node:test";
import assert from "node:assert/strict";
import { MESURES, FILTRES, REGROUPEMENTS, creerRegistre, validerRequete, calculer, libelleRequete, exporterCsv, mesuresDisponibles, capacites } from "../src/quantitatif.js";

// Elements synthetiques : 3 portes (2 au niveau 1, 1 au niveau 2), 2 gaines, 1 mur, 1 niveau (objet spatial, jamais compte).
const el = (id, typeIfc, niveau, maquette, nom, boite = null, quantites = null) => ({ id, nom, famille: nom.replace(/:\d+$/, ""), typeIfc, niveau, maquette, maquetteId: maquette, boite, quantites });
const ELEMENTS = [
  el("p1", "IfcDoor", "Level 1", "Architecture", "Porte simple:0900:1"),
  el("p2", "IfcDoor", "Level 1", "Architecture", "Porte double:1800:2"),
  el("p3", "IfcDoor", "Level 2", "Architecture", "Porte simple:0900:3"),
  el("g1", "IfcDuctSegment", "Level 1", "Mechanical (CVC)", "Gaine rect:200x100:4", [0, 0, 0, 5, 0.2, 0.1]),
  el("g2", "IfcDuctSegment", "Level 2", "Mechanical (CVC)", "Gaine rect:200x100:5", [0, 0, 3, 2, 0.2, 3.1]),
  el("m1", "IfcWallStandardCase", "Level 1", "Architecture", "Mur 200:6", [0, 0, 0, 4, 0.2, 3]),
  el("n1", "IfcBuildingStorey", "", "Architecture", "Level 1")
];
const filtres = (f = {}) => ({ typesIfc: [], niveaux: [], maquettes: [], noms: [], ...f });
const requete = (mesure, f, regroupements = []) => ({ mesure, filtres: filtres(f), regroupements });

test("registres : enregistrement, doublon refuse, nom obligatoire", () => {
  const r = creerRegistre("essai");
  r.enregistrer({ nom: "a" });
  assert.deepEqual(r.noms(), ["a"]);
  assert.throws(() => r.enregistrer({ nom: "a" }), /existe déjà/);
  assert.throws(() => r.enregistrer({}), /nom/);
  assert.equal(r.trouver("zz"), null);
});

test("registres : mesures, filtres et regroupements attendus sont presents", () => {
  assert.deepEqual(MESURES.noms().slice(0, 4), ["nombre", "longueur_estimee", "surface_estimee", "volume_estime"]);
  assert.ok(MESURES.noms().includes("qto_longueur"));
  assert.deepEqual(FILTRES.noms(), ["typesIfc", "niveaux", "maquettes", "noms"]);
  assert.deepEqual(REGROUPEMENTS.noms(), ["niveau", "typeIfc", "maquette", "famille"]);
});

test("validerRequete : nominal, listes completees, doublons retires", () => {
  const v = validerRequete({ mesure: "nombre", filtres: { typesIfc: ["IfcDoor", "IfcDoor"] }, regroupements: ["niveau"] });
  assert.equal(v.ok, true);
  assert.deepEqual(v.requete.filtres, filtres({ typesIfc: ["IfcDoor"] }));
});

test("validerRequete : entrees invalides refusees", () => {
  const invalides = [null, [], "x", {}, { mesure: "poids" }, { mesure: "nombre", filtres: [] }, { mesure: "nombre", filtres: { couleur: ["rouge"] } },
    { mesure: "nombre", filtres: { typesIfc: "IfcDoor" } }, { mesure: "nombre", filtres: { typesIfc: [3] } }, { mesure: "nombre", regroupements: "niveau" },
    { mesure: "nombre", regroupements: ["niveau", "typeIfc", "maquette"] }, { mesure: "nombre", regroupements: ["niveau", "niveau"] }, { mesure: "nombre", regroupements: ["couleur"] }];
  for (const r of invalides) assert.equal(validerRequete(r).ok, false, JSON.stringify(r));
});

test("validerRequete : valeurs hors maquette et mesure non proposee refusees", () => {
  const valeurs = { typesIfc: ["IfcDoor"], niveaux: ["Level 1"], maquettes: [], noms: [], mesures: ["nombre"] };
  assert.equal(validerRequete(requete("nombre", { typesIfc: ["IfcDoor"] }), valeurs).ok, true);
  assert.equal(validerRequete(requete("nombre", { typesIfc: ["IfcWindow"] }), valeurs).ok, false);
  assert.equal(validerRequete(requete("longueur_estimee", {}), valeurs).ok, false);
});

test("calculer : comptage par filtre de type, objets spatiaux jamais comptes", () => {
  const r = calculer(ELEMENTS, requete("nombre", {}));
  assert.equal(r.ok, true);
  assert.equal(r.totaux.valeur, 6);
  assert.equal(r.elementsExclus, 1);
  assert.equal(r.mesure.origine, "compte");
  const portes = calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcDoor"] }));
  assert.equal(portes.totaux.valeur, 3);
  assert.equal(portes.lignes.length, 1);
});

test("calculer : filtres combines en ET, valeurs d'un meme filtre en OU", () => {
  assert.equal(calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcDoor"], niveaux: ["Level 2"] })).totaux.valeur, 1);
  assert.equal(calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcDoor", "IfcDuctSegment"] })).totaux.valeur, 5);
  assert.equal(calculer(ELEMENTS, requete("nombre", { maquettes: ["Mechanical (CVC)"], niveaux: ["Level 1"] })).totaux.valeur, 1);
});

test("calculer : filtre par nom, sans accents ni casse, suffixe d'identifiant ignore", () => {
  assert.equal(calculer(ELEMENTS, requete("nombre", { noms: ["porte"] })).totaux.valeur, 3);
  assert.equal(calculer(ELEMENTS, requete("nombre", { noms: ["PORTE DOUBLE"] })).totaux.valeur, 1);
  // Le suffixe d'identifiant Revit est retire : les deux portes simples de meme type sont trouvees ensemble.
  assert.equal(calculer(ELEMENTS, requete("nombre", { noms: ["Porte simple:0900:3"] })).totaux.valeur, 2);
});

test("calculer : regroupement par niveau, tri numerique, totaux coherents", () => {
  const r = calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcDoor"] }, ["niveau"]));
  assert.deepEqual(r.lignes.map((l) => [l.cles[0], l.valeur]), [["Level 1", 2], ["Level 2", 1]]);
  assert.equal(r.totaux.valeur, r.lignes.reduce((t, l) => t + l.valeur, 0));
  assert.deepEqual(r.regroupements, [{ nom: "niveau", libelle: "Niveau" }]);
});

test("calculer : regroupement a deux niveaux et par famille", () => {
  const r = calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcDoor"] }, ["niveau", "famille"]));
  assert.deepEqual(r.lignes.map((l) => [...l.cles, l.valeur]), [["Level 1", "Porte double:1800", 1], ["Level 1", "Porte simple:0900", 1], ["Level 2", "Porte simple:0900", 1]]);
  const parTypeEtMaquette = calculer(ELEMENTS, requete("nombre", {}, ["typeIfc", "maquette"]));
  assert.equal(parTypeEtMaquette.lignes.length, 3);
});

test("calculer : criteres du lien Viewer = filtres precises par la cle de la ligne", () => {
  const r = calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcDoor"] }, ["niveau"]));
  assert.deepEqual(r.lignes[1].criteres, { typesIfc: ["IfcDoor"], niveaux: ["Level 2"], maquettes: [], noms: [] });
  assert.deepEqual(r.totaux.criteres.niveaux, []);
});

test("calculer : mesures estimees sur la boite englobante, etiquetees estimees", () => {
  const l = calculer(ELEMENTS, requete("longueur_estimee", { typesIfc: ["IfcDuctSegment"] }));
  assert.equal(l.ok, true);
  assert.equal(l.mesure.origine, "estime");
  assert.equal(l.mesure.origineLibelle, "estimé");
  assert.equal(l.totaux.valeur, 7); // 5 + 2
  assert.match(l.notes[0], /Estimé : .*chiffrage ferme/);
  assert.match(l.notes[1], /pas une quantité IFC/);
  const s = calculer(ELEMENTS, requete("surface_estimee", { typesIfc: ["IfcWallStandardCase"] }));
  assert.equal(s.totaux.valeur, 12); // 4 x 3
  const v = calculer(ELEMENTS, requete("volume_estime", { typesIfc: ["IfcWallStandardCase"] }));
  assert.equal(v.totaux.valeur, 2.4); // 4 x 3 x 0.2
});

test("calculer : element sans geometrie compte a part, jamais ajoute comme zero", () => {
  const r = calculer(ELEMENTS, requete("longueur_estimee", {}));
  assert.equal(r.totaux.sansDonnee, 3); // les 3 portes n'ont pas de boite
  assert.equal(r.elementsPrisEnCompte, 6);
  assert.ok(r.notes.some((n) => /sans donnée/.test(n)));
});

test("calculer : mesure sans aucune donnee dans la maquette = non disponible, pas zero", () => {
  const sansBoites = ELEMENTS.map((e) => ({ ...e, boite: null }));
  const r = calculer(sansBoites, requete("longueur_estimee", {}));
  assert.equal(r.ok, false);
  assert.equal(r.code, "mesure_indisponible");
  assert.match(r.message, /Non disponible dans cette maquette/);
  assert.equal(calculer(ELEMENTS, requete("qto_surface", {})).code, "mesure_indisponible");
});

test("calculer : quantites IFC lues quand le modele en contient, origine « lu »", () => {
  const avecQto = [el("a", "IfcWallStandardCase", "Level 1", "A", "Mur:1", null, { NetSideArea: 10, Length: 4 }), el("b", "IfcWallStandardCase", "Level 1", "A", "Mur:2", null, { GrossArea: 5 })];
  assert.deepEqual(mesuresDisponibles(avecQto), ["nombre", "qto_longueur", "qto_surface", "qto_volume"]);
  const r = calculer(avecQto, requete("qto_surface", {}));
  assert.equal(r.totaux.valeur, 15);
  assert.equal(r.mesure.origineLibelle, "lu dans le modèle");
  assert.equal(calculer(avecQto, requete("qto_longueur", {})).totaux.sansDonnee, 1);
});

test("calculer : boite invalide ou fonction de boite acceptees", () => {
  const e1 = el("a", "IfcDoor", "L", "A", "x", () => [0, 0, 0, 2, 1, 1]);
  const e2 = el("b", "IfcDoor", "L", "A", "y", [NaN, 0, 0, 1, 1, 1]);
  assert.equal(calculer([e1, e2], requete("longueur_estimee", {})).totaux.valeur, 2);
  assert.equal(capacites([e2]).boites, false);
});

test("calculer : aucun resultat, entree vide, requete invalide", () => {
  const aucun = calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcWindow"] }, ["niveau"]));
  assert.equal(aucun.ok, true);
  assert.equal(aucun.aucunResultat, true);
  assert.deepEqual(aucun.lignes, []);
  assert.equal(aucun.totaux.valeur, 0);
  assert.equal(calculer([], requete("nombre", {})).aucunResultat, true);
  assert.equal(calculer(null, requete("nombre", {})).aucunResultat, true);
  assert.equal(calculer(ELEMENTS, { mesure: "x" }).code, "requete_invalide");
});

test("extension : une mesure, un filtre et un regroupement ajoutes a des registres personnalises", () => {
  const mesures = creerRegistre("mesure");
  mesures.enregistrer({ nom: "double", libelle: "double", verbe: "Doubler", unite: "", origine: "compte", besoin: null, valeur: () => 2 });
  const filtresR = creerRegistre("filtre");
  filtresR.enregistrer({ nom: "typesIfc", source: "typesIfc", libelle: "type", test: (e, v) => e.typeIfc === v });
  const groupes = creerRegistre("regroupement");
  groupes.enregistrer({ nom: "premiereLettre", libelle: "Initiale", cle: (e) => e.nom[0] });
  const r = calculer(ELEMENTS, { mesure: "double", filtres: { typesIfc: ["IfcDoor"] }, regroupements: ["premiereLettre"] }, { mesures, filtres: filtresR, regroupements: groupes });
  assert.deepEqual(r.lignes.map((l) => [l.cles[0], l.valeur]), [["P", 6]]);
});

test("libelleRequete : phrase de relecture en francais", () => {
  assert.equal(libelleRequete(requete("nombre", { typesIfc: ["IfcDoor"], niveaux: ["Level 2"] })), "Compter les portes du niveau 2.");
  assert.equal(libelleRequete(requete("longueur_estimee", { typesIfc: ["IfcPipeSegment"], maquettes: ["Plomberie"] }, ["niveau"])), "Estimer la longueur des tuyaux de la maquette Plomberie, par niveau.");
  assert.equal(libelleRequete(requete("nombre", { niveaux: ["Level 1", "Level 2"], noms: ["Diffuser"] })), "Compter les éléments des niveaux 1 et 2 dont le nom contient « Diffuser ».");
});

test("CSV : BOM, separateur point-virgule, decimale virgule, echappement, protection des formules", () => {
  const r = calculer([el("a", "IfcDoor", "Level 1", "A", 'Porte "spéciale";1', [0, 0, 0, 1.5, 1, 1]), el("b", "IfcDoor", "Level 2", "A", "=SOMME(A1)", [0, 0, 0, 2, 1, 1])], requete("longueur_estimee", {}, ["niveau", "famille"]));
  const csv = exporterCsv(r);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lignes = csv.slice(1).split("\r\n");
  assert.equal(lignes[0], "Niveau;Famille / type;Éléments pris en compte;Longueur estimée (m);Origine;Éléments sans donnée");
  assert.equal(lignes[1], 'Level 1;"Porte ""spéciale"";1";1;1,5;estimé;0');
  assert.equal(lignes[2], "Level 2;'=SOMME(A1);1;2;estimé;0");
  assert.equal(lignes[3], "Total;;2;3,5;estimé;0");
  assert.equal(lignes[4], "");
});

test("CSV : sans regroupement une seule ligne, resultat vide ou invalide", () => {
  const unique = exporterCsv(calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcDoor"] })));
  assert.deepEqual(unique.slice(1).split("\r\n").slice(0, 2), ["Sélection;Éléments pris en compte;Nombre (u);Origine;Éléments sans donnée", "Ensemble;3;3;compté;0"]);
  const vide = exporterCsv(calculer(ELEMENTS, requete("nombre", { typesIfc: ["IfcWindow"] })));
  assert.equal(vide.slice(1).split("\r\n")[1], "Total;0;0;compté;0");
  assert.equal(exporterCsv({ ok: false }), "﻿");
  assert.equal(exporterCsv(null), "﻿");
});
