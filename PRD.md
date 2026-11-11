# PRD — Barabai Yaomink World

> **Peta kecil yang tak habis** — jelajah dunia mini kota Barabai, Hulu Sungai Tengah, dalam bentuk pulau 3D terapung dan peta infinite berbasis WebGL.

| | |
|---|---|
| **Nama produk** | Barabai Yaomink World |
| **Versi dokumen** | 1.0 (11 Nov 2026) |
| **Status projek** | MVP v1 selesai · poliran & fitur lanjutan terbuka |
| **Repo** | Vanilla JS ES Modules + Three.js + Vite |
| **Bahasa produk** | Indonesia (copy UI seluruhnya `id`) |

---

## 1. Ringkasan Produk

**Barabai Yaomink World** adalah pengalaman web 3D interaktif (bukan game, bukan GIS) yang menghadirkan kota Barabai sebagai:

1. **Landing planet** — dunia mini berbentuk planet terapung bergaya low-poly dengan judul 3D "BARABAI", berayun mengikuti kursor, lalu "terbang masuk" ke peta saat tombol MULAI ditekan.
2. **Peta infinite** — dunia prosedural tak berujung (streaming per chunk) berisi bukit, sungai, sawah, rumah panggung, pasar apam, masjid, dan 7 landmark khas Barabai yang bisa ditemukan, dibuka detailnya, dan dikunjungi lewat animasi kamera `flyTo`.

Prinsip desain produk: **"pelan-pelan"** — ritme santai, visual hangat (teal/cream/ink), gaya kartu-post low-poly dengan garis tinta (outline), tanpa tekanan skor atau waktu.

### Nilai utama
- **Sentimen lokal**: rumah panggung, lumbung, getah/karet, sawah, apam, Meratus — semua dibangun prosedural dari geometri, tanpa aset eksternal.
- **Ringan**: satu file HTML, tanpa framework, tanpa model 3D berat — target berjalan mulus di laptop/HP kelas menengah.
- **Eksploratif tanpa tujuan**: tidak ada fail state; "menang" = menemukan 7 temuan.

---

## 2. Latar Belakang & Masalah

Rekam/vlog promosi pariwisata Barabai bersifat pasif (video). Belum ada media interaktif yang membuat orang *berjalan sendiri* melintasi kota kecil ini secara digital.

**Masalah yang dijawab produk ini:**
| # | Masalah | Solusi |
|---|---------|--------|
| 1 | Konten wisata Barabai tidak interaktif | Peta 3D yang bisa diseret, di-zoom, dan dijelajahi bebas |
| 2 | Aset 3D mahal & berat | Seluruh dunia dibangkitkan prosedural (noise + geometri primitif) |
| 3 | Perangkat target beragam | Streaming chunk + DPR adaptif + mode hemat daya |
| 4 | Mohon diingat, bukan sekadar dilihat | Sistem "Temuan" (journal) dengan cerita naratif per landmark |

---

## 3. Tujuan & Non-Tujuan

### Tujuan (Goals)
- G1. Pengguna baru memahami "rasa" kota Barabai dalam < 2 menit tanpa tutorial.
- G2. Render stabil ≥ 55 FPS di laptop menengah, ≥ 45 FPS di HP menengah.
- G3. Waktu muat pertama < 3 detik di jaringan 4G (semua geometri dibuat runtime, aset teks saja).
- G4. Pengguna menemukan rata-rata ≥ 4 landmark pada sesi pertama.

### Non-Tujuan (Non-Goals)
- NG1. Bukan game dengan misi/ skor/ waktu/ multiplayer.
- NG2. Bukan peta navigasi akurat (koordinat asli 2°35′ LS 115°23′ BT hanya estimasi artistik).
- NG3. Tidak menyimpan data pengguna ke server (tidak ada backend).
- NG4. Tidak memakai framework UI (React/Vue dsb) — DOM murni + Three.js.

---

## 4. Target Pengguna & Persona

