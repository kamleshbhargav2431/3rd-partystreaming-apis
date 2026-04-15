# Streaming API

A unified API for fetching movie and TV show stream embeds from multiple providers.

---

## Base URL

```
https://yourdomain.com/api
```

---

## Endpoints

| Endpoint | Provider |
|---|---|
| `/api/filemoon` | Filemoon |
| `/api/rmpid` | RMPid |
| `/api/seekstreaming` | SeekStreaming |
| `/api/abys` | Abys |

All endpoints share the same query parameters and return the same JSON structure.

---

## Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tmdbid` | integer | Yes | The TMDB ID of the movie or TV show |
| `s` | integer | No | Season number (TV shows only) |
| `e` | integer | No | Episode number (TV shows only) |
| `noads` | integer | No | Set to `1` to request an ad-free embed (supported on `/api/rmpid` and `/api/seekstreaming`) |

> **Note:** Omit `s` and `e` for movies. Include both for TV show episodes.

---

## Usage Examples

### Movie
```
GET /api/filemoon?tmdbid=12345
GET /api/abys?tmdbid=12345
```

### TV Show Episode
```
GET /api/filemoon?tmdbid=12345&s=1&e=5
```

### TV Show Episode (No Ads)
```
GET /api/rmpid?tmdbid=12345&s=1&e=5&noads=1
GET /api/seekstreaming?tmdbid=12345&s=1&e=5&noads=1
```

### API Info
Visiting any endpoint with no parameters returns an API info JSON response:
```
GET /api/filemoon
```

---

## Response

All endpoints return the same JSON structure:

```json
{
  "status": 200,
  "provider": "filemoon",
  "type": "movie",
  "tmdbid": 12345,
  "embed_url": "https://...",
  "noads": false
}
```

| Field | Type | Description |
|---|---|---|
| `status` | integer | HTTP-style status code (`200` on success) |
| `provider` | string | The provider name for this endpoint |
| `type` | string | `"movie"` or `"tv"` |
| `tmdbid` | integer | The requested TMDB ID |
| `embed_url` | string | The embeddable stream URL |
| `noads` | boolean | Whether the ad-free variant was requested |

---

## Error Responses

```json
{
  "status": 400,
  "error": "Missing required parameter: tmdbid"
}
```

```json
{
  "status": 404,
  "error": "No stream found for the given TMDB ID"
}
```

---

## Notes

- All endpoints are `GET` requests.
- `noads=1` is accepted by all endpoints but is only functional on `/api/rmpid` and `/api/seekstreaming`.
- TMDB IDs can be found at [themoviedb.org](https://www.themoviedb.org).
