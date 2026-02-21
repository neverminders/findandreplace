# findandreplace

Aplicație web pentru procesarea simultană a mai multor fișiere `.csv` și `.tsv`, cu reguli multiple de search/replace, suport UTF-16 și descărcare **doar** pentru fișierele modificate.

## Funcționalități

- încărcare fișiere/foldere CSV/TSV prin drag & drop (inclusiv subfoldere când browserul suportă API-ul)
- mai multe reguli de search/replace în aceeași procesare
- suport encoding UTF-8 și UTF-16 (LE/BE), cu păstrarea encoding-ului la export
- versionare incrementală per fișier modificat cu sufix `-v1`, `-v2`, `-v3` etc.
- incrementarea versiunii se face numai când fișierul chiar a fost modificat

## Acces online pe GitHub (GitHub Pages)

Interfața este publicată automat cu GitHub Pages prin workflow-ul:

- `.github/workflows/deploy-pages.yml`

După push în repository, aplicația devine accesibilă la URL-ul:

- `https://<user>.github.io/findandreplace/`

> Înlocuiește `<user>` cu username-ul tău GitHub.

Dacă repo-ul este privat sau Pages nu e activat încă:

1. Mergi în **Settings → Pages**.
2. La **Build and deployment**, selectează **GitHub Actions**.
3. Rulează workflow-ul `Deploy static app to GitHub Pages` (automat la push sau manual din Actions).

## Rulare locală (opțional)

```bash
npm start
```

Serverul pornește implicit pe `http://localhost:4173` (sau pe portul din variabila `PORT`).
