# findandreplace

Aplicație web pentru încărcarea simultană a mai multor fișiere `.csv` și `.tsv`, căutare/înlocuire text în toate fișierele și descărcarea rezultatelor redenumite incremental (`_v001`, `_v002`, etc.).

## Rulare locală

```bash
npm start
```

Serverul pornește implicit pe `http://localhost:4173` (sau pe portul din variabila `PORT`).

## De ce apărea `Not Found` în Preview

Am adăugat un server Node (`server.js`) și scriptul `npm start` ca Preview-ul să poată porni aplicația automat și să servească `index.html` la ruta `/`.