| Persona | Deskripsi | Kebutuhan |
|---|---|---|
| **Anak kos perantauan ("Yao")** | Orang Barabai yang merantau, ingin rasa pulang | Nostalgia cepat, cerita hangat, mudah dibagikan (tautan `?spot=...`) |
| **Pelajar/sejarawan lokal** | Ingin mengenal ikon kota | Info ringkas per landmark, journal |
| **Pengunjung umum/penggemar diorama** | Menemukan lewat sosmed | Buka tautan → lihat langsung, tanpa install |

---

## 5. User Stories

- **US-1** — Sebagai pengunjung, saya ingin menekan MULAI dan langsung "terbang" masuk ke dunia, agar saya cepat terlibat.
- **US-2** — Sebagai penjelajah, saya ingin seret/scroll/WASD untuk bergerak dan zoom, agar saya bebas menjelajah.
- **US-3** — Sebagai penjelajah, saya ingin marker landmark mengikuti objek 3D dan bisa diklik, agar saya tahu ke mana pergi.
- **US-4** — Sebagai penjelajah, saat mendekat/mengklik landmark, panel detail berisi cerita + fakta muncul, agar saya belajar sesuatu.
- **US-5** — Sebagai kolektor, saya ingin penghitung Temuan X/7 dan toast saat penemuan baru, agar ada progres.
- **US-6** — Sebagai pengguna HP, saya ingin pinch-zoom & drag dua jari memutar kamera, agar kontrol terasa natural.
- **US-7** — Sebagai pengguna baterai, saya ingin mode hemat daya yang berhenti merender saat kamera diam.
- **US-8** — Sebagai pembagik tautan, saya ingin `?spot=masjid` langsung membuka peta pada landmark tsb.
- **US-9** — Sebagai pengembang, saya ingin `?debug` mengekspos state aplikasi dan panel performa (tombol `P`), agar mudah diukur.

---

## 6. Persyaratan Fungsional

