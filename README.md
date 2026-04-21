# 📊 Dashboard Summary PKWT (Repo: `filling`)

Dashboard ini digunakan untuk memantau rekapitulasi status pengembalian dokumen PKWT (Dokumen Kembali/Dokbal) dari berbagai branch secara real-time.

> [!CAUTION]
> **JANGAN TERBALIK DENGAN REPO SEBELAH!**
> - Proyek ini (**github_summary**) di GitHub diberi nama repo: **`filling`** (Fokus ke Dashboard/Reporting).
> - Proyek satunya (**github_filling**) di GitHub diberi nama repo: **`dokbal`** (Fokus ke Data Entry/Operasional).

---

## 🚀 Fitur Utama
- **KPI Real-time:** Memantau jumlah dokumen *On Going*, *Kembali*, dan *Persentase Selesai*.
- **Filtering Canggih:** Filter berdasarkan rentang bulan, jenis dokumen, dan project/client.
- **Drill-down Detail:** Klik pada baris branch untuk melihat detail nama karyawan, NRK, dan status per dokumen.
- **SLA Monitoring:** Indikator warna untuk memantau kecepatan pengembalian dokumen (SLA).
- **Dual Theme:** Mendukung Mode Terang (Light) dan Mode Gelap (Dark).

## 🛠️ Arsitektur Teknis
Aplikasi ini menggunakan arsitektur **Serverless**:
- **Frontend:** Single Page Application (SPA) menggunakan HTML5, Bootstrap 5, dan Vanilla JavaScript.
- **Backend/API:** Cloudflare Workers (URL: `https://pkwt-api.helpdesk-it-82e.workers.dev`).

## 📂 Struktur Direktori
- `index.html`: File utama dashboard (Versi terbaru menggunakan Cloudflare API).
- `bq_version/`: Arsip/Versi lama yang masih menggunakan query langsung ke **BigQuery**.

---
**Maintained by:** IT Helpdesk
