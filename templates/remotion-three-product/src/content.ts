import { z } from "zod";

export const productVideoSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  duration: z.number().positive(),
  projectId: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  accent: z.string().optional(),
  productName: z.string(),
  tagline: z.string(),
  kicker: z.string(),
  cta: z.string(),
  model: z.string().optional(),
  modelRotation: z.number().optional(),
  modelRotationX: z.number().optional(),
  modelRotationZ: z.number().optional(),
  modelScale: z.number().positive().optional(),
  modelSpin: z.number().min(0).max(360).optional(),
  environment: z.string().optional(),
  environmentIntensity: z.number().min(0).max(10).optional(),
  environmentRotation: z.number().optional(),
  environmentBackground: z.boolean().optional(),
  /** Look de iluminación Lightformer cuando no hay HDRI. */
  envPreset: z.enum(["studio", "golden", "cyber", "mono"]).optional(),
  /** true = solo el producto (miniaturas); oculta el overlay de texto. */
  bare: z.boolean().optional(),
});

export type ProductVideoProps = z.infer<typeof productVideoSchema>;

export const defaultProductProps: ProductVideoProps = {
  width: 1280,
  height: 720,
  fps: 30,
  duration: 10,
  projectId: "demo",
  title: "Aurora",
  subtitle: "AURORA · 10S",
  accent: "#c9a46a",
  productName: "AURORA",
  tagline: "La luz\nhecha fragancia.",
  kicker: "EAU DE PARFUM · 50 ML",
  cta: "DESCUBRIR AURORA",
  modelRotation: 0,
  modelScale: 1,
};