### 6.1 Sistem & Alur Utama
| ID | Persyaratan | Status |
|---|---|---|
| FR-1 | **Landing scene**: planet low-poly (r≈10.4) berisi kota mini, sungai, jalan, 6 ikon; judul teks 3D "BARA/BAI" bevel melayang; floating rocks; kamera parallax mengikuti pointer. | ✅ Selesai |
| FR-2 | **Transaksi luncur**: klik MULAI → animasi kamera ~1.25 s (easing cubic) + overlay "Membuka Barabai" pada 620 ms → masuk mode peta pada 1160 ms. | ✅ Selesai |
| FR-3 | **Peta infinite**: dunia streaming per chunk 96×96 unit, 24×24 segmen, radius muat 2 (maks 25 chunk), dibangun ≤ 1 chunk per frame, dibuang bila keluar radius. | ✅ Selesai |
| FR-4 | **Terrain prosedural**: fbm (broad/detail/ridge), bukit gaussian di (-64,-61), dataran landmark di-flatten, sungai terukir mengikuti `riverX(z)`; warna vertex per wajah (pasir/hijau/batu) + variasi hash. | ✅ Selesai |
| FR-5 | **Jalan**: 8 poligon jalan dari `ROADS`, dirasterisasi ke strip quad 2.7 unit lebar mengikuti tinggi medan. | ✅ Selesai |
| FR-6 | **Prop prosedural** per chunk via RNG deterministik (`mulberry32(seed(cx,cz))`): rumah panggung, warung, lumbung, pohon, palem, karet, semak, batu, sawah, perahu, pulau kecil, pagar, lampu, asap. | ✅ Selesai |
| FR-7 | **7 landmark** dibangun khusus (Gerbang Bumi Murakata, Alun-Alun, Masjid Agung Riadhusshalihin, Pasar Apam, Taman Dwi Warna, Bukit Meratus, Sungai/Dermaga) + 2 jembatan sungai. | ✅ Selesai |
| FR-8 | **Marker HUD**: proyeksi titik jangkar 3D→2D tiap frame, sembunyikan di luar layar/ belakang kamera, z-index berdasar kedalaman. | ✅ Selesai |
| FR-9 | **Panel detail**: cerita + chip fakta + tombol "Dekati" (flyTo viewDistance landmark). | ✅ Selesai |
| FR-10 | **Journal "Temuan"**: daftar 7 landmark, status ○/✓, penghitung X/7, klik → select+fly. | ✅ Selesai |
| FR-11 | **Toast penemuan**: "Temuan baru — {nama}" 2.8 s. | ✅ Selesai |
| FR-12 | **Kontrol kamera** (`MapControls`): drag-pan, right-drag/Shift-drag rotasi (yaw+pitch clamp 0.45–1.28 rad), wheel zoom (32–235 unit), pinch zoom+pan 2 jari, WASD/panah, damp eksponensial (λ 8–10). | ✅ Selesai |
| FR-13 | **Mode hemat daya**: bila kamera diam & tidak ada input → skip render; tombol toggle + otomatis reset saat interaksi. | ✅ Selesai |
| FR-14 | **Panel performa** (tombol `i` / kunci `P`): FPS, frame ms (rata halus), draw call, segitiga, DPR, jumlah chunk, mode (Lancar/Hemat). | ✅ Selesai |
| FR-15 | **DPR adaptif**: maks `min(devicePixelRatio, 1.5)`; FPS<46 → turun 0.2 (min 1); FPS>58.5 → naik 0.1; jeda 2.4 s antar perubahan. | ✅ Selesai |
| FR-16 | **Deep link**: `?play` masuk peta langsung; `?spot=<id|short>` + pilih landmark; `?debug` ekspos `window.__barabai`. | ✅ Selesai |
| FR-17 | **Keyboard UI**: Enter/Space mulai; `J` journal, `P` performa, `R` reset kamera, `+/-` zoom, `1–7` pilih landmark, `Esc` tutup panel berlapis. | ✅ Selesai |
| FR-18 | **Ketahanan**: layar fatal bila WebGL gagal/konteks hilang (`webglcontextlost`), `<noscript>`, koordinat & hint HUD. | ✅ Selesai |

### 6.2 Backlog (kandidat v1.1+)
| ID | Ide | Catatan |
|---|---|---|
| FR-19 | Persistensi Temuan (`localStorage`) + badge "selesai" | Tidak ada penyimpanan saat ini; state hilang saat refresh |
| FR-20 | Siklus waktu (pagi/senja/malam) dengan lerp warna langit & lampu menyala | Sudah ada aset lampu/asap di `props.js` |
| FR-21 | Suara ambien (burung, sungai, adzan) dengan tombol mute | Perlu aset audio ringan |
| FR-22 | Tumbol "Bagikan tautan" (copy `?spot=...`) | Memanfaatkan deep link yang sudah ada |
| FR-23 | Mode foto (sembunyikan HUD + watermark) | Overlay CSS sederhana |
| FR-24 | PWA/offline (service worker) | Bagian dari G3 |
| FR-25 | Bahasa Inggris toggle | Copy terkumpul di `data.js`/HTML — siap diekstrak |
| FR-26 | Mini-map kompas + arah kiblat masjid | Estetik, opsional |

---

## 7. Arsitektur Teknis (Implementasi Saat Ini)

### 7.1 Stack
- **Runtime**: Vanilla JavaScript ES2020 modules — tanpa framework, tanpa TypeScript.
- **3D**: Three.js `^0.187.0` (MeshLambertMaterial flat-shading, vertex colors, `EdgesGeometry` outline tinta).
- **Build**: Vite `^8.3.7` (`base:"./"`, `assetsInlineLimit: 8192`, target es2020), dev server port 5173.
- **Aset**: hanya font typeface `helvetiker_bold` (dibundel ke JSON) + tekstur air dari `<canvas>` runtime.
- **Backend**: tidak ada — seluruhnya statis.

