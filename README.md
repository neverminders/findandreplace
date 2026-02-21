# findandreplace

Aplicație web pentru încărcarea simultană a mai multor fișiere `.csv` și `.tsv`, căutare/înlocuire text în toate fișierele și descărcarea rezultatelor redenumite incremental (`_v001`, `_v002`, etc.).

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
