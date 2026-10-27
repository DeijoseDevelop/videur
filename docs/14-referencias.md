# 14 · Referencias

## 1. Documento origen

- **Guía Maestra: Cómo Generar Videos con IA y FFmpeg (La Arquitectura de Claude)**.
  - `Guía Maestra Cómo Generar Videos con IA y FFmpeg (La Arquitectura de Claude).pdf`
  - `Guía Maestra Cómo Generar Videos con IA y FFmpeg (La Arquitectura de Claude).docx`
  - En la raíz del repositorio.

## 2. Elur

| Recurso | Enlace |
|---|---|
| Documentación | https://elur.dev/ |
| Repositorio | https://github.com/elurjs/elur |
| Core | `@elurjs/core` 4.0.5 |
| Vite plugin (opcional, no usado en v0.1) | `@elurjs/vite-plugin-elur` 2.2.1 |
| Kit | `@elurjs/kit` 2.6.1 |
| Skill local | `/home/deiver/Documents/Projects/javascript/elur/docs/skills/elur/SKILL.md` |

Referencias internas de la skill:

- `references/reactivity.md`
- `references/templates.md`
- `references/components.md`
- `references/stores.md`
- `references/router.md`
- `references/forms.md`
- `references/ssr-hydration.md`
- `references/anti-patterns.md`
- `references/testing.md`

## 3. FFmpeg

| Recurso | Enlace |
|---|---|
| Documentación | https://ffmpeg.org/documentation.html |
| Filtros | https://ffmpeg.org/ffmpeg-filters.html |
| `drawtext` | https://ffmpeg.org/ffmpeg-filters.html#drawtext |
| `lavfi` | https://ffmpeg.org/ffmpeg-devices.html#lavfi |
| `-progress` | https://ffmpeg.org/ffmpeg.html#Main-options |
| `ffprobe` | https://ffmpeg.org/ffprobe.html |
| Formatos | https://ffmpeg.org/ffmpeg-formats.html |

## 4. Motores

| Motor | Versión | Enlace |
|---|---|---|
| Manim Community | 0.22.0 | https://www.manim.community/ · https://github.com/ManimCommunity/manim |
| Remotion | 4.0.539 | https://www.remotion.dev/ · https://github.com/remotion-dev/remotion |
| Remotion Skills | — | https://github.com/remotion-dev/skills |
| Pillow | 11.2.1 | https://python-pillow.org/ |
| pycairo | 1.26+ | https://pycairo.readthedocs.io/ |
| MoviePy (futuro) | 2.x | https://zulko.github.io/moviepy/ |

## 5. Runtime y librerías

| Recurso | Versión | Enlace |
|---|---|---|
| Bun | 1.3.8+ | https://bun.sh/ |
| Hono | 4.13+ | https://hono.dev/ |
| Zod | 4.6+ | https://zod.dev/ |
| Vite | 8.3+ | https://vite.dev/ |
| TypeScript | 7.0+ | https://www.typescriptlang.org/ |
| SQLite | 3.45+ | https://sqlite.org/ |
| MCP | 2025-06-18 | https://modelcontextprotocol.io/ |

## 6. Proyectos similares (2026)

| Proyecto | Enfoque | Enlace |
|---|---|---|
| OpenFilm | HTML + `frame(t)` + editor | https://github.com/openfilm/openfilm |
| Showtime | HTML/Canvas + Manim + FFmpeg | https://github.com/FavioVazquez/showtime |
| Orkas VideoStudio | `plan.json` + HyperFrames | https://github.com/Orkas-AI/Orkas-VideoStudio |
| ffmpeg-skill | 42 tools FFmpeg + MCP | https://github.com/kajisho5/ffmpeg-skill |
| AutoVideo-Agent | Markdown → storyboard → FFmpeg | https://github.com/wangxin6x/AutoVideo-Agent |
| Claude Code Video Toolkit | Remotion + FFmpeg + TTS | https://github.com/digitalsamba/claude-code-video-toolkit |
| Remotion Skills | Reglas para agentes | https://github.com/remotion-dev/skills |

## 7. Proveedores de IA

| Proveedor | Base URL | Docs |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | https://platform.openai.com/docs |
| Anthropic | `https://api.anthropic.com/v1` | https://docs.anthropic.com |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | https://ai.google.dev/docs |
| DeepSeek | `https://api.deepseek.com/v1` | https://api-docs.deepseek.com |
| Moonshot (Kimi) | `https://api.moonshot.cn/v1` | https://platform.moonshot.cn/docs |
| Zhipu (GLM) | `https://open.bigmodel.cn/api/paas/v4` | https://open.bigmodel.cn/dev/api |
| OpenRouter | `https://openrouter.ai/api/v1` | https://openrouter.ai/docs |
| Ollama | `http://127.0.0.1:11434/v1` | https://ollama.com/docs |
| LM Studio | `http://127.0.0.1:1234/v1` | https://lmstudio.ai/docs |

## 8. Seguridad

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- MCP Security: https://modelcontextprotocol.io/docs/concepts/security
- Docker security: https://docs.docker.com/engine/security/

## 9. Versiones del entorno de desarrollo

```text
Bun       1.3.8
Node      22.14.0
Python    3.12.3
Pillow    11.2.1
pycairo   instalado
FFmpeg    (instalar)
Manim     (instalar)
Docker    29.9.2
```

## 10. Licencias

- Videur: MIT.
- Elur: MIT.
- FFmpeg: LGPL/GPL según build.
- Manim: MIT.
- Remotion: licencia propia (revisar uso comercial).
- Pillow: HPND.
- Hono: MIT.
- Zod: MIT.

## 11. Inspiración conceptual

- **3Blue1Brown** para animación matemática.
- **Remotion** para motion graphics como código.
- **Claude Code** para el loop agéntico con `stderr` y visión.
- **After Effects** para la sensación de estudio.
- **Vercel/Linear** para la densidad y claridad de la UI.