### 7.2 Peta Modul
```
index.html                 → shell DOM (landing, HUD, journal, detail, toast, perf, fatal)
src/
  main.js                  → orkestrator: state machine (landing|launching|map), loop 60fps
                             (akumulator frame), DPR adaptif, eco mode, URL params, fatal
  stage.js                 → WebGLRenderer (antialias, no shadow, sRGB, clear teal)
  landing.js               → scene planet: sphere vertex-color, kota di permukaan bola,
                             jalan/sungai sebagai strip path di bola, teks 3D, floating rocks,
                             animasi kamera luncur
  mapworld.js              → scene peta: fog exp2, cahaya 3-tahap, bidang air 1200²
                             (tekstur canvas + offset), streaming chunk, landmark, jembatan
  worldgen.js              → heightAt/slopeAt (fbm+river+pad flatten), ROAD_SEGMENTS,
                             distanceToRoad, penempatan prop, buildChunk (merge terrain+props,
                             EdgesGeometry outline)
  landmarks.js             → builder 7 landmark + jembatan sungai
  props.js                 → PALETTE + 16 builder prop low-poly (house, paddy, boat, dst)
                             + createPlacer (transform helper ke GeometryBatch)
  materials.js             → konstanta warna, flatMaterial/vertexMaterial/outlineMaterial,
                             makeOutline(threshold)
  mapcontrols.js           → kelas kamera: pan/rotate/zoom/pinch/WASD + flyTo/setPose/reset
  ui.js                    → DOM HUD: marker proyeksi, journal, detail, toast, perf, keyboard
  data.js                  → MAP_START, LANDMARKS (7), ROADS (8), LANDMARK_BY_ID
  utils.js                 → clamp/lerp/smoothstep/damp, mulberry32, hash2/valueNoise/fbm,
                             formatCompact, composeMatrix, GeometryBatch, makeSignTexture
  fonts/helvetiker_bold…   → font 3D judul
  styles.css               → seluruh gaya (landing, HUD, panel, marker, transisi, fatal)
  ⚠ legacy (tak diimpor main.js): world.js (2500 baris), scene.js, controls.js
```

### 7.3 Alur render & data
1. `main.js` membatasi loop ke 60 Hz (akumulator `FRAME_INTERVAL`).
2. Mode `landing|launching` → render `landing.scene`; `launching` memicu `prepareMap()` (warm-up semua chunk awal) pada 620 ms.
3. Mode `map` → `controls.update(dt)` (damp target/kamera) → `mapWorld.update` (geser air + offset tekstur, `ensureChunks` budget 1/frame) → render → `ui.updateMarkers`.
4. Eco: bila `!controls.moving && !dirty` → lewati render, cukup update statistik.
5. Perf sampling per ~700 ms; histeresis DPR (46/58.5) dengan cooldown 2.4 s.

### 7.4 Kontrak data penting
- `LANDMARKS[i]`: `{ id, short, name, tag, description, facts[], accent, x, z, pad, padHeight, lift, viewY, viewDistance, rotation }` — `anchor` & `viewTarget` diisi runtime oleh `mapworld`.
- Chunk key: `"{cx},{cz}"`; seed: `(cx*374761393 + cz*668265263) ^ 0x5f356495`.
- Warna inti: `TEAL #69c5c2`, `CREAM #f2ecdd`, `INK #2f3b36`, `GOLD #d6a348`, `CORAL #d8795f`, `GREEN #75a064`.

---

## 8. Persyaratan Non-Fungsional

