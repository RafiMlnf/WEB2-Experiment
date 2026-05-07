/**
 * factorial.c — Source C untuk dikompilasi menjadi WebAssembly (.wasm)
 *
 * MENGAPA WEBASSEMBLY LEBIH CEPAT DARI JAVASCRIPT?
 * ─────────────────────────────────────────────────
 * 1. WebAssembly adalah format biner (bukan teks), sehingga PARSING lebih cepat.
 *    Browser tidak perlu mem-parse dan tokenize kode seperti pada JavaScript.
 *
 * 2. WebAssembly adalah bahasa yang STATICALLY TYPED (tipe data sudah pasti saat
 *    kompilasi), sedangkan JavaScript adalah dynamically typed — engine JS perlu
 *    menebak tipe data saat runtime (type inference + deoptimization overhead).
 *
 * 3. WebAssembly dikompilasi dari C/C++/Rust yang sudah dioptimalkan oleh compiler
 *    seperti Clang/LLVM dengan level optimasi tinggi (-O2, -O3).
 *    JavaScript baru di-JIT compile saat runtime, WebAssembly sudah "pre-compiled".
 *
 * 4. WebAssembly berjalan dekat dengan NATIVE MACHINE CODE — hanya satu lapisan
 *    abstraksi di atas instruksi CPU, sehingga overhead eksekusi sangat kecil.
 *
 * CARA KOMPILASI KE WASM:
 * ───────────────────────
 * Pastikan Emscripten (emcc) sudah terinstall:
 *   https://emscripten.org/docs/getting_started/downloads.html
 *
 * Jalankan perintah berikut di terminal:
 *
 *   emcc factorial.c -O2 -o factorial.js \
 *     -s WASM=1 \
 *     -s EXPORTED_FUNCTIONS='["_bench_factorial","_bench_fibonacci","_bench_math_loop"]' \
 *     -s EXPORTED_RUNTIME_METHODS='["cwrap"]' \
 *     -s MODULARIZE=1 \
 *     -s EXPORT_NAME='createModule' \
 *     -s ALLOW_MEMORY_GROWTH=1 \
 *     --no-entry
 *
 * Perintah di atas menghasilkan:
 *   - factorial.wasm  → file biner WebAssembly
 *   - factorial.js    → glue code JavaScript untuk memuat .wasm
 *
 * Flag penting:
 *   -O2                     → optimasi level 2 (performa lebih baik)
 *   -s WASM=1               → output dalam format WebAssembly
 *   -s EXPORTED_FUNCTIONS   → fungsi C yang bisa dipanggil dari JavaScript
 *   -s MODULARIZE=1         → bungkus dalam fungsi async-loadable
 *   --no-entry              → tidak ada fungsi main()
 */

#include <math.h>

/* ─────────────────────────────────────────────
   BENCHMARK 1: Factorial dengan pendekatan iteratif
   Menghitung faktorial dari N menggunakan loop.
   Operasi: N kali perkalian integer.
   ───────────────────────────────────────────── */
double bench_factorial(int n) {
    double result = 1.0;
    for (int i = 1; i <= n; i++) {
        result *= i;
    }
    return result;
}

/* ─────────────────────────────────────────────
   BENCHMARK 2: Fibonacci iteratif dalam loop besar
   Menjalankan fibonacci sebanyak `iterations` kali
   untuk membebani CPU.
   Operasi: integer addition dalam loop bersarang.
   ───────────────────────────────────────────── */
long long bench_fibonacci(int n, int iterations) {
    long long result = 0;
    for (int iter = 0; iter < iterations; iter++) {
        long long a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            long long c = a + b;
            a = b;
            b = c;
        }
        result = b;
    }
    return result;
}

/* ─────────────────────────────────────────────
   BENCHMARK 3: Heavy math loop
   Melakukan operasi matematika berat (sqrt, sin, cos)
   dalam loop besar — sangat menguras CPU.
   Ini adalah benchmark yang paling mencerminkan
   perbedaan nyata antara JS dan WASM.
   ───────────────────────────────────────────── */
double bench_math_loop(int iterations) {
    double result = 0.0;
    for (int i = 0; i < iterations; i++) {
        result += sqrt((double)i) * sin((double)i) + cos((double)i);
    }
    return result;
}
