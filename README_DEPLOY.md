# VAIA AI STUDIO - Secure Pollinations Generator

Generator gambar AI modern, responsif, dan aman untuk deploy ke GitHub + Vercel.

## Yang sudah diamankan

- API key **tidak ada** di `index.html`.
- Tidak ada input API key di halaman web.
- Tidak ada API key di `localStorage`.
- Frontend hanya memanggil:
  - `/api/generate`
  - `/api/enhance`
  - `/api/models`
  - `/api/health`
- Secret key Pollinations dibaca dari Environment Variable server:
  - `POLLINATIONS_API_KEY`

## Struktur file

```text
.
├── index.html
├── api
│   ├── generate.js
│   ├── enhance.js
│   ├── models.js
│   └── health.js
├── package.json
├── .env.example
├── .gitignore
└── README_DEPLOY.md
```

## Cara deploy ke GitHub + Vercel

1. Upload semua file ini ke repository GitHub.
2. Login ke Vercel.
3. Import repository GitHub.
4. Buka Project Settings di Vercel.
5. Masuk ke **Environment Variables**.
6. Tambahkan variable:

```bash
POLLINATIONS_API_KEY=isi_secret_key_pollinations_di_sini
```

7. Redeploy project.

## Test lokal dengan Vercel CLI

```bash
npm install -g vercel
cp .env.example .env
```

Isi `.env` lokal:

```bash
POLLINATIONS_API_KEY=isi_secret_key_pollinations_di_sini
```

Jalankan:

```bash
vercel dev
```

Buka browser:

```text
http://localhost:3000
```

## Catatan penting

Karena secret key pernah ditampilkan di frontend versi lama, sebaiknya buat key baru atau rotate key lama di Pollinations sebelum dipakai untuk production.
