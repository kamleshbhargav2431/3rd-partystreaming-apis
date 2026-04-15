Same endpoints, same params, same JSON output:

GET /api/filemoon?tmdbid=12345 → movie
GET /api/filemoon?tmdbid=12345&s=1&e=5 → TV show
GET /api/rmpid?tmdbid=12345&s=1&e=5&noads=1 → noads variant
GET /api/seekstreaming?tmdbid=12345&s=1&e=5&noads=1 → noads variant
GET /api/abys?tmdbid=12345 → movie
Visiting any endpoint with no params → returns API info JSON (same as your PHP)
