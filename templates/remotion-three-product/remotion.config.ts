import { cpSync, existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Three.js necesita ANGLE en Chromium; el render de servidor lo recibe por --gl.
Config.setChromiumOpenGlRenderer("angle");

// Decoder Draco local: los GLB comprimidos se cargan sin red durante el render.
const dracoSource = "node_modules/three/examples/jsm/libs/draco/gltf";
const dracoTarget = "public/decoders/draco";
if (existsSync(dracoSource) && !existsSync(dracoTarget)) {
  cpSync(dracoSource, dracoTarget, { recursive: true });
}
