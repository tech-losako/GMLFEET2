# Public site styles

The public HTML uses `vendor/public-utilities.css` generated with Tailwind 3.4.17, then `public-ui.css` for the public design. It does not require the Tailwind CDN or AOS runtime. The admin stylesheet is separate.

Rebuild the utilities after introducing utility classes in public HTML or JavaScript:

```powershell
npm.cmd exec --yes --package=tailwindcss@3.4.17 --call 'tailwindcss --config tailwind.public.config.cjs --input public-utilities.input.css --output vendor/public-utilities.css --minify'
```

Commit the generated CSS with the source changes. Image sources are recorded in `img/SOURCES.md`.
