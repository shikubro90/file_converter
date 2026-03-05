// Source of truth for web-side format lookup.
// Must be kept in sync with worker/converters/* plugin definitions.

const IMAGE_OUTPUTS = ["jpg", "png", "webp", "gif", "bmp", "tiff", "pdf"];
const AV_OUTPUTS = ["mp4", "mp3", "webm", "ogg", "wav", "avi", "mkv", "gif"];
const OFFICE_OUTPUTS = ["pdf"];

const entries: [string, string[]][] = [
  // Images (ImageMagick)
  ["image/jpeg",     IMAGE_OUTPUTS],
  ["image/png",      IMAGE_OUTPUTS],
  ["image/webp",     IMAGE_OUTPUTS],
  ["image/gif",      IMAGE_OUTPUTS],
  ["image/bmp",      IMAGE_OUTPUTS],
  ["image/tiff",     IMAGE_OUTPUTS],
  ["image/svg+xml",  IMAGE_OUTPUTS],

  // PDF (ImageMagick, first page)
  ["application/pdf", ["png", "jpg"]],

  // Office — modern
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document",  OFFICE_OUTPUTS],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", OFFICE_OUTPUTS],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",         OFFICE_OUTPUTS],
  // Office — legacy
  ["application/msword",                OFFICE_OUTPUTS],
  ["application/vnd.ms-powerpoint",     OFFICE_OUTPUTS],
  ["application/vnd.ms-excel",          OFFICE_OUTPUTS],
  // OpenDocument
  ["application/vnd.oasis.opendocument.text",         OFFICE_OUTPUTS],
  ["application/vnd.oasis.opendocument.spreadsheet",  OFFICE_OUTPUTS],
  ["application/vnd.oasis.opendocument.presentation", OFFICE_OUTPUTS],

  // Audio (ffmpeg)
  ["audio/mpeg",  AV_OUTPUTS],
  ["audio/ogg",   AV_OUTPUTS],
  ["audio/wav",   AV_OUTPUTS],
  ["audio/flac",  AV_OUTPUTS],
  ["audio/aac",   AV_OUTPUTS],
  ["audio/webm",  AV_OUTPUTS],

  // Video (ffmpeg)
  ["video/mp4",       AV_OUTPUTS],
  ["video/webm",      AV_OUTPUTS],
  ["video/ogg",       AV_OUTPUTS],
  ["video/x-msvideo", AV_OUTPUTS],
  ["video/quicktime", AV_OUTPUTS],
  ["video/x-matroska",AV_OUTPUTS],
];

export const FORMAT_MAP = new Map<string, string[]>(entries);
