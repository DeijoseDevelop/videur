import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hex #rrggbb");

/**
 * Kit de marca del proyecto (`brand.json` en la raíz del workspace). Lo leen
 * el agente, el motor Remotion (lo inyecta como prop `brand`) y la UI.
 */
export const BrandKitSchema = z.object({
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  textColor: hexColor.optional(),
  fontFamily: z.string().trim().max(80).optional(),
  /** Path de un asset del proyecto (p. ej. "assets/logo-1a2b.png"). */
  logo: z.string().trim().max(200).optional(),
  /** Margen seguro del overlay como fracción del lado (0–0.3). Default 0.1. */
  safeMargin: z.number().min(0).max(0.3).optional(),
  /** Descripción de tono/estilo que el agente debe respetar. */
  tone: z.string().trim().max(200).optional(),
});

export type BrandKit = z.infer<typeof BrandKitSchema>;
