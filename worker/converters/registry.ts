import type { ConverterPlugin } from "./types";
import { imagesPlugin } from "./images";
import { pdfPlugin } from "./pdf";
import { docsPlugin } from "./docs";
import { audioVideoPlugin } from "./audioVideo";
import { zipPlugin } from "./zip";

const plugins: ConverterPlugin[] = [
  imagesPlugin,
  pdfPlugin,
  docsPlugin,
  audioVideoPlugin,
  zipPlugin,
];

/**
 * Matches a plugin's supportedInputs pattern against a concrete MIME type.
 * Supports exact match, wildcard category ("image/*"), and catch-all ("*").
 */
function mimeMatches(pattern: string, mime: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("/*")) return mime.startsWith(pattern.slice(0, -1));
  return pattern === mime;
}

/**
 * Returns the first plugin that can handle the given source MIME → target extension pair.
 * Zip plugin is ordered last so more specific plugins take priority.
 */
export function findPlugin(sourceMime: string, targetExt: string): ConverterPlugin | null {
  return (
    plugins.find(
      (p) =>
        p.supportedOutputs.includes(targetExt) &&
        p.supportedInputs.some((pattern) => mimeMatches(pattern, sourceMime))
    ) ?? null
  );
}

export { plugins };
