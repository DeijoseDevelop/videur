import { Config } from "@remotion/cli/config";

// Three.js necesita ANGLE en Chromium; el render de servidor lo recibe por --gl.
Config.setChromiumOpenGlRenderer("angle");
