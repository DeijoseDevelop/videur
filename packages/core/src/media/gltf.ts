import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, normalize } from "node:path";
import type { ModelDimensions, ModelInspection } from "@videur/contracts";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const HEAVY_TRIANGLES = 1_500_000;
const HEAVY_TEXTURES = 24;
const HEAVY_BYTES = 50 * 1024 * 1024;

/** Extensiones que GLTFLoader de la plantilla resuelve sin red (Draco y Meshopt locales). */
const SUPPORTED_EXTENSIONS = new Set([
  "KHR_draco_mesh_compression",
  "EXT_meshopt_compression",
  "KHR_mesh_quantization",
  "KHR_texture_transform",
  "KHR_lights_punctual",
  "KHR_materials_anisotropy",
  "KHR_materials_clearcoat",
  "KHR_materials_dispersion",
  "KHR_materials_emissive_strength",
  "KHR_materials_ior",
  "KHR_materials_iridescence",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_unlit",
  "KHR_materials_variants",
  "KHR_materials_volume",
  "EXT_mesh_gpu_instancing",
  "EXT_texture_webp",
  "EXT_texture_avif",
]);

const EXTENSION_HINTS: Record<string, string> = {
  KHR_texture_basisu:
    "texturas KTX2/Basis no soportadas por la plantilla; re-exporta con PNG/JPG/WebP",
  KHR_materials_pbrSpecularGlossiness:
    "material specular-glossiness obsoleto; conviértelo a metal-rough",
};

type Json = Record<string, unknown>;
type Mat4 = number[];

interface GltfSource {
  format: "glb" | "gltf";
  json: Json;
  fileSize: number;
  /** Bytes del chunk BIN del GLB; null si no existe. */
  binChunk: number | null;
  /** Tamaño de un recurso externo o null si no existe/escapa del directorio. */
  external: (uri: string) => number | null;
}

class InspectionError extends Error {}

