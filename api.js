import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { readFile } from 'fs/promises';

const app = new Hono();

// Serve static files from the 'public' directory
app.use('/*', serveStatic({ root: './public' }));

// Load the JSON data
let data = [];
try {
  const fileContent = await readFile('./uat_enriched_final.json', 'utf-8');
  data = JSON.parse(fileContent);
  console.log(`Loaded ${data.length} UAT records.`);
} catch (error) {
  console.error('Error loading data:', error);
}

// Helper to normalize strings for search (lowercase, remove diacritics)
const normalize = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');
};

// Global UAT search endpoint
app.get('/api/uat', (c) => {
  const { siruta, cui, judet, denumire } = c.req.query();

  let results = data;

  if (siruta) {
    results = results.filter(item => String(item.SIRUTA) === String(siruta));
  }
  
  if (cui) {
    results = results.filter(item => String(item.cui) === String(cui));
  }

  if (judet) {
    const searchJudet = normalize(judet);
    results = results.filter(item => normalize(item.Judet).includes(searchJudet));
  }

  if (denumire) {
    const searchDenumire = normalize(denumire);
    results = results.filter(item => normalize(item.Localitate).includes(searchDenumire));
  }

  // Return all records if no filters are provided, otherwise the filtered list
  return c.json(results);
});

const port = 3001;
console.log(`🚀 Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});
