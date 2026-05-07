# JS vs WebAssembly — Benchmark Performa

### Link website : https://jsvswasm.vercel.app/

Eksperimen sederhana untuk membandingkan kecepatan eksekusi **JavaScript** vs **WebAssembly** secara langsung di browser.

---

## Struktur Project

```
t - web 2 - assembly vs js/
├── index.html       # Halaman utama
├── style.css        # Stylesheet (minimalis, monokrom)
├── script.js        # Benchmark controller
├── factorial.c      # Source C (dikompilasi ke WASM)
├── factorial.js     # Glue JS (output emcc) — generate saat kompilasi
├── factorial.wasm   # Binary WASM — generate saat kompilasi
└── README.md
```

---

## Cara Menjalankan (Tanpa Compile WASM)

Project sudah dilengkapi **demo mode** — WebAssembly akan disimulasikan jika `factorial.wasm` belum tersedia.

### Menggunakan Python

```bash
# Python 3
python -m http.server 8080

# Buka browser: http://localhost:8080
```

### Menggunakan Node.js (npx)

```bash
npx serve .
# atau
npx http-server . -p 8080
```

### Menggunakan VS Code

Install ekstensi **Live Server**, klik kanan `index.html` → *Open with Live Server*.

> **Penting:** Jangan buka `index.html` langsung sebagai file (`file://`) — browser memblokir loading `.wasm` dari filesystem lokal karena CORS policy.

---

## Cara Compile WebAssembly (Emscripten)

### 1. Install Emscripten

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh   # Linux/macOS
# atau: emsdk_env.bat   # Windows CMD
```

### 2. Compile `factorial.c` → `factorial.wasm`

```bash
emcc factorial.c -O2 -o factorial.js \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_bench_factorial","_bench_fibonacci","_bench_math_loop"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='createModule' \
  -s ALLOW_MEMORY_GROWTH=1 \
  --no-entry
```

**Penjelasan flag:**

| Flag | Keterangan |
|------|------------|
| `-O2` | Optimasi level 2 (kecepatan vs ukuran binary yang seimbang) |
| `-s WASM=1` | Output format WebAssembly binary |
| `-s EXPORTED_FUNCTIONS` | Fungsi C yang bisa dipanggil dari JS |
| `-s EXPORTED_RUNTIME_METHODS='["cwrap"]'` | Ekspos helper `cwrap()` untuk wrapping fungsi |
| `-s MODULARIZE=1` | Bungkus dalam fungsi `createModule()` yang async |
| `-s EXPORT_NAME='createModule'` | Nama fungsi factory module |
| `-s ALLOW_MEMORY_GROWTH=1` | Izinkan heap WASM tumbuh dinamis |
| `--no-entry` | Tidak ada `main()` — pure library |

Hasil: dua file baru di direktori yang sama:
- `factorial.js` — JavaScript glue code
- `factorial.wasm` — Binary WebAssembly

### 3. Jalankan local server lagi

```bash
python -m http.server 8080
```

Refresh browser — status WASM berubah dari `⚠ Demo` menjadi `✓ Ready`.

---

## Benchmark yang Tersedia

| Benchmark | Deskripsi | Kenapa CPU-heavy? |
|-----------|-----------|-------------------|
| **Factorial (iteratif)** | Hitung N! diulang ribuan kali | Perkalian integer berulang |
| **Fibonacci (iteratif)** | Hitung Fib(N) dengan loop bersarang | Integer addition skala besar |
| **Heavy Math Loop** | `sqrt + sin + cos` dalam jutaan iterasi | Floating-point intensif |

---

## Mengapa WebAssembly Lebih Cepat?

| Faktor | JavaScript | WebAssembly |
|--------|-----------|-------------|
| **Format** | Teks (perlu parse + tokenize) | Biner (langsung decode) |
| **Typing** | Dinamis (runtime type inference) | Statis (tipe sudah pasti saat kompilasi) |
| **Kompilasi** | JIT saat runtime | Pre-compiled oleh LLVM/Clang |
| **Optimasi** | Tergantung JIT engine | `-O2/-O3` dari compiler C |
| **Overhead** | GC, deoptimization, boxing | Minimal — near-native execution |

> **Catatan:** Pada beban ringan, JavaScript bisa menang karena V8's JIT sangat agresif mengoptimalkan hot loop. WASM baru unggul signifikan pada operasi berat yang melibatkan floating-point intensif dan loop besar.

---

## Contoh Hasil Benchmark

*(Diuji di Chrome, AMD Ryzen 5 2600, Windows 11)*

### Heavy Math Loop — 5 juta iterasi

```
JavaScript  :  312.45 ms
WebAssembly :   89.23 ms
Selisih     :  223.22 ms
Speedup     :  3.50× lebih cepat (WASM)
```

### Fibonacci Fib(40) × 200k

```
JavaScript  :  445.12 ms
WebAssembly :  134.67 ms
Speedup     :  3.31× lebih cepat (WASM)
```

### Factorial 1000! × 100k

```
JavaScript  :  187.33 ms
WebAssembly :   61.08 ms
Speedup     :  3.07× lebih cepat (WASM)
```

---

## Teknologi

- HTML5 + Vanilla CSS + Vanilla JavaScript (ES2020+)
- C99 (source WebAssembly)
- Emscripten (emcc) untuk kompilasi C → WASM
- `performance.now()` untuk pengukuran presisi tinggi

---