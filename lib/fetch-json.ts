// Pembaca response standar utk loader halaman (client). Sebelumnya hampir
// semua loader menulis `.then((r) => r.json())` tanpa cek `r.ok` - kalau API
// balas 404/500, objek `{error}`-nya ikut disimpan sbg data lalu halaman
// crash (TypeError) atau tetap "Memuat..." selamanya. Dengan ini response
// gagal jadi exception yang bisa ditangkap `.catch()` & ditampilkan sbg
// pesan yang jelas. Perbaikan UI menyeluruh 2026-09-19.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Default `any` (bukan `unknown`) sengaja - meniru tipe `res.json()` bawaan,
// supaya pemanggil lama `.then(setState)` tetap mengetik tanpa cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJson<T = any>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Gagal memuat data (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // body bukan JSON (mis. halaman error HTML) - pakai pesan default
    }
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return fetch(input, init).then((r) => readJson<T>(r));
}

// Pesan error yang aman ditampilkan ke user (tanpa teks teknis).
export function errorMessage(e: unknown, fallback = "Terjadi kesalahan, coba lagi."): string {
  if (e instanceof HttpError) return e.message;
  return fallback;
}

// Utk handler mutasi: ambil pesan `{error}` dari response gagal dgn aman.
// Sebelumnya `const err = await res.json(); toast.error("Gagal: " + err.error)`
// - crash kalau body bukan JSON (halaman error HTML) dan tampil
// "Gagal: undefined" kalau API tidak mengirim `error`.
export async function readErrorMessage(res: Response, fallback = "Terjadi kesalahan, coba lagi."): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // bukan JSON
  }
  return fallback;
}
