# VAIA AI STUDIO - Vercel Fixed Secure Proxy v3

Versi ini memperbaiki kasus halaman web tampil, tetapi backend proxy `/api/health` tidak aktif.

## Struktur wajib di ROOT repository

Pastikan file/folder ini ada langsung di root repository GitHub, bukan masuk folder ganda.

```text
index.html
vercel.json
package.json
.env.example
.gitignore
api/
  health.js
  generate.js
  enhance.js
  models.js
```

Kalau folder `api/` tidak ikut ter-upload, halaman akan menampilkan:

```text
Backend proxy belum aktif
```

## Environment Variable di Vercel

Di Vercel → Project Settings → Environment Variables, isi:

```env
Key   = POLLINATIONS_API_KEY
Value = secret key Pollinations Anda
```

Centang atau pilih environment yang dipakai, minimal Production. Setelah disimpan, lakukan Redeploy.

## Cara cek sukses

Buka URL ini setelah deploy selesai:

```text
https://domain-vercel-anda.vercel.app/api/health
```

Hasil yang benar:

```json
{
  "ok": true,
  "ready": true,
  "runtime": "vercel-node"
}
```

Jika yang muncul adalah halaman HTML VAIA, berarti route `/api` tidak aktif, biasanya karena deploy masih ke GitHub Pages/static hosting, folder `api` tidak masuk root repo, atau Vercel belum redeploy dari commit terbaru.

## Catatan teknis

- Frontend tidak menyimpan API key.
- Backend memakai `Authorization: Bearer` ke Pollinations.
- Generate mencoba endpoint GET `/image/{prompt}` terlebih dulu agar seed tetap didukung, lalu fallback ke endpoint OpenAI-compatible `/v1/images/generations`.
- Ukuran gambar dibatasi maksimal 2048 px per sisi agar tidak terlalu berat di serverless function.
