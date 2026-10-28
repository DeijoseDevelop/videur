import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BrandKitSchema, type BrandKit } from "@videur/contracts";
import { ValidationError } from "../errors";
import type { WorkspaceService } from "./workspace";

/**
 * Kit de marca por proyecto en `brand.json` (raíz del workspace). Visible
 * para el agente como archivo normal y consumido por el motor Remotion.
 */
export class BrandService {
  constructor(private readonly workspace: WorkspaceService) {}

  private file(projectId: string): string {
    return join(this.workspace.dir(projectId), "brand.json");
  }

  get(projectId: string): BrandKit | null {
    const path = this.file(projectId);
    if (!existsSync(path)) return null;
    try {
      return BrandKitSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      return null;
    }
  }

  set(projectId: string, brand: BrandKit): BrandKit {
    const parsed = BrandKitSchema.safeParse(brand);
    if (!parsed.success) {
      throw new ValidationError(
        `Kit de marca inválido: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
    }
    this.workspace.write(projectId, "brand.json", `${JSON.stringify(parsed.data, null, 2)}\n`);
    return parsed.data;
  }
}
