# Nextbike – mapa jízd

Webová verze programů ze složky `Nextbike/PROGRAMY/MAPA` (původně Streamlit):

- **Mapa jízd** (`/`): přehrání výpůjček jednoho dne na mapě. Město se pozná z dat, přehrávání běží v prohlížeči (deck.gl + MapLibre, podklad OpenFreeMap), počasí z Open-Meteo.
- **Eko analýza** (`/eko`): socioekonomický model z `EKO_MODEL` – přínosy vs. platby města za zvolené období.

Data (export „Rentals – All Rentals … Raw Data“, CSV oddělené tabulátorem) se nahrávají v prohlížeči a nikam se neodesílají. Jména, e-maily a telefony se při načtení zahodí; zbytek zůstane jen v IndexedDB daného prohlížeče.

`public/stations.json` je vygenerovaný ze `Stations.csv` (veřejný seznam stanic Nextbike).

```bash
npm install
npm run dev
```

Nasazení: GitHub → Vercel (stejně jako CRM), každý push do `main` se nasadí sám.
