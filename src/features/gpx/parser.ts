// Browser entry point for GPX parsing. Reads a `File` to text, parses it
// with the browser's DOMParser, and delegates to the shared core in
// `parseCore.ts` so the build-time manifest pipeline produces
// byte-identical summaries.

import { GpxLoadError } from './types';
import {
  ELE_GAIN_THRESHOLD_M,
  ELE_SMOOTHING_WINDOW_M,
  GpxParseError,
  parseGpxDocument,
  type ParsedGpx,
} from './parseCore.mjs';

export { ELE_GAIN_THRESHOLD_M, ELE_SMOOTHING_WINDOW_M };

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });
}

export async function parseGpxFile(file: File): Promise<ParsedGpx> {
  let text: string;
  try {
    text = await readFileAsText(file);
  } catch (err) {
    throw new GpxLoadError(
      'read-failed',
      file.name,
      `Could not read ${file.name}: ${(err as Error).message ?? 'unknown error'}`,
    );
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.nodeName === 'parsererror') {
    throw new GpxLoadError(
      'invalid-xml',
      file.name,
      `Could not read ${file.name}: not a valid GPX (XML parse error).`,
    );
  }

  try {
    return parseGpxDocument(doc, file.name);
  } catch (err) {
    if (err instanceof GpxParseError) {
      throw new GpxLoadError(err.code, file.name, err.message);
    }
    throw err;
  }
}
