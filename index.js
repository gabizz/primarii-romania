import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { readFile } from 'fs/promises';
import path from 'path';

const app = new Hono().basePath('/api');

let data = [];
const loadData = async () => {
  if (data.length > 0) return data;
  try {
    // Vercel filesystem access
    const filePath = path.join(process.cwd(), 'uat_enriched_final.json');
    const fileContent = await readFile(filePath, 'utf-8');
    data = JSON.parse(fileContent);
    return data;
  } catch (error) {
    console.error('Error loading data:', error);
    return [];
  }
};

const normalize = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');
};

app.get('/uat', async (c) => {
  const uatData = await loadData();
  const { siruta, cui, judet, denumire } = c.req.query();

  let results = uatData;

  if (siruta) results = results.filter(item => String(item.SIRUTA) === String(siruta));
  if (cui) results = results.filter(item => String(item.cui) === String(cui));
  if (judet) {
    const searchJudet = normalize(judet);
    results = results.filter(item => normalize(item.Judet || item.judet).includes(searchJudet));
  }
  if (denumire) {
    const searchDenumire = normalize(denumire);
    results = results.filter(item => normalize(item.Localitate || item.Localitate).includes(searchDenumire));
  }

  return c.json(results);
});

export default handle(app);
