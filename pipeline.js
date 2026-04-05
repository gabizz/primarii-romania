import axios from 'axios';
import * as cheerio from 'cheerio';
import csv from 'csv-parser';
import moment from 'moment';
import fs from 'fs';
import _ from 'lodash';

const CSV_URL = 'https://raw.githubusercontent.com/geospatialorg/date-contact-localitati/main/date_de_contact_localitati.csv';
const DPFBL_BASE = 'http://www.dpfbl.mdrap.ro/';
const ANAF_ENDPOINT = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';

async function fetchCsv() {
  console.log("Fetching base CSV...");
  const response = await axios({
    url: CSV_URL,
    method: 'GET',
    responseType: 'stream'
  });

  const results = [];
  return new Promise((resolve, reject) => {
    response.data.pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function scrapeDpfbl() {
  console.log("Scraping DPFBL portal for CUIs...");
  const mainPage = await axios.get(DPFBL_BASE + 'harta_judete_cont_unic.html');
  const $ = cheerio.load(mainPage.data);
  const links = [];
  $('area').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('cont-unic.html')) {
      links.push(href);
    }
  });

  // Unique links
  const uniqueLinks = _.uniq(links.map(l => l.replace(DPFBL_BASE, '')));
  console.log(`Found ${uniqueLinks.length} county specific pages.`);

  const cuiData = [];
  for (const link of uniqueLinks) {
    try {
      if (!link.startsWith('http')) {
        var page = await axios.get(DPFBL_BASE + link);
      } else {
        var page = await axios.get(link);
      }
      
      const $page = cheerio.load(page.data);
      
      // Look for rows. We know that denumire is in div.denumire and cod is in div.cod_siruta
      const uats = $page('.denumire');
      const codes = $page('.cod_siruta');
      
      for (let i = 0; i < uats.length; i++) {
        const uatName = $page(uats[i]).text().trim();
        const code = $page(codes[i]).text().trim();
        if (uatName && code && code !== 'COD FISCAL' && code !== '') {
          cuiData.push({
            name: uatName,
            cui: code,
            countyLink: link
          });
        }
      }
    } catch (e) {
      console.error(`Failed to scrape ${link}`);
    }
  }
  return cuiData;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAnafDataBatch(cuiArray) {
  const dt = moment().format("YYYY-MM-DD");
  const payload = cuiArray.map(cui => ({ cui: cui, data: dt }));

  try {
    const response = await axios.post(ANAF_ENDPOINT, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000
    });
    
    const result = response.data;
    let enrichedData = {};
    if (result.found && Array.isArray(result.found)) {
      enrichedData = result.found.reduce((acc, el) => ({
        ...acc,
        [el.date_generale.cui]: {
          denumire: el.date_generale.denumire,
          adresa: el.date_generale.adresa
        }
      }), {});
    }
    return enrichedData;
  } catch (error) {
    console.error("ANAF API Error:", error.message);
    return null;
  }
}

async function runPipeline() {
  const baseData = await fetchCsv();
  console.log(`Loaded ${baseData.length} localities from CSV.`);

  const scrapedData = await scrapeDpfbl();
  console.log(`Scraped ${scrapedData.length} records from DPFBL.`);

  // Enrich CSV with CUI
  let matchedCount = 0;
  let missingCui = [];
  
  for (const item of baseData) {
    const county = item.judet;
    let name = item.nume;
    if (name) {
      // try to adjust name slightly to match standard naming. DPFBL uses "COMUNA X" etc.
      // E.g. "Abus" from MS vs maybe "COMUNA ZAGAR" or whatever
    }
    
    const normName = normalizeStr(item.Localitate || item.nume);
    const normCounty = normalizeStr(item.Judet || item.judet);
    
    // Simplistic fuzzy matching
    if (!normName) {
      missingCui.push(item);
      continue;
    }

    const match = scrapedData.find(s => {
      const sName = normalizeStr(s.name);
      return sName && (sName.includes(normName) || normName.includes(sName));
    });
    
    if (match) {
      item.cui = match.cui;
      matchedCount++;
    } else {
      missingCui.push(item);
    }
  }

  console.log(`Matched ${matchedCount} out of ${baseData.length} CUIs.`);
  
  // Filter for those with CUI
  const itemsWithCui = baseData.filter(i => i.cui);
  console.log(`Proceeding to ANAF with ${itemsWithCui.length} items`);

  // ANAF enrich
  const chunks = _.chunk(itemsWithCui, 50);
  let processed = 0;

  for (const chunk of chunks) {
    console.log(`Processing batch of ${chunk.length} items for ANAF...`);
    const cuis = chunk.map(c => c.cui);
    const anafData = await fetchAnafDataBatch(cuis);

    if (anafData) {
      for (const item of chunk) {
        const adrData = anafData[item.cui];
        if (adrData) {
          item.adresa_oficiala = adrData.adresa;
          item.denumire_oficiala = adrData.denumire;
        }
      }
    }
    
    processed += chunk.length;
    console.log(`Done ${processed}/${itemsWithCui.length}`);
    await sleep(500); // respects rate limits
  }

  // Write out
  console.log("Writing final output...");
  fs.writeFileSync('uat_enriched_final.json', JSON.stringify(baseData, null, 2));
  console.log("Done!");
}

runPipeline().catch(console.error);
