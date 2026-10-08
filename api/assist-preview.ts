import { previewResponse, readJson, rejection } from './_lib/http.ts';

/** POST /api/assist-preview — returns the redacted context the live analyst would receive. */
export async function POST(request: Request): Promise<Response> {
  try {
    return previewResponse(await readJson(request, 2048));
  } catch (error) {
    return rejection(error);
  }
}
