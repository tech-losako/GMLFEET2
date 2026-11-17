# Camera photos in public applications

The Android Car na ngai report concerned photos taken directly from the file picker.
Previously the application forwarded the camera's MIME type unchanged and rejected
files over 10 MB, without any image preparation.

`image-uploads.js` checks image signatures, repairs missing/generic MIME metadata,
and compresses large camera photos locally to JPEG (longest side 2560 pixels).
It preserves ordinary small images and PDFs. HEIC uses native decoding first, then
the locally hosted, pinned decoder. The decoder is not requested for normal JPEGs.
Backend validation and storage limits remain unchanged.

Selections show preparing, ready-to-send, or a specific error next to the picker.
Pending/invalid captures block submission. Prepared files remain available even
when a mobile browser does not allow assigning a new `FileList`; both the review
screen and actual multipart application request read that cache.

Checks:

- `tests/mobile-camera-upload-browser.cjs`: Android-style empty/generic camera MIME,
  >10 MB photo compression, read-only FileList, actual public application payload,
  corrupt-file feedback and replacement. Optional `HEIC_SAMPLE` verifies a real HEIC.
- `tests/public-upload-browser.cjs`: all four application types, selected bytes,
  file labels and stable request ID after submission failure.

Run with `NODE_PATH` pointing to the installed Playwright runtime. For HEIC validation,
the local run used the libheif project's public `examples/example.heic` sample.
Tests simulate camera-returned files in an isolated mobile-sized browser; they do
not operate a physical Android camera. No real applications, SMS or uploads are sent.

The existing `public-flow-browser.cjs` stops at its unrelated legacy pricing fixture:
it expects the old Swift tariff while its mocked API supplies no current tariff.
The targeted upload suites pass independently of that fixture.