/** Inspecciona un GLB/GLTF en disco leyendo solo cabecera y JSON. */
export function inspectModelFile(path: string): ModelInspection {
  const format = extname(path).toLowerCase() === ".gltf" ? "gltf" : "glb";
  const fileSize = statSync(path).size;
  const base = dirname(path);
  const external = (uri: string): number | null => {
    const target = externalPath(base, uri);
    return target && existsSync(target) ? statSync(target).size : null;
  };
  try {
    if (format === "gltf") {
      const fd = openSync(path, "r");
      try {
        return analyze({ format, json: parseJson(readRange(fd, 0, fileSize)), fileSize, binChunk: null, external });
      } finally {
        closeSync(fd);
      }
    }
    const fd = openSync(path, "r");
    try {
      const { json, binChunk } = readGlb(fileSize, (offset, length) => readRange(fd, offset, length));
      return analyze({ format, json, fileSize, binChunk, external });
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    return failed(format, error);
  }
}

/** Inspecciona bytes de un GLB/GLTF antes de escribirlo (subida). */
export function inspectModelBytes(data: Uint8Array, format: "glb" | "gltf"): ModelInspection {
  const external = (uri: string): number | null => (uri.startsWith("data:") ? 0 : null);
  try {
    if (format === "gltf") {
      return analyze({ format, json: parseJson(data), fileSize: data.byteLength, binChunk: null, external });
    }
    const { json, binChunk } = readGlb(data.byteLength, (offset, length) =>
      data.subarray(offset, offset + length),
    );
    return analyze({ format, json, fileSize: data.byteLength, binChunk, external });
  } catch (error) {
    return failed(format, error);
  }
}

function readRange(fd: number, offset: number, length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  const read = readSync(fd, buffer, 0, length, offset);
  return buffer.subarray(0, read);
}

function readGlb(
  fileSize: number,
  read: (offset: number, length: number) => Uint8Array,
): { json: Json; binChunk: number | null } {
  if (fileSize < 20) throw new InspectionError("GLB demasiado pequeño");
  const header = view(read(0, 20));
  if (header.byteLength < 20 || header.getUint32(0, true) !== GLB_MAGIC) {
    throw new InspectionError("No es un GLB válido (magic glTF ausente)");
  }
  const version = header.getUint32(4, true);
  if (version !== 2) throw new InspectionError(`GLB versión ${version} no soportada; usa glTF 2.0`);
  const declared = header.getUint32(8, true);
  if (declared > fileSize) throw new InspectionError("GLB truncado: el archivo es más corto que su cabecera");
  const jsonLength = header.getUint32(12, true);
  if (header.getUint32(16, true) !== CHUNK_JSON) throw new InspectionError("GLB sin chunk JSON inicial");
  if (20 + jsonLength > declared) throw new InspectionError("GLB truncado: chunk JSON incompleto");
  const json = parseJson(read(20, jsonLength));

  let binChunk: number | null = null;
  const binOffset = 20 + jsonLength;
  if (binOffset + 8 <= declared) {
    const binHeader = view(read(binOffset, 8));
    if (binHeader.byteLength === 8 && binHeader.getUint32(4, true) === CHUNK_BIN) {
      binChunk = binHeader.getUint32(0, true);
      if (binOffset + 8 + binChunk > declared) throw new InspectionError("GLB truncado: chunk BIN incompleto");
    }
  }
  return { json, binChunk };
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function parseJson(bytes: Uint8Array): Json {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InspectionError("JSON glTF inválido");
  }
  if (!isObject(value)) throw new InspectionError("JSON glTF inválido");
  return value;
}

function externalPath(base: string, uri: string): string | null {
  if (uri.startsWith("data:")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    return null;
  }
  if (/^[a-z]+:/i.test(decoded) || isAbsolute(decoded)) return null;
  const clean = normalize(decoded);
  if (clean.startsWith("..")) return null;
  return join(base, clean);
}

function analyze(source: GltfSource): ModelInspection {
  const { json } = source;
  const errors: string[] = [];
  const warnings: string[] = [];

  const asset = isObject(json.asset) ? json.asset : {};
  const version = typeof asset.version === "string" ? asset.version : "";
  if (!version.startsWith("2.")) errors.push(`glTF ${version || "sin versión"}: se requiere 2.0`);

  const extensionsUsed = strings(json.extensionsUsed);
  const extensionsRequired = strings(json.extensionsRequired);
  for (const name of extensionsRequired) {
    if (!SUPPORTED_EXTENSIONS.has(name)) {
      errors.push(`Extensión requerida no soportada: ${name}${hint(name)}`);
    }
  }
  for (const name of extensionsUsed) {
    if (!SUPPORTED_EXTENSIONS.has(name) && !extensionsRequired.includes(name)) {
      warnings.push(`Extensión opcional ignorada: ${name}${hint(name)}`);
    }
  }

  checkBuffers(source, errors);
  checkImages(source, errors);

  const accessors = array(json.accessors);
  const meshes = array(json.meshes);
  let primitives = 0;
  let triangles = 0;
  let vertices = 0;
  for (const mesh of meshes) {
    for (const primitive of array(mesh.primitives)) {
      primitives += 1;
      const attributes = isObject(primitive.attributes) ? primitive.attributes : {};
      const position = accessorAt(accessors, attributes.POSITION);
      const indices = accessorAt(accessors, primitive.indices);
      const count = num(indices?.count) ?? num(position?.count) ?? 0;
      vertices += num(position?.count) ?? 0;
      const mode = num(primitive.mode) ?? 4;
      if (mode === 4) triangles += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }
  if (primitives === 0) errors.push("El modelo no contiene mallas");

  const materials = array(json.materials).length;
  const textures = array(json.textures).length;
  const animations = array(json.animations).length;
  if (primitives > 0 && materials === 0) warnings.push("Sin materiales: se verá gris por defecto");
  if (triangles > HEAVY_TRIANGLES) {
    warnings.push(
      `${triangles.toLocaleString("es")} triángulos: muy pesado para render por CPU (SwiftShader); decima el modelo`,
    );
  }
  if (textures > HEAVY_TEXTURES) warnings.push(`${textures} texturas: considera atlas o menor resolución`);
  if (source.fileSize > HEAVY_BYTES) warnings.push("Archivo > 50 MB: comprime con Draco/Meshopt y WebP");
  if (animations > 0) warnings.push("Tiene animaciones: la plantilla no las reproduce todavía");

  const dimensions = sceneDimensions(json, accessors);
  if (!dimensions && primitives > 0) warnings.push("No se pudo calcular la bounding box (accessors sin min/max)");
  const upAxis = dimensions ? guessUpAxis(dimensions) : null;
  if (upAxis === "z") warnings.push("Parece Z-up: prueba modelRotationX = -90");

  return {
    format: source.format,
    ok: errors.length === 0,
    errors,
    warnings,
    generator: typeof asset.generator === "string" ? asset.generator.slice(0, 120) : null,
    meshes: meshes.length,
    primitives,
    triangles,
    vertices,
    materials,
    textures,
    animations,
    extensionsUsed,
    extensionsRequired,
    dimensions,
    upAxis,
    suggestedProps: upAxis === "z" ? { modelRotationX: -90 } : {},
  };
}

function hint(name: string): string {
  const text = EXTENSION_HINTS[name];
  return text ? ` (${text})` : "";
}

function checkBuffers(source: GltfSource, errors: string[]): void {
  array(source.json.buffers).forEach((buffer, index) => {
    const byteLength = num(buffer.byteLength) ?? 0;
    const uri = typeof buffer.uri === "string" ? buffer.uri : null;
    if (uri === null) {
      if (source.format !== "glb" || index !== 0) {
        errors.push(`Buffer ${index} sin uri`);
      } else if (source.binChunk === null || source.binChunk < byteLength) {
        errors.push("GLB sin chunk BIN suficiente para el buffer 0");
      }
      return;
    }
    if (uri.startsWith("data:")) return;
    const size = source.external(uri);
    if (size === null) errors.push(`Buffer externo no encontrado o fuera del directorio: ${uri}`);
    else if (size < byteLength) errors.push(`Buffer externo truncado: ${uri}`);
  });
}

function checkImages(source: GltfSource, errors: string[]): void {
  for (const image of array(source.json.images)) {
    const uri = typeof image.uri === "string" ? image.uri : null;
    if (!uri || uri.startsWith("data:")) continue;
    if (source.external(uri) === null) errors.push(`Textura externa no encontrada o fuera del directorio: ${uri}`);
  }
}

function sceneDimensions(json: Json, accessors: Json[]): ModelDimensions | null {
  const nodes = array(json.nodes);
  const meshes = array(json.meshes);
  const scenes = array(json.scenes);
  const scene = scenes[num(json.scene) ?? 0];
  const roots = scene ? numbers(scene.nodes) : nodes.map((_, index) => index);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visited = new Set<number>();

  const visit = (index: number, parent: Mat4): void => {
    const node = nodes[index];
    if (!node || visited.has(index)) return;
    visited.add(index);
    const world = multiply(parent, localMatrix(node));
    const mesh = meshes[num(node.mesh) ?? -1];
    for (const primitive of mesh ? array(mesh.primitives) : []) {
      const attributes = isObject(primitive.attributes) ? primitive.attributes : {};
      const position = accessorAt(accessors, attributes.POSITION);
      const lo = numbers(position?.min);
      const hi = numbers(position?.max);
      if (lo.length < 3 || hi.length < 3) continue;
      for (const corner of corners(lo, hi)) {
        const point = transform(world, corner);
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis] as number, point[axis] as number);
          max[axis] = Math.max(max[axis] as number, point[axis] as number);
        }
      }
    }
    for (const child of numbers(node.children)) visit(child, world);
  };
  for (const root of roots) visit(root, identity());

  if (!Number.isFinite(min[0]) || !Number.isFinite(max[0])) return null;
  const round = (value: number): number => Math.round(value * 1e4) / 1e4;
  return {
    x: round((max[0] as number) - (min[0] as number)),
    y: round((max[1] as number) - (min[1] as number)),
    z: round((max[2] as number) - (min[2] as number)),
  };
}