| Kategori | Persyaratan |
|---|---|
| **Performa** | ≥55 FPS desktop menengah; ≤1 chunk baru per frame; tanpa shadow map; geometri di-merge per chunk (satu mesh + satu LineSegments); fog sebagai alat culling visual; eco idle = 0 render |
| **Kompatibilitas** | Peramban modern WebGL2/WebGL1 (es2020); degrade elegan → layar fatal bila WebGL gagal |
| **Aksesibilitas** | `aria-label`/`aria-hidden`/`aria-live` di elemen kunci, kontrol keyboard penuh, `noscript`, teks fatal jelas, marker bisa difokus |
| **i18n/l10n** | Seluruh copy bahasa Indonesia; meta description lokal |
| **Portabilitas** | `base:"./"` → bisa dihosting di path mana pun / GitHub Pages |
| **Privasi** | Tanpa cookie/tracker/backend |
| **Ukuran** | Bundle JS saja (three ≈ 600 KB min) + HTML/CSS; aset eksternal nol |

---

## 9. Metrik Sukses

| Metrik | Target | Cara ukur |
|---|---|---|
| FPS rata-rata (desktop menengah) | ≥ 55 | Panel performa / `?debug` |
| FPS rata-rata (HP menengah) | ≥ 45 | Panel performa |
| TTFB→interaktif | < 3 s (4G) | DevTools/Lighthouse |
| Rasio pengguna menemukan ≥ 4 landmark | ≥ 60% | (butuh FR-19 analitik lokal) |
| Sesi median | ≥ 2 menit | Analitik lokal |
| Bounce sebelum MULAI | < 30% | — |

---

## 10. Roadmap

| Fase | Isi | Output |
|---|---|---|
| **F1 — MVP (selesai)** | Landing planet, peta infinite, 7 landmark, journal, kontrol lengkap, perf & eco | v1.0 saat ini |
| **F2 — Poliran** | FR-19 persistensi, FR-22 bagikan, audit a11y, hapus legacy (`world.js/scene.js/controls.js`), uji lint/format, CI build | v1.1 |
| **F3 — Atmosfer** | FR-20 siklus waktu, FR-21 audio, FR-23 mode foto | v1.2 |
| **F4 — Jangkauan** | FR-24 PWA, FR-25 EN, FR-26 kompas, event musiman (festival apam?) | v2.0 |

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Perangkat lemah gagal 60 FPS | Mual/patah pengalaman | DPR adaptif + eco + fog culling (sudah ada); opsi kurangi segmen chunk di perangkat lambat |
| Konteks WebGL hilang (tab lama) | Layar kosong | `webglcontextlost` → layar fatal dengan instruksi (sudah ada) |
| Copy hilang saat refactor | Regression konten | Semua narasi ada di `data.js` — jangan duplikasi ke HTML |
| Legacy file membingungkan AI/dev baru | Perubahan di file mati | Tandai `@deprecated` / pindahkan ke `src/_legacy/` |
| Tekstur air "menarik" saat zoom jauh | Artefak visual | Offset tekstur sudah kompensasi posisi; pertahankan konstanta `WATER_TILE` |
| Penambahan landmark lupa `padHeight` | Medan tidak rata/prop tembus | Semua field wajib di §7.4; gunakan template prompt A2 |

---

## 12. Prompt Engineering untuk Developer

> Bagian ini adalah **panduan resmi** untuk bekerja bersama AI (opencode/Claude/ChatGPT/Copilot) pada repo ini. Tujuannya: hasil konsisten, tidak merusak arsitektur, dan bisa diverifikasi.

### 12.1 Prinsip inti

1. **Beri konteks file, bukan parafrase.** Selalu sebutkan path file nyata (`src/worldgen.js`, `src/data.js`, dst.). AI paling akurat bila membaca kode asli — gunakan prompt yang menyuruh AI membaca dulu.
2. **Satu tugas per prompt.** "Tambah landmark + update journal" boleh (satu fitur), "tambah landmark + audio + refactor" jangan.
3. **Kunci konstanta arsitektur** di prompt: tanpa framework, tanpa TS, tanpa aset model eksternal, gaya flat-shaded + outline, tanpa shadow map.
4. **Minta verifikasi eksplisit**: `npm run dev` di port 5173, cek FPS via panel `P`, cek `?spot=<id>`.
5. **Iterasi kecil**: minta rencana dulu untuk perubahan besar, setujui, baru minta implementasi.

