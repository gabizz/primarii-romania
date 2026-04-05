import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const DATA_FILE = './uat_enriched_final.json';
const BASE_URL = 'http://www.dpfbl.mdrap.ro';
const MAIN_PAGE = `${BASE_URL}/harta_judete_cont_unic.html`;

const normalize = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/\b(comuna|municipiul|oras|sat|loc|judetul)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

async function run() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const { data: mainBuffer } = await axios.get(MAIN_PAGE, { responseType: 'arraybuffer' });
    const mainHtml = iconv.decode(mainBuffer, 'iso-8859-1');
    const $main = cheerio.load(mainHtml);
    
    const countyLinks = new Set();
    $main('area[href*="-cont-unic.html"]').each((_, el) => {
        let href = $main(el).attr('href');
        if (!href.startsWith('http')) href = `${BASE_URL}/${href}`;
        countyLinks.add(href);
    });

    const cuiMap = new Map();

    for (const url of countyLinks) {
        try {
            const { data: countyBuffer } = await axios.get(url, { responseType: 'arraybuffer' });
            const countyHtml = iconv.decode(countyBuffer, 'iso-8859-1');
            const $ = cheerio.load(countyHtml);
            
            // Fix judetNameFromPage by only looking at the title which is clean: <title>Județul Alba</title>
            const pageTitle = $('title').text().trim();
            const judetMatch = pageTitle.match(/jude[tţ]ul (.*)/i);
            let judetNameFromPage = judetMatch ? judetMatch[1].trim() : '';
            if (url.includes('/B-cont-unic')) judetNameFromPage = 'BUCURESTI';
            
            const uats = $('.denumire');
            const codes = $('.cod_siruta');
            
            for (let i = 0; i < uats.length; i++) {
                const uatName = $(uats[i]).text().trim();
                const cuiValue = $(codes[i]).text().trim().replace(/\s/g, '');
                if (uatName && cuiValue && !isNaN(parseInt(cuiValue)) && !uatName.includes('DENUMIRE UAT') && !uatName.includes('JUDEȚUL')) {
                    const key = normalize(judetNameFromPage) + normalize(uatName);
                    cuiMap.set(key, cuiValue);
                }
            }
        } catch (err) {}
    }

    let updated = 0;
    data.forEach(item => {
        const itemJudet = item.Judet || item.judet || "";
        const itemLocalitate = item.Localitate || item.nume || "";
        
        let key = normalize(itemJudet) + normalize(itemLocalitate);
        let keyNoJudet = normalize(itemLocalitate);
        
        if (cuiMap.has(key)) {
            item.cui = cuiMap.get(key);
            updated++;
        } else if (cuiMap.has(keyNoJudet)) {
            item.cui = cuiMap.get(keyNoJudet);
            updated++;
        } else if (itemJudet === 'BUCURESTI') {
            const sectKey = normalize("BUCURESTI" + itemLocalitate.replace('SECTORUL ', 'SECTOR '));
            if(cuiMap.has(sectKey)) {
                item.cui = cuiMap.get(sectKey);
                updated++;
            }
        }
    });

    console.log(`Matched and updated: ${updated}/${data.length}`);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

run();
