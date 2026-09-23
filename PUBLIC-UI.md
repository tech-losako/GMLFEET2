# Public site styles

The public HTML uses `vendor/public-utilities.css` generated with Tailwind 3.4.17, then `public-ui.css` for the public design. It does not require the Tailwind CDN or AOS runtime. The admin stylesheet is separate.

Rebuild the utilities after introducing utility classes in public HTML or JavaScript:

```powershell
npm.cmd exec --yes --package=tailwindcss@3.4.17 --call 'tailwindcss --config tailwind.public.config.cjs --input public-utilities.input.css --output vendor/public-utilities.css --minify'
```

Commit the generated CSS with the source changes. Image sources are recorded in `img/SOURCES.md`.

## Equipment commercial configuration

Edit `config/commercial.json` to update standalone GPS and dashcam tariffs without changing JavaScript. Publish the configuration file through the normal deployment. The service fetches this file without browser caching.

- `hardware`: one-time equipment price in USD.
- `installation`: one-time installation price; zero means no additional charge in the supplied grid.
- `monthly`: recurring subscription in USD/month.
- `null`: not confirmed; the site displays “Sur devis”, never zero or a fleet-package price.
- `note`, `terms`, and `subscriptionNote`: customer-visible commercial qualifications.

The GPS starting subscription is calculated from the configured monthly offers. Upfront costs and recurring fees are separate. Dashcam prices for cars and Jeeps remain unconfirmed; only the supplied truck standalone offer is published. Values were transcribed from the commercial structure supplied by the user, not inferred from the fleet-management package. No commitment duration has been invented.

Verify with `tests/public-directory-browser.cjs`: all supplied tariffs, unknown offers, configuration-only changes, failure fallback, and mobile/desktop layout.
