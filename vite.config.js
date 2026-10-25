import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { recolteVues } from "./tools/viteRecolteVues.js";
import { relaisIA } from "./tools/viteRelaisIA.js";

export default defineConfig({
  // Serveur de dev (24/10) : plus de rechargement automatique de la page quand un fichier change. Vite ne pousse plus rien au navigateur
  // (hmr: false coupe le canal WebSocket), les fichiers modifies sont servis a jour au rafraichissement manuel de la page.
  server: { hmr: false },
  plugins: [
    // Serveur de dev seulement : recolte des vues 3D de la messagerie (voir tools/viteRecolteVues.js).
    recolteVues(),
    // Serveur de dev et de previsualisation seulement : monte api/regle.js (relais IA des regles de collision) sur /api/regle.
    relaisIA(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/web-ifc/*.wasm",
          dest: "wasm"
        }
        ,
        // pako (decompression des XKT compresses) charge comme script classique : une fois bundle, son
        // enveloppe UMD n'etait plus reconnue (GB.inflate indefini, 0 element pour tout XKT compresse, 20/10).
        {
          src: "node_modules/@xeokit/xeokit-sdk/src/plugins/XKTLoaderPlugin/parsers/lib/pako.js",
          dest: "lib"
        }
      ]
    })
  ]
});
