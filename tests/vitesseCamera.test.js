// Tests de la vitesse de camera par defaut du Viewer (src/vitesseCamera.js) : 50 % affiche, valeur memorisee prioritaire.
import test from "node:test";
import assert from "node:assert/strict";
import { VITESSE_CAMERA_DEFAUT, vitesseCameraInitiale } from "../src/vitesseCamera.js";

test("le defaut est 50 % de l'echelle du curseur (10 a 100)", () => {
  assert.equal(VITESSE_CAMERA_DEFAUT, 50);
});

test("sans valeur memorisee : 50 %, ordinateur comme mobile", () => {
  assert.equal(vitesseCameraInitiale(null), 50);
  assert.equal(vitesseCameraInitiale(undefined), 50);
  assert.equal(vitesseCameraInitiale(""), 50);
});

test("valeur memorisee valide : prioritaire, bornee a 10-100", () => {
  assert.equal(vitesseCameraInitiale("30"), 30);
  assert.equal(vitesseCameraInitiale("100"), 100);
  assert.equal(vitesseCameraInitiale("150"), 100);
  assert.equal(vitesseCameraInitiale("5"), 10);
});

test("valeur memorisee illisible : retombe sur 50 %", () => {
  assert.equal(vitesseCameraInitiale("abc"), 50);
});
