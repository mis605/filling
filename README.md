# PKWT Dokbal — Frontend (GitHub Pages)

Frontend web app untuk **Filling Management PKWT Dokbal**, dihosting di GitHub Pages dan berkomunikasi dengan backend Google Apps Script via `fetch()`.

## Arsitektur

```
GitHub Pages (frontend)
    │
    │ fetch() HTTPS
    ▼
Google Apps Script (JSON API)
    │
    │ BigQuery API
    ▼
BigQuery (database)
```

## File

| File | Keterangan |
|---|---|
| `filling-management.html` | Halaman utama Filling Management |

## 🚀 Setup Sebelum Deploy

### 1. Pastikan `code_api.gs` sudah ada di GAS Project

File `gsheetToBigQuery/code_api.gs` berisi `doGet` dan `doPost` JSON API. Pastikan file ini sudah disalin ke Apps Script editor.

### 2. Nonaktifkan `doGet` lama di `code_gsheet.gs`

Di `code_gsheet.gs`, fungsi `doGet` yang melayani `HtmlService` harus dihapus atau dikomentari agar tidak bentrok dengan `doGet` di `code_api.gs`.

### 3. Deploy ulang sebagai Web App

Di Apps Script Editor:
1. Klik **Deploy → Manage Deployments → Edit**
2. Pilih **New Version**
3. Pastikan:
   - **Execute as:** Me (akun Google Anda)
   - **Who has access:** Anyone
4. Klik **Deploy** → salin URL Web App baru

### 4. Update `API_URL` di `filling-management.html`

Buka `filling-management.html` dan ganti:
```javascript
const API_URL = "https://script.google.com/macros/s/GANTI_DENGAN_DEPLOYMENT_ID/exec";
```
dengan URL Web App yang baru didapat.

### 5. Push ke GitHub & Aktifkan GitHub Pages

```bash
git add .
git commit -m "chore: add filling management frontend"
git push origin main
```

Kemudian di GitHub:
- **Settings → Pages → Branch:** `main` / folder `github/` (atau root jika repo khusus)
- Akses via: `https://[username].github.io/[repo-name]/filling-management.html`

---

## ⚠️ Catatan Keamanan

`API_URL` bersifat publik (siapapun yang punya URL Apps Script bisa memanggil API). Untuk penggunaan internal, pertimbangkan menambahkan validasi API Key di `code_api.gs`.
