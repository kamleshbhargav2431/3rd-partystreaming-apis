import { NextRequest, NextResponse } from "next/server";

// Abysstream Embed API (abyss.to)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // If no params, show API info
  if (searchParams.toString() === "") {
    return NextResponse.json(
      {
        api_name: "Abysstream Embed API",
        version: "2.0",
        description:
          "This API finds files on Abysstream and returns data in a custom JSON format.",
        endpoints: {
          tv_shows:
            "/api/abys?tmdbid={TMDB_ID}&s={SEASON}&e={EPISODE}",
          movies: "/api/abys?tmdbid={TMDB_ID}",
        },
        note: "File naming: TV: {TMDB_ID}_S{SS}E{EE} | Movies: {TMDB_ID}_title",
        success_output_format: {
          status: "success",
          data: [
            {
              access_id: "(string) Abysstream file ID",
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
    const API_KEY = "6c8ee0da8176adb0c9af7a1c2752dd4c";
    const API_URL = "https://api.abyss.to/v1/resources";

    const tmdb_id = searchParams.get("tmdbid")?.trim();
    const season = searchParams.get("s")?.trim();
    const episode = searchParams.get("e")?.trim();

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

    async function fetchFolderContents(folderId: string): Promise<any> {
      const params = new URLSearchParams({ key: API_KEY });
      if (folderId) params.set("folderId", folderId);
      const url = `${API_URL}?${params}`;
      const res = await fetch(url);
      if (res.status !== 200) return null;
      return res.json();
    }

    function findFolderByName(
      items: any[],
      folderName: string
    ): string | null {
      if (!items) return null;
      for (const item of items) {
        if (
          item.isDir === true &&
          item.name === folderName
        ) {
          return item.id;
        }
      }
      return null;
    }

    function findFileByName(
      items: any[],
      fileName: string
    ): any {
      if (!items) return null;
      for (const item of items) {
        if (
          item.isDir === false &&
          item.name
        ) {
          const nameNoExt = item.name.replace(/\.[^.]+$/, "");
          if (nameNoExt === fileName) return item;
        }
      }
      return null;
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
        return null;
      } else {
        const pattern = new RegExp(`^${tmdbId}_(.+)$`);
        const match = titleNoExt.match(pattern);
        if (match) return match[1].replace(/[._\-]+/g, " ").trim();
      }
      return null;
    }

    async function searchFile(
      tmdbId: string,
      s?: string | null,
      e?: string | null
    ): Promise<any> {
      const rootData = await fetchFolderContents("");
      if (!rootData || !rootData.items) return false;

      if (s && e) {
        // TV Show search
        const seriesFolderId = findFolderByName(
          rootData.items,
          "Series"
        );
        if (!seriesFolderId) return false;

        const seriesData = await fetchFolderContents(seriesFolderId);
        if (!seriesData || !seriesData.items) return false;

        const tmdbFolderId = findFolderByName(
          seriesData.items,
          tmdbId
        );
        if (!tmdbFolderId) return false;

        const tmdbData = await fetchFolderContents(tmdbFolderId);
        if (!tmdbData || !tmdbData.items) return false;

        const sPad = s.padStart(2, "0");
        const seasonFolderName = `${tmdbId}_S${sPad}`;
        const seasonFolderId = findFolderByName(
          tmdbData.items,
          seasonFolderName
        );
        if (!seasonFolderId) return false;

        const seasonData = await fetchFolderContents(seasonFolderId);
        if (!seasonData || !seasonData.items) return false;

        const ePad = e.padStart(2, "0");
        const fileName = `${tmdbId}_S${sPad}E${ePad}`;
        return findFileByName(seasonData.items, fileName);
      } else {
        // Movie search
        const moviesFolderId = findFolderByName(
          rootData.items,
          "Movies"
        );
        if (!moviesFolderId) return false;

        const moviesData = await fetchFolderContents(moviesFolderId);
        if (!moviesData || !moviesData.items) return false;

        for (const item of moviesData.items) {
          if (item.isDir === false && item.name) {
            const nameNoExt = item.name.replace(/\.[^.]+$/, "");
            if (nameNoExt === tmdbId) return item;
          }
        }
        return false;
      }
    }

    const type = season && episode ? "tv" : "movie";
    const fileData = await searchFile(tmdb_id, season, episode);

    if (!fileData) {
      let message = `File not found for TMDB ID: ${tmdb_id}`;
      if (type === "tv") message += `, Season: ${season}, Episode: ${episode}`;
      return NextResponse.json(
        { status: "error", message },
        { status: 404 }
      );
    }

    const embedUrl = `https://abysscdn.com/?v=${fileData.id}`;
    const extractedTitle = extractTitle(
      fileData.name,
      tmdb_id,
      season,
      episode
    );

    const itemData: any = {
      access_id: fileData.id,
      tmdb_id: Number(tmdb_id),
      title: extractedTitle,
      audio: "Hindi",
      player_url: embedUrl,
      preview_url: null,
    };

    if (type === "tv") {
      itemData.season = Number(season);
      itemData.episode = Number(episode);
    }

    return NextResponse.json(
      {
        status: "success",
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
