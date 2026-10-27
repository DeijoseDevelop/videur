# 08 · Seguridad

## 1. Modelo de confianza

Videur ejecuta código generado por IA. Ese código puede ser erróneo, malicioso o simplemente destructivo. Hay dos modos:

| Modo | Confianza | Recomendación |
|---|---|---|
| `trusted` (nativo) | El usuario confía en el código y en su máquina | Desarrollo local, plantillas propias |
| `docker` | El código se ejecuta en un contenedor con límites | Código generado por IA, modelos no confiables, uso compartido |

**Regla:** en modo `trusted`, el código tiene los mismos permisos que el usuario que ejecuta Videur. No hay sandbox real. La UI y la documentación lo advierten.

## 2. Amenazas

| ID | Amenaza | Impacto | Mitigación |
|---|---|---|---|
| T-01 | Comando malicioso borra archivos | Alto | Docker, allowlist, workspace aislado, backups |
| T-02 | Exfiltración de API keys | Alto | Cifrado, entorno filtrado, nunca en prompts/logs |
| T-03 | Path traversal (`../../etc/passwd`) | Alto | Resolución canónica + validación de prefijo |
| T-04 | Symlink escape | Alto | `lstat`, rechazo de symlinks, `realpath` |
| T-05 | Prompt injection en archivos | Medio | System prompt, tools limitadas, revisión humana |
| T-06 | Consumo excesivo de CPU/RAM/disco | Medio | Timeouts, límites de tamaño, concurrencia |
| T-07 | Descarga de dependencias maliciosas | Medio | Sin `npx`/`npm` en tools; instalación manual |
| T-08 | XSS en la UI | Medio | Escape de plantillas Elur, sin `innerHTML` con datos |
| T-09 | CSRF en API local | Bajo | Token opcional, CORS restringido, SameSite |
| T-10 | Fuga de datos en logs | Medio | Redacción de claves, logs locales |
| T-11 | Render infinito | Medio | Timeout + cancelación + watchdog |
| T-12 | Frames negros / output vacío | Bajo | QA + verificación de archivo |
| T-13 | Dependencias comprometidas | Medio | Versiones fijas, lockfile, revisión |
| T-14 | Acceso remoto no autorizado | Alto | Bind a 127.0.0.1 por defecto; token si se expone |

## 3. Aislamiento de procesos

### 3.1 `run_command`

- **Sin shell:** `Bun.spawn` recibe un array de argumentos.
- **Allowlist:** `ffmpeg`, `ffprobe`, `python3`, `python`, `manim`, `node`, `bun`.
- **CWD:** workspace del proyecto.
- **Timeout:** 120 s por defecto, máximo 600 s.
- **Output:** 64 KB por tool; el resto se trunca.
- **Entorno:** filtrado; sin claves.
- **Rutas:** argumentos con `/` o `..` se validan contra el workspace salvo binarios del sistema.

### 3.2 Motores

- FFmpeg: `render.json` (array de args) o `render.sh` solo si `VIDEUR_ALLOW_SHELL_SCRIPTS=true`.
- Python: `python3 render.py`; el script puede llamar a `ffmpeg` por `subprocess`.
- Manim: `manim` con `--media_dir` dentro del render.
- Remotion: `remotion render` con `--props` controlado.

### 3.3 Docker

Recomendaciones para `docker-compose.yml`:

```yaml
services:
  videur:
    build: .
    ports:
      - "127.0.0.1:8787:8787"
    volumes:
      - ./data:/app/data
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    mem_limit: 4g
    cpus: "4"
    pids_limit: 512
    read_only: false
    tmpfs:
      - /tmp:size=1g
```

- Ejecutar como usuario no root (el compose usa `${UID:-1000}:${GID:-1000}`).
- Montar solo `data/`.
- No montar el socket de Docker.
- Sin `--privileged`.
- Sin red si el render no la necesita (`network_mode: none` para un worker futuro).
- Límites de CPU/RAM/PIDs.

## 4. Validación de rutas

