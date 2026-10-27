# ASCII 3D · Raycast Cube

Composición Remotion que renderiza un cubo 3D real con **un rayo por celda**:

- Cámara fija, cubo rotando en yaw/pitch/roll.
- Intersección rayo-AABB en espacio local.
- Depth buffer y sombreado por normal/light.
- Rampa ASCII `.,:;=+*#%@`.
- Bordes marcados con `*`.
- Suelo de puntos y scanlines.
- `postProcess.motionBlur: 2` añade un motion trail determinista.

```bash
bun install
bun run render
```

Desde Videur: crea un proyecto con la plantilla `remotion-ascii-3d`.
