/**
 * Cloudflare Pages Function — API Backend untuk Filling Management PKWT
 * Path: functions/api/[[route]].js
 *
 * Binding D1 yang dibutuhkan (set di Cloudflare Dashboard → Settings → Functions → D1 Bindings):
 *   Variable name : pkwt_db
 *   D1 database   : pkwt_db
 */

// ── Helper: Buat response JSON dengan CORS headers ────────────────────────────
function jsonOk(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function jsonErr(message, status = 500) {
  return jsonOk({ error: message }, status);
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Health check via GET
  if (request.method === "GET") {
    const dbOk = !!env.pkwt_db;
    return jsonOk({
      status: "ok",
      message: "Filling Management API — Cloudflare D1",
      db_binding: dbOk ? "connected" : "NOT FOUND — cek D1 binding name = pkwt_db",
    });
  }

  // Semua operasi data via POST
  if (request.method !== "POST") {
    return jsonErr("Method not allowed", 405);
  }

  // Validasi D1 binding
  if (!env.pkwt_db) {
    return jsonErr(
      "Database binding 'pkwt_db' tidak ditemukan. Pastikan binding D1 sudah diatur di Cloudflare Dashboard dengan Variable name = pkwt_db."
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonErr("Request body bukan JSON yang valid.");
  }

  const action = payload.action || "";

  try {
    switch (action) {

      // ── GET DATA (paginated + search) ──────────────────────────────────────
      case "getPkwtData": {
        const offset = Math.max(0, parseInt(payload.offset) || 0);
        const search = (payload.search || "").trim();

        let baseQuery = `
          SELECT * FROM pkwt
          WHERE (status_delete IS NULL OR status_delete != 'DELETED')
        `;
        const params = [];

        if (search) {
          baseQuery += ` AND (
            LOWER(id_pkwt)       LIKE ? OR
            LOWER(nama_karyawan) LIKE ? OR
            LOWER(nrk)           LIKE ? OR
            LOWER(client)        LIKE ?
          )`;
          const s = `%${search.toLowerCase()}%`;
          params.push(s, s, s, s);
        }

        const countResult = await env.pkwt_db
          .prepare(`SELECT COUNT(*) as total FROM pkwt WHERE (status_delete IS NULL OR status_delete != 'DELETED')${search ? ` AND (LOWER(id_pkwt) LIKE ? OR LOWER(nama_karyawan) LIKE ? OR LOWER(nrk) LIKE ? OR LOWER(client) LIKE ?)` : ""}`)
          .bind(...(search ? [`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`] : []))
          .first();

        const dataResult = await env.pkwt_db
          .prepare(`${baseQuery} ORDER BY id_pkwt DESC LIMIT 20 OFFSET ?`)
          .bind(...params, offset)
          .all();

        return jsonOk({
          data: dataResult.results,
          total: countResult?.total || 0,
          offset,
        });
      }

      // ── EXPORT SEMUA DATA YANG ADA TGL KEMBALI ────────────────────────────
      case "exportKembaliData": {
        const result = await env.pkwt_db
          .prepare(`
            SELECT * FROM pkwt
            WHERE tanggal_kembali IS NOT NULL
              AND (status_delete IS NULL OR status_delete != 'DELETED')
            ORDER BY id_pkwt
          `)
          .all();

        return jsonOk({ data: result.results });
      }

      // ── UPLOAD CSV → INSERT/UPDATE D1 ─────────────────────────────────────
      case "uploadCSVToBQ": {
        const csvText = payload.csvContent;
        if (!csvText || typeof csvText !== "string") {
          return jsonErr("csvContent kosong atau bukan string.");
        }

        // Pisah baris, buang yang kosong
        let lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return jsonErr("CSV hanya berisi header, tidak ada baris data.");

        // Buang baris Excel "sep=,"
        if (lines[0].toLowerCase().startsWith("sep=")) lines.shift();

        // Parse header
        const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());

        // Fungsi cari indeks kolom by keyword
        const idx = (...keywords) =>
          headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));

        const colMap = {
          id:         idx("id_pkwt", "id pkwt"),
          nrk:        idx("nrk"),
          nama:       idx("nama_karyawan", "nama karyawan"),
          client:     idx("client"),
          jenis:      idx("jenis_surat", "jenis surat"),
          status:     idx("status_pkwt", "status pkwt", "status"),
          awal:       idx("awal_kontrak", "awal kontrak"),
          akhir:      idx("akhir_kontrak", "akhir kontrak"),
          jabatan:    idx("jabatan"),
          lokasi:     idx("lokasi"),
          sub_branch: idx("sub_branch", "sub branch"),
          branch:     idx("branch"),
          pembuatan:  idx("tanggal_pembuatan", "pembuatan"),
          terima:     idx("terima_oleh", "terima"),
          kirim:      idx("tanggal_kirim", "tgl kirim"),
          kembali:    idx("tanggal_kembali", "tgl kembali"),
          pic:        idx("pic_pkwt", "pic"),
          scan:       idx("tanggal_scan", "tgl scan"),
          filling:    idx("tanggal_filling", "tgl filling"),
          upload:     idx("tanggal_upload", "tgl upload"),
          keterangan: idx("keterangan"),
        };

        if (colMap.id === -1) {
          return jsonErr(`Kolom 'id_pkwt' tidak ditemukan. Header CSV yang terbaca: ${headers.join(", ")}`);
        }

        // Build batch statements
        const statements = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVRow(lines[i]);
          const g = (key) => {
            const i = colMap[key];
            if (i < 0 || row[i] === undefined) return null;
            const v = row[i].trim();
            return v === "" ? null : v;
          };

          const idPkwt = g("id");
          if (!idPkwt) continue;

          statements.push(
            env.pkwt_db.prepare(`
              INSERT INTO pkwt (
                id_pkwt, nrk, nama_karyawan, client, jenis_surat, status,
                awal_kontrak, akhir_kontrak, jabatan, lokasi, sub_branch, branch,
                tanggal_pembuatan, terima_oleh, tanggal_kirim, tanggal_kembali, pic_pkwt,
                tanggal_scan, tanggal_filling, tanggal_upload, keterangan_upload
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id_pkwt) DO UPDATE SET
                tanggal_kembali   = COALESCE(excluded.tanggal_kembali,   pkwt.tanggal_kembali),
                tanggal_scan      = COALESCE(excluded.tanggal_scan,      pkwt.tanggal_scan),
                tanggal_filling   = COALESCE(excluded.tanggal_filling,   pkwt.tanggal_filling),
                tanggal_upload    = COALESCE(excluded.tanggal_upload,    pkwt.tanggal_upload),
                keterangan_upload = COALESCE(excluded.keterangan_upload, pkwt.keterangan_upload)
            `).bind(
              idPkwt,        g("nrk"),     g("nama"),   g("client"), g("jenis"),    g("status"),
              g("awal"),     g("akhir"),   g("jabatan"),g("lokasi"), g("sub_branch"),g("branch"),
              g("pembuatan"),g("terima"),  g("kirim"),  g("kembali"),g("pic"),
              g("scan"),     g("filling"), g("upload"), g("keterangan")
            )
          );
        }

        if (statements.length === 0) {
          return jsonErr("Tidak ada baris valid yang bisa diproses dari file ini.");
        }

        // Eksekusi D1 batch per 100 baris
        let count = 0;
        const CHUNK = 100;
        for (let i = 0; i < statements.length; i += CHUNK) {
          await env.pkwt_db.batch(statements.slice(i, i + CHUNK));
          count += Math.min(CHUNK, statements.length - i);
        }

        return jsonOk({ result: `Sukses menyimpan ${count} baris data ke Database D1.` });
      }

      // ── SOFT DELETE ───────────────────────────────────────────────────────
      case "softDelete": {
        const idPkwt = payload.idPkwt;
        if (!idPkwt) return jsonErr("idPkwt wajib diisi.");

        await env.pkwt_db
          .prepare("UPDATE pkwt SET status_delete = 'DELETED' WHERE id_pkwt = ?")
          .bind(idPkwt)
          .run();

        return jsonOk({ result: "Success" });
      }

      default:
        return jsonErr(`Action tidak dikenal: "${action}"`, 400);
    }

  } catch (err) {
    // Kembalikan pesan error yang jelas ke frontend
    return jsonErr(`Server error: ${err.message || String(err)}`);
  }
}

// ── CSV Row Parser (handle koma dalam quotes) ─────────────────────────────────
function parseCSVRow(line) {
  const cols = [];
  let curr = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { curr += '"'; i++; }
    else if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { cols.push(curr); curr = ""; }
    else { curr += c; }
  }
  cols.push(curr);
  return cols;
}
