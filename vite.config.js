import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
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
