# Good Area

Good Area is a production-minded MVP web app for answering one core question quickly and transparently:

Is this housing option in a good area for me?

The current implementation is a production-minded MVP slice built with Next.js, TypeScript, Tailwind, Prisma, and PostgreSQL/PostGIS-oriented schema design. It runs end-to-end in demo mode without external API keys, and now also supports a hybrid/live path for real maps plus approved provider-backed listings, geocoding, POIs, and routing when API keys are configured.

## What is included

- Home page with search entry points for rentals, for-sale homes, and manual address evaluation
- Search results page with split list + real MapLibre-based map layout
- Property detail page with score breakdown, explanation panel, amenities, commute context, and must-have pass/fail states
- Preferences page with locally stored MVP preference controls
- Compare page for side-by-side review of top properties
- Typed provider interfaces for listing, geocoding, routing, POI, and safety data
- Mock/demo provider implementations and live-provider adapters
- Deduplication utilities for merging multi-source property records
- Explainable scoring engine with sub-scores and hard-rule evaluation
- Richer filters for price, beds, baths, square footage, property type, and key amenities
- Prisma schema and seed script for normalized relational storage

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL + PostGIS-ready schema design
- Zod for typed validation

## Demo mode

Demo mode is the default configuration.

It uses:

- mock listing providers standing in for Zillow, Redfin, Realtor.com, and manual entry
- mock safety metrics
- mock nearby amenities
- mock travel-time metrics
- seeded preferences and saved personal places

This means the app can be explored locally without API keys or licensed data.

## Live and hybrid mode

The app now supports provider-swappable live integrations:

- RentCast for real listing search
- Geoapify for geocoding
- Geoapify for nearby points of interest
- Geoapify for route matrix / travel times
- local LASD Part I / Part II CSV imports for geocoded crime incidents
- LAPD calls-for-service CSV snapshots for recent operational context
- MapLibre for interactive map rendering, with Geoapify hosted styles when configured and an OpenStreetMap raster fallback when not

Recommended rollout modes:

- `APP_MODE=demo`: fully mocked
- `APP_MODE=hybrid`: use live providers where keys exist and fall back elsewhere
- `APP_MODE=live`: prefer live providers everywhere you have configured support

## Architecture

The app is organized so provider integrations can be replaced later without rewriting the UI or scoring engine.

### Key folders

- `app/`: Next.js routes and page composition
- `components/`: reusable UI and feature components
- `lib/types/`: normalized domain models and typed contracts
- `lib/providers/`: provider interfaces plus mock implementations
- `lib/data/`: sample/demo data
- `lib/`: scoring, filtering, dedupe, validation, and demo orchestration
- `prisma/`: database schema and seed script

### Provider abstraction

Provider interfaces are defined in `lib/providers/interfaces.ts`:

- `ListingProvider`
- `GeocoderProvider`
- `RoutingProvider`
- `PoiProvider`
- `SafetyProvider`

The current mock implementation lives in `lib/providers/mock.ts`.
The live adapters and provider selection live in `lib/providers/live.ts` and `lib/providers/registry.ts`.

To add a real provider later:

1. Implement the matching interface.
2. Normalize external payloads into the internal domain model.
3. Plug the provider into the service orchestration layer.
4. Preserve graceful degradation when fields are missing or unavailable.

### Data flow

1. Listing provider returns raw property candidates.
2. Properties are normalized and deduplicated into canonical records.
3. POI, safety, and route providers enrich each property.
4. The scoring engine computes sub-scores, overall score, highlights, tradeoffs, and must-have results.
5. Pages render transparent explanations from the computed score object.

## Real provider notes

### RentCast listings

RentCast’s official listing endpoints support searching sale and rental listings by address, city/state, zip code, or circular geography, plus filters for property type, bedrooms, bathrooms, square footage, price, days old, and status.

### Geoapify geocoding, places, and routing

Geoapify’s official APIs are used for:

- forward geocoding
- POI search within a radius
- travel-time matrix requests for walking and driving
- hosted map styles when `NEXT_PUBLIC_GEOAPIFY_KEY` is present

## Scoring model

The MVP scoring engine computes:

- Safety Score
- Accessibility Score
- Lifestyle Score
- Affordability / Value Score
- Home Fit Score
- Overall Good Area Score

### Default weights

- Safety: 30%
- Accessibility: 25%
- Affordability / Value: 20%
- Home Fit: 15%
- Lifestyle: 10%

### Explainability behavior

Each score result includes:

- top highlights
- tradeoffs
- failed must-haves
- per-rule pass/fail records
- missing-data notes

The UI surfaces:

- what data sources were used
- what was estimated or missing
- what helped the score
- what hurt the score
- which hard requirements failed

## Database model

The Prisma schema includes normalized entities for:

- `Property`
- `ListingSourceRecord`
- `CrimeMetric`
- `AmenityPOI`
- `RouteMetric`
- `UserPreferences`
- `SavedPlace`
- `PropertyScore`

The schema is PostGIS-oriented and ready for later geospatial upgrades, although this MVP demo does not yet execute PostGIS queries directly.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Turning on live providers

Add whichever keys you have to `.env.local`:

