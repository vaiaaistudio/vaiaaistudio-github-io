# VAIA AI STUDIO v5

Versi ini menghapus informasi API key dari tampilan atas dan menjaga secret key tetap berada di server.

## Struktur wajib di root GitHub

index.html
vercel.json
package.json
api/health.js
api/generate.js
api/enhance.js
api/models.js

## Vercel Environment Variable

Di Vercel Project Settings -> Environment Variables, tambahkan:

POLLINATIONS_API_KEY = secret key Pollinations Anda

Jangan tulis secret key di index.html, JavaScript frontend, README, atau repository publik.

Setelah mengubah Environment Variable, lakukan Redeploy.

## Test

Buka:
https://domain-anda.vercel.app/api/health

Jika benar:
{"ok":true,"ready":true,"runtime":"vercel-node"}
