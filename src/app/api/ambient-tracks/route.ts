import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Lists the audio files dropped into `public/audio/foco` and
 * `public/audio/descanso`.
 *
 * Reading the directory instead of keeping a manifest means adding music is
 * "copy the file in" — no JSON to edit and no rebuild. Kept dynamic for the
 * same reason: a cached listing would ignore files added after the build.
 */
export const dynamic = "force-dynamic";

const EXTENSIONS = new Set([".mp3", ".m4a", ".ogg", ".oga", ".wav", ".flac", ".aac", ".opus"]);

const FOLDERS = {
  focus: "foco",
  break: "descanso",
} as const;

async function listTracks(folder: string): Promise<string[]> {
  const dir = path.join(process.cwd(), "public", "audio", folder);
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((name) => `/audio/${folder}/${encodeURIComponent(name)}`);
  } catch {
    // Folder simply isn't there yet — that's a valid empty state, not an error.
    return [];
  }
}

export async function GET() {
  const [focus, breakTracks] = await Promise.all([
    listTracks(FOLDERS.focus),
    listTracks(FOLDERS.break),
  ]);

  return Response.json(
    { focus, break: breakTracks },
    { headers: { "cache-control": "no-store" } },
  );
}
