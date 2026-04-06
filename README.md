# Romanian UAT Data Pipeline & API (Lista Primării)
🌍 *Dual language README: [Română](#română) | [English](#english)*

---

<a name="română"></a>
## 🇷🇴 Română

### Prezentare Generală
Acest proiect constă într-un pipeline de procesare automată a datelor și un server API conceput pentru a agrega, curăța și îmbogăți datele de contact ale Unităților Administrativ-Teritoriale (UAT / Primării) din România.

Proiectul unifică date din trei surse majore:
1. **[Geospatial.org](http://geospatial.org)**: Lista inițială a localităților sub formă de fișier CSV.
2. **Portalul DPFBL**: Face scraping web precis pentru a obține Codul Unic de Înregistrare (CUI) alocat fiecărui UAT în parte.
3. **API-ul REST ANAF**: Interoghează sistemul Ministerului Finanțelor pentru a prelua adresele fiscale oficiale înregistrate pentru respectivele CUI-uri.

Baza de date formată la final este salvată local și poate fi accesată dinamic prin intermediul unui server de API rapid creat cu framework-ul **Hono**.

### Funcționalități
- **Scraping Web Automatizat**: Extrage și mapează corect codurile fiscale folosind Cheerio, navigând izolat pe fiecare pagină de județ pentru a evita suprapunerile de denumiri.
- **Îmbogățire iterativă a datelor**: Interoghează API-ul ANAF folosind payload-uri trimise în calupuri (batches), conform normelor și limitărilor de rate-limit.
- **Normalizare Semantică**: Oferă algoritmi eficienți de curățare a diacriticelor și prefixelor administrative românești ("Municipiul", "Comuna", "Oraș") pentru maparea precisă a numelor (ex: algoritm de normalizare și potrivire după chei unice județ+nume).
- **Server API**: O soluție REST rapidă pentru filtrarea setului de date rezultat după codul SIRUTA, CUI, județ sau denumirea localității.

### Endpoints API
Serverul expune un endpoint principal pentru interogarea datelor UAT.

**Base URL:** `http://localhost:3001/api/uat` (sau adresa unde este deployat)

| Parametru | Descriere | Exemplu |
|-----------|-----------|---------|
| `siruta`  | Codul SIRUTA unic al localității | `/api/uat?siruta=9495` |
| `cui`     | Codul Unic de Înregistrare (fără "RO") | `/api/uat?cui=3519402` |
| `judet`   | Filtrare după județ (parțial, fără diacritice) | `/api/uat?judet=bihor` |
| `denumire`| Filtrare după nume localitate (parțial) | `/api/uat?denumire=oradea` |

*Notă: Dacă nu este furnizat niciun parametru, API-ul returnează întreaga listă de UAT-uri.*

### Structura Proiectului
- `pipeline.js` - Fluxul principal ETL (Extragere, Transformare, Încărcare) care preia datele, le combină și le exportă de la zero.
- `update_cui.js` - Scriptul avansat specializat exclusiv pentru maparea, corectarea și injectarea rapidă a CUI-urilor din portalul DPFBL în baza de date existentă.
- `api.js` - Server-ul Hono (rulat prin Node.js) care servește fișierele statice din folderul `/public` și expune rutele pentru `/api/uat`.
- `uat_enriched_final.json` - Baza de date rezultată (JSON) după faza de agregare și normalizare.

### Utilizare
Instalarea dependențelor necesare:
```bash
yarn install
```

**Pornirea serverului API:**
```bash
yarn start
# sau
node api.js
```
Server-ul se va inițializa la `http://localhost:3001`.

**Actualizarea datelor:**
```bash
yarn import           # Reface baza de date descărcând CSV-ul și interrogând DPFBL+ANAF
node update_cui.js    # Rulează doar utilitarul strict de validare și corectare a CUI-urilor (recomandat)
```

---

<a name="english"></a>
## 🇬🇧 English

### Overview
This project is an automated data processing pipeline and API server designed to aggregate, clean, and enrich contact data for Romanian Local Administrative Units (UAT - Unități Administrativ-Teritoriale / Town Halls). 

It consolidates data from multiple sources:
1. **[Geospatial.org](http://geospatial.org)**: Base list of localities (CSV).
2. **DPFBL Portal**: Web scraping to obtain the accurate CUI (Fiscal Code) for each UAT.
3. **ANAF REST API**: Fetches official registration data and fiscal addresses for every matching entity.

The resulting dataset is saved locally and can be accessed dynamically via a built-in REST API powered by **Hono**.

### Features 
- **Automated Web Scraping**: Extracts mapped fiscal codes strictly by County from complex HTML structures using Cheerio.
- **Batched API Enrichment**: Queries the ANAF API securely using batches to comply with rate limits.
- **Advanced Normalization**: Handles Romanian diacritics, localized administrative prefixes (e.g., "Municipiul", "Comuna"), and strict fuzzy or exact string matching to prevent false positives.
- **REST API**: A fast, out-of-the-box local API Server to filter the enriched dataset by SIRUTA code, CUI, County, or Name.

### API Endpoints
The server exposes a main endpoint for querying UAT data.

**Base URL:** `http://localhost:3001/api/uat` (or your deployment address)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `siruta`  | Unique SIRUTA code of the locality | `/api/uat?siruta=9495` |
| `cui`     | Fiscal Code (CUI) without "RO" prefix | `/api/uat?cui=3519402` |
| `judet`   | Filter by County (partial, diacritics-free) | `/api/uat?judet=bihor` |
| `denumire`| Filter by Locality Name (partial) | `/api/uat?denumire=oradea` |

*Note: If no parameters are provided, the API returns the complete dataset.*

### Project Structure
- `pipeline.js` - The main ETL (Extract, Transform, Load) workflow to generate the fully enriched base file from scratch.
- `update_cui.js` - A strict-matching script dedicated to correcting and updating the CUI mapping in the dataset by crawling all 42 county pages of the DPFBL portal.
- `api.js` - The Hono Node.js server that serves static frontend files from `./public` and exposes the `/api/uat` endpoint.
- `uat_enriched_final.json` - The final structured output database.

### Usage
Install dependencies first:
```bash
yarn install
```

**Run the API Server:**
```bash
yarn start
# or
node api.js
```
The server will start at `http://localhost:3001`.

**Update the Dataset:**
```bash
yarn import           # Generate from scratch via CSV + ANAF + DPFBL
node update_cui.js    # Run the strict CUI-only mapping engine
```
