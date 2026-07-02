# Mitt nyhetsflöde

Hämtar de senaste artiklarna från DN, SvD och GP, kategoriserar dem och låter dig
filtrera bort ämnen du inte vill se (t ex mat, sport, ekonomi) — utan annonser
eller layoutrörighet.

## Hur det funkar

- `netlify/functions/news.js` — en serverless-funktion som hämtar alla tre
  RSS-flöden server-side (löser CORS-problemet), läser ut kategori per artikel
  och slår ihop allt till en sorterad JSON-lista.
- `public/index.html` — en enkel sida med kryssrutor för kategori som visar
  resultatet.

### Kategorisering

- **SvD och GP** har egna `<category>`-taggar i RSS:en, dessa läses direkt.
- **DN** saknar kategori-taggar i flödet, så kategorin läses istället ur
  artikelns URL (t ex `/kultur/`, `/varlden/`, `/sport/`).

Mappningen mellan tidningarnas egna kategorinamn och de gemensamma filtren
("Sverige", "Världen", "Kultur", "Sport", "Ekonomi", "Ledare & debatt",
"Mat & livsstil", "Övrigt") finns i `CATEGORY_MAP` överst i `news.js`. Justera
den listan om du märker att en artikel hamnar i fel kategori, eller om
tidningarna lägger till nya sektioner.

## Köra lokalt

```bash
npm install
npm install -g netlify-cli   # om du inte redan har den
netlify dev
```

Öppna sedan `http://localhost:8888`.

## Driftsätta på Netlify

1. Lägg upp mappen i ett GitHub-repo.
2. Skapa en ny site på Netlify och koppla den till repot.
   Netlify läser automatiskt in `netlify.toml` (publish-mapp `public`,
   funktioner i `netlify/functions`) — inga extra inställningar behövs.
3. Klart. Funktionen nås på `/.netlify/functions/news` och sidan hämtar
   därifrån automatiskt.

## Anpassa

- **Vilka kategorier som är förvalda**: ändra `defaultOn` i `CATEGORIES`-listan
  i `index.html`.
- **Lägg till fler tidningar**: lägg till en post i `SOURCES` i `news.js` samt
  en motsvarande kategori-mappning i `CATEGORY_MAP`. Om tidningen saknar
  `<category>`-taggar (som DN) behöver du skriva en egen liten
  URL-tolkningsfunktion likt `extractDnCategory`.
- **Cache-tid**: funktionen cachar svaret i 5 minuter
  (`Cache-Control: public, max-age=300`). Ändra värdet i `news.js` om du vill
  ha tätare eller glesare uppdateringar.

## Kända begränsningar

- Detta är RSS-baserat, så du får rubrik + ingress + länk till originalartikeln
  — inte hela artikeltexten (rimligt även rent upphovsrättsligt, och du klickar
  ändå vidare till respektive tidnings sajt för att läsa, vilket känns schysst
  mot dem eftersom du redan prenumererar).
- Om en tidning ändrar sin RSS-struktur eller stänger av flödet kan
  funktionen sluta fungera för just den källan — `errors`-fältet i svaret
  talar om vilken källa som i så fall strular.
