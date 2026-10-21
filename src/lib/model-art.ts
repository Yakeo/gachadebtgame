import { modelHashes } from "./model-manifest";

/** Keep corrected battle sprites out of the old illustration-cutout cache. */
export function modelUrl(path: string): string {
  const version = modelHashes[path];
  return version ? `${path}?v=${version}` : path;
}
