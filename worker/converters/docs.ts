import path from "path";
import fs from "fs/promises";
import type { ConverterPlugin } from "./types";

const OUTPUTS_DIR = path.join(process.cwd(), "storage/outputs");

export const docsPlugin: ConverterPlugin = {
  name: "docs",
  supportedInputs: [
    // Modern Office formats
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Legacy Office formats
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.ms-excel",
    // OpenDocument formats
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
  ],
  supportedOutputs: ["pdf"],
  buildCommand(inputPath) {
    // Output goes to OUTPUTS_DIR; LibreOffice auto-names the file — afterRun renames it
    return {
      cmd: "soffice",
      args: ["--headless", "--convert-to", "pdf", "--outdir", OUTPUTS_DIR, inputPath],
    };
  },
  async afterRun(inputPath, outputPath) {
    // LibreOffice writes {basename_without_ext}.pdf; rename to our canonical outputPath
    const libreOutput = path.join(
      OUTPUTS_DIR,
      path.basename(inputPath).replace(/\.[^.]+$/, ".pdf")
    );
    if (libreOutput !== outputPath) {
      await fs.rename(libreOutput, outputPath);
    }
  },
};
