// Types for the portrait manifest generator, so tests can import it from
// TypeScript without the build having to compile plain .mjs.
export declare const facesDir: string;
export declare const manifestPath: string;
export declare function hashFile(file: string): string;
export declare function portraitManifest(): Record<string, string>;
export declare function renderManifest(manifest: Record<string, string>): string;
export declare function writeManifest(): {
  changed: boolean;
  count: number;
  manifest: Record<string, string>;
};
