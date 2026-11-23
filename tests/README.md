# Uji regresi backend (tanpa Google)

Menjalankan seluruh file `gas/*.gs` di Node dengan tiruan Sheets/Cache/Lock/Utilities
(termasuk perilaku Sheets yang mengubah teks tanggal menjadi Date).

    node tests/tests.js

Ini BUKAN pengganti uji di Apps Script asli (Drive, Gmail, UrlFetch, kuota waktu tidak ditiru).