### 12.2 Konteks wajib (lampirkan/sebutkan per jenis tugas)

| Jenis tugas | File yang WAJIB dibaca AI |
|---|---|
| Landmark/world/terrain | `data.js`, `worldgen.js`, `landmarks.js`, `props.js`, `materials.js`, `mapworld.js` |
| Kontrol kamera | `mapcontrols.js`, `main.js`, `data.js` (MAP_START) |
| UI/HUD | `ui.js`, `index.html`, `styles.css`, `data.js` |
| Performa | `main.js`, `worldgen.js`, `mapworld.js`, `utils.js` (GeometryBatch) |
| Landing/animasi | `landing.js`, `main.js`, `styles.css`, `ui.js` |

### 12.3 Blok konteks standar (tempel di awal prompt)

```text
KONTEKS PROYEK — Barabai Yaomink World
- Web 3D vanilla JS (ES modules) + Three.js ^0.187 + Vite. TANPA framework, TANPA TypeScript.
- Gaya visual: low-poly flat-shading, vertex colors, outline tinta via EdgesGeometry (materials.js),
  palet TEAL/CREAM/INK/GOLD/CORAL/GREEN. TANPA shadow map, TANPA aset model/tekstur eksternal.
- Dunia prosedural per chunk (worldgen.js: CHUNK_SIZE 96, LOAD_RADIUS 2, budget 1 chunk/frame,
  seed deterministik mulberry32). Loop 60Hz + eco mode + DPR adaptif ada di main.js — JANGAN ganggu.
- Copy UI 100% bahasa Indonesia. Konstanta geometri landmark: pad, padHeight, lift, viewY,
  viewDistance (lihat LANDMARKS di data.js).
- File legacy (world.js, scene.js, controls.js) TIDAK terpakai — jangan disentuh/diimpor.
- Verifikasi: npm run dev → buka ?spot=<id> & panel performa (P). Jangan commit tanpa laporan hasil.
```

### 12.4 Template prompt siap pakai

#### A1 — Bug fix
```text
[Blok konteks standar]

TUGAS: Perbaiki bug berikut.
GEJALA: <deskripsi apa yang terlihat, di kondisi apa, di perangkat apa>.
REPRODUKSI: <langkah, termasuk URL param bila relevan (mis. ?spot=masjid)>.

ATURAN:
1. Baca dulu file yang relevan (sebutkan daftarnya) sebelum mengubah apa pun.
2. Perbaiki penyebab akar, bukan gejala. Hindari try/catch yang menelan error.
3. Jangan refactor di luar cakupan bug.
4. Sebutkan bagaimana kamu memverifikasi perbaikan (langkah manual + apa yang dicek).
```

#### A2 — Menambah landmark baru (paling sering dipakai)
```text
[Blok konteks standar]

TUGAS: Tambahkan landmark baru "<Nama>" (<id kecil tanpa spasi, mis. "terminal">) ke dunia.

SPESIFIKASI:
- Posisi dunia: x=<..>, z=<..>  (jauhkan ≥ 30 unit dari landmark lain; hindari sungai riverX(z) ± 10).
- Narasi: tag, description (2–3 kalimat hangat gaya "pelan-pelan"), facts (2 chip).
- Geometri khas: <deskripsi bangunan, mis. terminal bus kecil dengan kanopi biru>.
- Palet: gunakan PALETTE dari props.js; aksen CSS hex untuk marker/detail.

LANGKAH:
1. Tambahkan entri LANDMARKS lengkap di src/data.js dengan SEMUA field:
   id, short, name, tag, description, facts, accent, x, z, pad, padHeight, lift, viewY,
   viewDistance, rotation. (padHeight harus masuk akal vs medan sekitar.)
2. Buat builder di src/landmarks.js mengikuti pola buildLandmark yang ada (Group + userData.baseY).
3. Pastikan worldgen.js otomatis mem-flat area (heightAt sudah membaca LANDMARKS — verifikasi).
4. Tambahkan bila perlu ROADS baru agar landmark tersambung jalan (data.js).
5. JANGAN ubah ui.js/main.js — marker & journal otomatis dari LANDMARKS.

VERIFIKASI:
- Buka ?spot=<id> — kamera mendarat di landmark, medan rata, tidak ada prop tembus.
- Journal menampilkan 8/8.
- FPS tetap ≥ 55 desktop.
```