```bash
APP_MODE=hybrid
LISTING_PROVIDER=auto
GEOCODER_PROVIDER=auto
ROUTING_PROVIDER=auto
POI_PROVIDER=auto
SAFETY_PROVIDER=auto
RENTCAST_API_KEY=your_rentcast_key
GEOAPIFY_API_KEY=your_geoapify_key
NEXT_PUBLIC_GEOAPIFY_KEY=your_geoapify_key
NEXT_PUBLIC_ENABLE_ADDRESS_AUTOCOMPLETE=false
LOCAL_GEOCODER_BASE_URL=http://localhost:4000
ENABLE_REMOTE_CRIME_FETCH=false
```

Notes:

- If only Geoapify keys are present, you will still get a real map, real geocoding, POIs, and routing while listings fall back to demo data.
- If only RentCast is present, listings can come from RentCast while map styling falls back to OpenStreetMap raster tiles.
- Safety data can also be populated from imported local crime files under `data/crime/`.

## Local crime imports

You can import geocoded LASD Part I / Part II CSV exports into the app's local crime store:

```bash
npm run crime:import-lasd
```

That command reads these files by default:

- `/Users/alang/Downloads/2025-PART_I_AND_II_CRIMES.csv`
- `/Users/alang/Downloads/PART_I_AND_II_CRIMES-YTD.csv`

and writes a normalized incident file to:

- `data/crime/local-incidents.json`

You can also pass custom CSV paths:

```bash
npm run crime:import-lasd -- /absolute/path/to/file1.csv /absolute/path/to/file2.csv
```

## LAPD calls refresh

You can refresh the official LAPD calls-for-service snapshot with:

```bash
npm run crime:refresh-lapd-calls
```

This writes:

- `data/crime/lapd-calls-for-service.json`
- `data/crime/lapd-calls-for-service.metadata.json`

Note:

- The LAPD calls-for-service dataset is useful for recent operational context.
- Based on published metadata, it does not currently expose a location column, so the app does not use it directly for map pins or the heatmap.
- The local LASD imports and the geocoded LAPD crime datasets remain the map-ready sources.

## Optional database setup

If you want to use PostgreSQL for the included schema and seed flow:

1. Create a PostgreSQL database with PostGIS enabled.
2. Update `DATABASE_URL` in `.env.local`.
3. Run:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

The current UI does not require the database to run because demo mode reads from mock providers first.

## Environment variables

See `.env.example`.

Important ones:

- `APP_MODE=demo|hybrid|live`
- `NEXT_PUBLIC_APP_MODE=demo`
- `DATABASE_URL=...`
- `LISTING_PROVIDER=auto|mock|live`
- `GEOCODER_PROVIDER=auto|mock|live|local`
- `ROUTING_PROVIDER=auto|mock|live`
- `POI_PROVIDER=auto|mock|live`
- `SAFETY_PROVIDER=auto|mock|live`
- `RENTCAST_API_KEY=...`
- `GEOAPIFY_API_KEY=...`
- `NEXT_PUBLIC_GEOAPIFY_KEY=...`
- `NEXT_PUBLIC_ENABLE_ADDRESS_AUTOCOMPLETE=true|false` optional; defaults to `false` so users submit typed addresses manually instead of triggering suggestion requests while typing
- `LOCAL_GEOCODER_BASE_URL=...` optional Pelias-compatible self-hosted geocoder base URL; in `auto` mode this is preferred over Geoapify when present
- `ENABLE_REMOTE_CRIME_FETCH=true|false` optional; defaults to `false` so analyzed-location crime uses bundled/local snapshots instead of live request-time fetches
- `NEXT_PUBLIC_MAP_STYLE_URL=...`
- `API_CACHE_TTL_MS=259200000` shared API cache window, default 72 hours
- `LIVE_API_CACHE_TTL_MS=259200000` override for Geoapify, LAPD, and other live fetches
- `LOS_ANGELES_POI_CACHE_TTL_MS=259200000` override for the paginated Los Angeles POI dataset used by the map

Live API responses are cached on disk under `.runtime/api-cache`. By default, once data is pulled it is reused for 72 hours before the app fetches it again.

The map now preloads Los Angeles POIs category-by-category from Geoapify with pagination, caches the citywide dataset on disk, and renders only the POIs inside the current viewport as you pan and zoom.

If you configure a local Pelias-compatible geocoder, you can verify connectivity at:

- `/api/system/geocoder-status`

That endpoint reports the configured/effective geocoder mode and whether the local backend is reachable.

## Limitations

- Safety data still uses demo fallback unless a real safety provider is added.
- Preferences are stored locally in the browser rather than in authenticated user accounts.
- Some deeper personalization controls are still dormant in the data model and have not been reintroduced into the location-first UI.

## Next steps

- Add authenticated user accounts and persistent saved searches
- Add a real safety/crime provider adapter
- Persist live provider results in PostgreSQL/PostGIS instead of relying on on-request enrichment only
- Move scoring recomputation and provider sync into background jobs
- Add Redis caching for expensive provider lookups
- Expand filter controls and richer overlay toggles
- Add server-side persistence for preferences and saved places

## Sample demo addresses

- `315 7th Ave, Brooklyn, NY 11215`
- `24-18 31st St, Astoria, NY 11102`
- `412 Garden St, Hoboken, NJ 07030`
- `99 Bright St, Jersey City, NJ 07302`
- `420 E 79th St, New York, NY 10075`
- `65 Greene Ave, Brooklyn, NY 11238`