function guessUpAxis({ x, y, z }: ModelDimensions): "y" | "z" {
  return z > y * 1.5 && z >= x ? "z" : "y";
}

function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function localMatrix(node: Json): Mat4 {
  const matrix = numbers(node.matrix);
  if (matrix.length === 16) return matrix;
  const [tx = 0, ty = 0, tz = 0] = numbers(node.translation);
  const [x = 0, y = 0, z = 0, w = 1] = numbers(node.rotation);
  const [sx = 1, sy = 1, sz = 1] = numbers(node.scale);
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += (a[k * 4 + row] as number) * (b[col * 4 + k] as number);
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function transform(m: Mat4, [x, y, z]: number[]): number[] {
  const px = x as number;
  const py = y as number;
  const pz = z as number;
  return [0, 1, 2].map(
    (row) =>
      (m[row] as number) * px + (m[4 + row] as number) * py + (m[8 + row] as number) * pz + (m[12 + row] as number),
  );
}

function corners(lo: number[], hi: number[]): number[][] {
  const result: number[][] = [];
  for (const x of [lo[0], hi[0]]) {
    for (const y of [lo[1], hi[1]]) {
      for (const z of [lo[2], hi[2]]) result.push([x as number, y as number, z as number]);
    }
  }
  return result;
}

function accessorAt(accessors: Json[], index: unknown): Json | undefined {
  const i = num(index);
  return i === undefined ? undefined : accessors[i];
}

function failed(format: "glb" | "gltf", error: unknown): ModelInspection {
  const message =
    error instanceof InspectionError ? error.message : "No se pudo leer el modelo";
  return {
    format,
    ok: false,
    errors: [message],
    warnings: [],
    generator: null,
    meshes: 0,
    primitives: 0,
    triangles: 0,
    vertices: 0,
    materials: 0,
    textures: 0,
    animations: 0,
    extensionsUsed: [],
    extensionsRequired: [],
    dimensions: null,
    upAxis: null,
    suggestedProps: {},
  };
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function array(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numbers(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