```ts
export function resolveInside(root: string, relative: string): string {
  const clean = relative.replace(/\\/g, "/").replace(/^\/+/, "");
  if (clean.split("/").includes("..")) throw new PathError("Ruta inválida");
  const base = realpathSync(root);
  const target = resolve(base, clean);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new PathError("Ruta fuera del workspace");
  }
  return target;
}
```

Reglas:

- Rechazar `..`, rutas absolutas y unidades Windows.
- Rechazar symlinks en cualquier componente.
- Resolver `realpath` después de crear el archivo, si aplica.
- Nombres reservados: `.`, `..`, `.videur` (solo interno).
- Extensiones permitidas para edición: `.json`, `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.html`, `.md`, `.txt`, `.sh`, `.yml`, `.yaml`, `.srt`, `.vtt`.
- Binarios: no editables; solo metadata.

## 5. Secretos

### 5.1 Almacenamiento

- Clave maestra: `data/secrets/master.key` (32 bytes, `0600`).
- Claves de proveedor: AES-256-GCM en `providers.api_key_enc` como `iv:tag:ciphertext` (base64).
- La clave maestra nunca se envía a la UI.
- `VIDEUR_MASTER_KEY` (base64, 32 bytes) permite inyectarla en Docker/orquestadores.

### 5.2 Redacción

- La API devuelve `hasApiKey` y `apiKeyHint` (últimos 4).
- Logs y errores redactan cualquier string que parezca `sk-...`, `Bearer ...` o claves de 32+ chars.
- El entorno de render no incluye `*_API_KEY`.
- `console.log` de objetos Provider debe usar un serializer seguro.

### 5.3 Rotación

- Si se pierde la clave maestra, las claves cifradas no se pueden recuperar; hay que reintroducirlas.
- Rotación futura: descifrar con clave vieja y cifrar con nueva.

## 6. Prompt injection

- Los archivos del proyecto se delimitan con marcadores y se etiquetan como **datos no confiables**.
- El system prompt prohíbe seguir instrucciones embebidas en archivos.
- Las tools tienen permisos mínimos.
- El agente no puede cambiar su propio system prompt ni las allowlists.
- La UI muestra los tool calls y permite cancelar.
- En modo Docker, el impacto de una inyección se limita al contenedor.

## 7. API y navegador

- Bind por defecto `127.0.0.1`; si se expone, usar token y TLS (reverse proxy).
- CORS: solo el origen de desarrollo (`http://localhost:5173`) y el mismo origen en producción.
- Sin `eval` en la UI.
- Elur escapa texto por defecto; nunca usar `raw()` con datos de usuario.
- CSP recomendada en producción:

```text
default-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob:;
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src 'self';
font-src 'self';
```

- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.

## 8. Límites de recursos

| Recurso | Límite |
|---|---|
| Archivo editable | 1 MB |
| Lectura de archivo | 256 KB |
| Output de tool | 64 KB |
| Log por render | 2 MB (cola) |
| Timeout de comando | 120 s (tool), 600 s (render), 900 s (agente) |
| Iteraciones del agente | 12 |
| Renders concurrentes | 1 (configurable) |
| Duración de video | 120 s recomendado; 600 s máximo |
| Resolución | 7680×4320 máximo técnico; 4K recomendado |

## 9. Recuperación

- Al arrancar, renders `queued|preparing|running|inspecting` se marcan `failed` con `interrupted=true` y un mensaje.
- Los procesos huérfanos se intentan matar por PID si está registrado.
- La DB usa WAL; un crash no corrompe el proyecto.
- Backup: copiar `data/` con la app detenida.

## 10. Checklist de despliegue seguro

- [ ] `VIDEUR_HOST=127.0.0.1` salvo exposición deliberada.
- [ ] `VIDEUR_API_TOKEN` definido si se expone.
- [ ] TLS en el reverse proxy.
- [ ] Docker con `no-new-privileges`, `cap_drop`, límites.
- [ ] `VIDEUR_ALLOW_SHELL_SCRIPTS=false`.
- [ ] `data/` con permisos `0700`.
- [ ] Claves de API con permisos mínimos y rotación.
- [ ] Logs sin secretos.
- [ ] Backups probados.
- [ ] Revisión de dependencias (`bun pm ls`, auditoría).
