# findandreplace

Aplicație web statică pentru încărcarea simultană a mai multor fișiere `.csv` și `.tsv`, căutare/înlocuire text în toate fișierele și descărcarea rezultatelor redenumite incremental (`_v001`, `_v002`, etc.).

## Rulare locală

Fiind o aplicație statică, poți porni rapid un server local:

```bash
python3 -m http.server 8000
```

Apoi deschide `http://localhost:8000` în browser.