#### A3 — Menambah prop prosedural
```text
[Blok konteks standar]

TUGAS: Tambah prop baru "<nama>" (mis. "warung kelontong dengan gladak") ke dunia prosedural.

SPESIFIKASI:
- Fungsi add<Nama>(p, { rng }) di src/props.js mengikuti pola addHouse/addWarung:
  pakai createPlacer/p.bbox/p.cylinder/dll, TANPA THREE.Mesh langsung (harus masuk GeometryBatch).
- Variasi via rng: <dimensi/rotasi/warna apa yang divariasikan>.
- Didistribusikan di worldgen.js buildProps dengan probabilitas <x>% — total tri budget per chunk
  tidak boleh naik > 15%.

VERIFIKASI: ?debug → panel performa: draw call tidak naik (masih ~2/chunk), segitiga naik wajar;
jalan & landmark tidak tertimbpa prop (distanceToRoad/isNearLandmark tetap dipatuhi).
```

#### A4 — Optimasi performa
```text
[Blok konteks standar]

TUGAS: <gejala, mis. "FPS turun ke 30 di iPhone saat zoom jauh">.

PROTOKOL:
1. UKUR DULU: instruksi cara mengukur (panel P / ?debug) dan angka yang kamu lihat dulu.
2. Ajukan HIPOTESIS berperingkat (paling mungkin dulu) SEBELUM menulis kode:
   geometri tri? draw call? fill-rate/DPR? JS tiap frame (GC, updateMarkers)?
3. Setelah saya setujui, implementasikan SATU perubahan terukur.
4. Larangan: mengubah arsitektur chunk, menambah Web Worker, atau memakai post-processing
   tanpa persetujuan eksplisit.
5. Verifikasi: bandingkan FPS/draw call/segitiga sebelum vs sesudah pada skenario yang sama.
```

#### A5 — Fitur UI baru
```text
[Blok konteks standar]

TUGAS: <fitur, mis. "tombol bagikan tautan ?spot=<landmark aktif>">.

SPESIFIKASI UX:
- Lokasi & perilaku: <mis. di hud-actions, ikon 🗗, toast "Tautan disalin">.
- Aksesibilitas: aria-label bahasa Indonesia, bisa dikeyboard (dft di ui.js onKeyDown).
- Copy: <teks persis>.
- Pola ikuti: tombol ecoBtn/perfBtn (class icon-btn, aria-pressed bila toggle).

ATURAN:
- UI dibangun DOM-vanilla di ui.js + CSS di styles.css + markup statis di index.html bila perlu.
- JANGAN menambah framework/jQuery/lib DOM.
- Semua string UI bahasa Indonesia.
```

#### A6 — Refactor / pembersihan
```text
[Blok konteks standar]

TUGAS: <mis. "hapus file legacy world.js, scene.js, controls.js dan pastikan tak ada referensi">.

PROTOKOL:
1. Buktikan dulu file tsb tidak diimpor (grep import) — tampilkan hasil pencarian.
2. Hapus, lalu jalankan npm run build — harus sukses tanpa warning baru.
3. npm run dev → smoke test: ?play, ?spot=masjid, klik MULAI dari landing, P untuk perf.
```

