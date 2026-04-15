import { NextRequest, NextResponse } from "next/server";

// Filemoon Embed API

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // If no params, show API info
  if (searchParams.toString() === "") {
    return NextResponse.json(
      {
        api_name: "Filemoon Embed API",
        version: "3.7",
        description:
          "This API finds files on Filemoon and returns data in a custom JSON format.",
        endpoints: {
          tv_shows: "/api/filemoon?tmdbid={TMDB_ID}&s={SEASON}&e={EPISODE}",
          movies: "/api/filemoon?tmdbid={TMDB_ID}",
        },
        note:
          "Structure - Series: Series/{TMDB_ID}/{TMDB_ID}_S{SEASON_NO}/{TMDB_ID}_S{SS}E{EE} | Movies: Movies/{TMDB_ID}.mkv",
        success_output_format: {
          status: "success",
          data: [
            {
              access_id: "(string) Filemoon file code",
              tmdb_id: "(integer) The Movie Database ID",
              title: "(string) Extracted title from filename",
              audio: "(string) Audio information (default: 'unknown')",
              season: "(integer) Season number (for TV shows only)",
              episode: "(integer) Episode number (for TV shows only)",
              player_url: "(string) The final embed URL",
              preview_url: "(string) Thumbnail image URL",
            },
          ],
        },
        error_output_format: {
          status: "error",
          message: "(string) Description of the error",
        },
      },
      { status: 200 }
    );
  }

  try {
    const FILEMOON_API_KEY = "96022qa42fccviasd1xu2";
    const FILEMOON_API_URL = "https://api.byse.sx/file/list";

    const tmdb_id = searchParams.get("tmdbid")?.trim();
    const season = searchParams.get("s")?.trim() ?? null;
    const episode = searchParams.get("e")?.trim() ?? null;
    const debug = searchParams.has("debug");

    if (!tmdb_id || !/^\d+$/.test(tmdb_id)) {
      return NextResponse.json(
        { status: "error", message: "Valid TMDB ID is required" },
        { status: 400 }
      );
    }

    if (season !== null && episode !== null) {
      if (!/^\d+$/.test(season) || Number(season) < 1) {
        return NextResponse.json(
          { status: "error", message: "Season number must be 1 or greater" },
          { status: 400 }
        );
      }
      if (!/^\d+$/.test(episode) || Number(episode) < 1) {
        return NextResponse.json(
          { status: "error", message: "Episode number must be 1 or greater" },
          { status: 400 }
        );
      }
    }

    function matchesTVEpisode(
      title: string,
      tmdbId: string,
      s: string,
      e: string
    ): boolean {
      if (!title || !tmdbId || !s || !e) return false;
      const titleNoExt = title.replace(/\.[^.]+$/, "");
      const sPad = s.padStart(2, "0");
      const ePad = e.padStart(2, "0");
      const searchPattern = `${tmdbId}_S${sPad}E${ePad}`;
      return titleNoExt.indexOf(searchPattern) === 0;
    }

    function extractTitle(
      filename: string,
      tmdbId: string,
      s?: string | null,
      e?: string | null
    ): string | null {
      const titleNoExt = filename.replace(/\.[^.]+$/, "");
      if (s && e) {
        const sPad = s.padStart(2, "0");
        const ePad = e.padStart(2, "0");
        const pattern = new RegExp(
          `^${tmdbId}_S${sPad}E${ePad}_(.+)$`,
          "i"
        );
        const match = titleNoExt.match(pattern);
        if (match) return match[1].replace(/[._\-]+/g, " ").trim();
      } else {
        const pattern = new RegExp(`^${tmdbId}_(.+)$`);
        const match = titleNoExt.match(pattern);
        if (match) return match[1].replace(/[._\-]+/g, " ").trim();
      }
      return null;
    }

    function matchesMovie(title: string, tmdbId: string): boolean {
      if (!title || !tmdbId) return false;
      const titleNoExt = title.replace(/\.[^.]+$/, "");
      return titleNoExt.indexOf(tmdbId) === 0;
    }

    function searchInFiles(
      files: any[],
      tmdbId: string,
      s?: string | null,
      e?: string | null
    ): any {
      if (!files || files.length === 0) return false;
      for (const file of files) {
        if (!file.title) continue;
        if (s && e) {
          if (matchesTVEpisode(file.title, tmdbId, s, e)) return file;
        } else {
          if (matchesMovie(file.title, tmdbId)) return file;
        }
      }
      return false;
    }

    async function callFilemoonAPI(
      tmdbId: string,
      s?: string | null,
      e?: string | null,
      dbg?: boolean
    ): Promise<any> {
      let page = 1;
      let totalPages = 1;

      do {
        const apiUrl = `${FILEMOON_API_URL}?key=${FILEMOON_API_KEY}&page=${page}`;
        const res = await fetch(apiUrl);
        const text = await res.text();
        if (!text) break;
        const data = JSON.parse(text);
        const files = data?.result?.files ?? [];
        totalPages = data?.result?.pages ?? 1;

        if (dbg) {
          return {
            page,
            total_pages: totalPages,
            api_url: apiUrl,
            http_code: res.status,
            files,
          };
        }

        const found = searchInFiles(files, tmdbId, s, e);
        if (found) return found;
        page++;
      } while (page <= totalPages);

      return false;
    }

    const type = season && episode ? "tv" : "movie";
    const fileData = await callFilemoonAPI(tmdb_id, season, episode, debug);

    if (debug) {
      return NextResponse.json({
        debug_mode: true,
        search_params: {
          tmdb_id: tmdb_id,
          season,
          episode,
          type,
        },
        api_result: fileData,
      });
    }

    if (!fileData) {
      let message = `File not found for TMDB ID: ${tmdb_id}`;
      if (type === "tv") message += `, S:${season}, E:${episode}`;
      return NextResponse.json(
        { status: "error", message },
        { status: 404 }
      );
    }

    const embedUrl = `https://playmoon.gipes64628.workers.dev/e/${fileData.file_code}`;
    const extractedTitle = extractTitle(
      fileData.title,
      tmdb_id,
      season,
      episode
    );

    const itemData: any = {
      access_id: fileData.file_code,
      tmdb_id: Number(tmdb_id),
      title: extractedTitle ?? fileData.title,
      audio: "Hindi+Multi AAC",
      player_url: embedUrl,
      preview_url: fileData.thumbnail ?? null,
    };

    if (type === "tv") {
      itemData.season = Number(season);
      itemData.episode = Number(episode);
    }

    return NextResponse.json(
      {
        status: "success",
        cached: false,
        data: [itemData],
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", message: "Internal server error: " + e.message },
      { status: 500 }
    );
  }
}
