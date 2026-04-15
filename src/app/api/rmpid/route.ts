import { NextRequest, NextResponse } from "next/server";

// RMPID (SeekStreaming) Embed API

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // If no params, show API info
  if (searchParams.toString() === "") {
    return NextResponse.json(
      {
        api_name: "SeekStreaming Video API",
        version: "3.5",
        description:
          "This API finds videos on SeekStreaming (rpmshare.com) and returns data in a custom JSON format.",
        endpoints: {
          tv_shows:
            "/api/rmpid?tmdbid={TMDB_ID}&s={SEASON}&e={EPISODE}",
          movies: "/api/rmpid?tmdbid={TMDB_ID}",
        },
        note: "File naming: TV: {TMDB_ID}_S{SS}E{EE}_name | Movies: {TMDB_ID}_name",
        success_output_format: {
          status: "success",
          data: [
            {
              access_id: "(string) SeekStreaming video ID",
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
    const API_KEY = "3078994f6d89a13a321da858";
    const BASE_URL = "https://rpmshare.com/api/v1";

    const tmdb_id = searchParams.get("tmdbid")?.trim();
    const season = searchParams.get("s")?.trim();
    const episode = searchParams.get("e")?.trim();
    const noAds = searchParams.get("noads") === "1";

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

    async function callAPI(endpoint: string): Promise<any> {
      const url = BASE_URL + endpoint;
      const res = await fetch(url, {
        headers: {
          "API-Token": API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      const text = await res.text();
      if (!text) return { error: "empty response", http_code: 0 };
      return { data: JSON.parse(text), http_code: res.status };
    }

    async function getDefaultPlayer(): Promise<string | null> {
      const result = await callAPI("/video/player/default");
      return result?.data?.domain ?? null;
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
      const pattern = new RegExp(
        `^${tmdbId}[._\\-\\s]+S${sPad}E${ePad}([._\\-\\s]|$)`,
        "i"
      );
      return pattern.test(titleNoExt);
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
          `^${tmdbId}[._\\-\\s]+S${sPad}E${ePad}[._\\-\\s]+(.+)$`,
          "i"
        );
        const match = titleNoExt.match(pattern);
        if (match) return match[1].replace(/[._\-]+/g, " ").trim();
      } else {
        const pattern = new RegExp(`^${tmdbId}[._\\-\\s]+(.+)$`);
        const match = titleNoExt.match(pattern);
        if (match) return match[1].replace(/[._\-]+/g, " ").trim();
      }
      return null;
    }

    function matchesMovie(title: string, tmdbId: string): boolean {
      if (!title || !tmdbId) return false;
      const titleNoExt = title.replace(/\.[^.]+$/, "");
      const pattern = new RegExp(`^${tmdbId}([._\\-\\s]|$)`);
      return pattern.test(titleNoExt);
    }

    function searchInVideos(
      videos: any[],
      tmdbId: string,
      s?: string | null,
      e?: string | null
    ): any {
      if (!videos || videos.length === 0) return false;
      for (const video of videos) {
        if (!video.name) continue;
        if (s && e) {
          if (matchesTVEpisode(video.name, tmdbId, s, e)) return video;
        } else {
          if (matchesMovie(video.name, tmdbId)) return video;
        }
      }
      return false;
    }

    async function findVideo(
      tmdbId: string,
      s?: string | null,
      e?: string | null
    ): Promise<any> {
      let searchQuery: string;
      if (s && e) {
        searchQuery = `S${s.padStart(2, "0")}E${e.padStart(2, "0")}`;
      } else {
        searchQuery = tmdbId;
      }

      const maxPages = 10;
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          page: String(page),
          perPage: "100",
          search: searchQuery,
        });
        const result = await callAPI(`/video/manage?${params}`);

        if (result.http_code !== 200 || !result?.data?.data) {
          if (page === 1) return false;
          continue;
        }

        const found = searchInVideos(result.data.data, tmdbId, s, e);
        if (found) return found;

        const meta = result.data.metadata ?? {};
        const currentPage = meta.currentPage ?? page;
        const maxPage = meta.maxPage ?? 1;
        if (currentPage >= maxPage) break;
      }

      return false;
    }

    const type = season && episode ? "tv" : "movie";
    const videoData = await findVideo(tmdb_id, season, episode);

    if (!videoData) {
      let message = `File not found for TMDB ID: ${tmdb_id}`;
      if (type === "tv") message += `, S:${season}, E:${episode}`;
      return NextResponse.json(
        { status: "error", message },
        { status: 404 }
      );
    }

    const playerDomain = await getDefaultPlayer();
    if (!playerDomain) {
      return NextResponse.json(
        { status: "error", message: "Failed to get player information" },
        { status: 500 }
      );
    }

    const embedUrl = noAds
      ? `https://ciscocdn-24.yilogag600-048.workers.dev/${videoData.id}`
      : `https://${playerDomain}/#${videoData.id}`;

    const extractedTitle = extractTitle(
      videoData.name,
      tmdb_id,
      season,
      episode
    );

    let previewUrl: string | null = null;
    if (videoData.poster) {
      previewUrl = (videoData.assetUrl || "") + videoData.poster;
    } else if (videoData.preview) {
      previewUrl = (videoData.assetUrl || "") + videoData.preview;
    }

    const itemData: any = {
      access_id: videoData.id,
      tmdb_id: Number(tmdb_id),
      title: extractedTitle,
      audio: "Hindi+Multi AAC",
      player_url: embedUrl,
      preview_url: previewUrl,
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