#### A7 — Rencana dulu (perubahan besar)
```text
[Blok konteks standar]

TUGAS BESAR: <mis. "sistem waktu senja-malam">.
SEBELUM CODING:
1. Baca file terkait dan ringkas pemahamanmu dalam ≤ 10 poin.
2. Usulkan rencana: file yang disentuh, urutan, risiko, dan bagaimana tiap langkah diverifikasi.
3. TUNGGU persetujuan saya. Setelah disetujui, kerjakan bertahap (satu langkah = satu commit).
```

### 12.5 Contoh prompt nyata (few-shot)

```text
[Blok konteks standar]

TUGAS: Tambahkan persistensi Temuan (localStorage).

SPESIFIKASI:
- Kunci: "byw:found" → JSON array id landmark.
- Saat ui.js discover() menemukan landmark: simpan; saat init: muat dan tandai is-found
  TANPA toast ulang (toast hanya penemuan live).
- Tambah tombol kecil "Mulai ulang" di footer journal yang menghapus kunci + reset UI.
- Kegagalan parse/kuota → diam-diam reset (jangan crash).

FILE: ui.js, index.html (footer journal), styles.css. Jangan sentuh main.js kecuali perlu wiring
(yang boleh: tidak — semua di dalam createUI).

VERIFIKASI: temukan 2 landmark → refresh → masih 2/7 tanpa toast; Mulai ulang → 0/7.
```

### 12.6 Do & Don't

| ✅ Lakukan | ❌ Hindari |
|---|---|
| Sebut path file + baca dulu sebelum edit | Menulis kode berdasar tebakan struktur |
| Pertahankan determinisme seed (mulberry32) | Memakai `Math.random()` di worldgen (dunia berubah tiap refresh) |
| Merge geometri per chunk via GeometryBatch | Membuat ratusan Mesh/LineSegments terpisah (draw call meledak) |
| Warna dari `PALETTE`/`materials.js` | Hardcode hex baru tanpa alasan kuat |
| Hormati loop 60Hz & eco mode di main.js | Menambah render()/requestAnimationFrame sendiri |
| Copy bahasa Indonesia + aria-label | String Inggris / tanpa aksesibilitas |
| Verifikasi manual + panel P setiap selesai | Klaim "seharusnya jalan" tanpa bukti |
| Rencana dulu untuk perubahan lintas modul | Big-bang refactor satu prompt |
| Satu prompt = satu tugas | Prompt gabungan 3 fitur sekaligus |

### 12.7 Checklist verifikasi standar (setiap perubahan)

```text
□ npm run dev → tidak ada error konsol
□ Landing → MULAI → transisi mulus masuk peta
□ ?play langsung peta; ?spot=<id/short> fokus landmark
□ Panel P: FPS ≥ 55 (desktop), draw call & chunk wajar (≈ 2/chunk, ≤ 25 chunk)
□ Eco mode: kamera diam → mode "Hemat daya" (FPS idle), gerak → kembali Lancar
□ Marker mengikuti objek, tidak lompat/menghilang salah
□ Journal/detail/toast tetap benar; keyboard 1–7, J, P, R, +/-, Esc
□ Ukuran layar kecil (≈ 380×844): HUD tidak menutupi, tombol dapat dijangkau
□ npm run build sukses
```

---

## 13. Lampiran — Glosarium

| Istilah | Arti |
|---|---|
| **Temuan** | Landmark yang sudah dikunjungi/diklik — progres 7 total |
| **Chunk** | Satu petak dunia 96×96 unit berisi medan+prop, dibangun/buang streaming |
| **Eco mode** | Mode hemat daya: render berhenti saat kamera diam |
| **DPR adaptif** | Pixel ratio renderer disesuaikan otomatis dari FPS |
| **FlyTo** | Animasi kamera mendekat ke landmark (damp eksponensial) |
| **Pad flatten** | Medan diratakan di sekitar landmark agar bangunan berdiri di dataran |
| **Yaomink** | Nama proyek/dunia mini — sapaan hangat untuk Barabai |
