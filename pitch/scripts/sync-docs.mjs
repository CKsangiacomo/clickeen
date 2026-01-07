#!/usr/bin/env node
/**
 * Sync pitch documentation to Vectorize index
 * 
 * Usage:
 *   node pitch/scripts/sync-docs.mjs
 *   
 * Env vars:
 *   PITCH_API_URL - defaults to http://localhost:8790
 *   PITCH_SERVICE_KEY - required for upsert auth
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '../../documentation/_pitch');
const STRATEGY_FILES = [
  path.resolve(__dirname, '../../documentation/strategy/WhyClickeen.md'),
  path.resolve(__dirname, '../../documentation/strategy/GlobalReach.md'),
];

const API_URL = process.env.PITCH_API_URL || 'http://localhost:8790';
const SERVICE_KEY = process.env.PITCH_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Error: PITCH_SERVICE_KEY env var required');
  process.exit(1);
}

// Split markdown into chunks by heading
function chunkMarkdown(content, filepath) {
  const filename = path.basename(filepath, '.md');
  const chunks = [];
  
  // Split by ## headings
  const sections = content.split(/^## /m);
  
  for (let i = 0; i < sections.length; i++) {
    let section = sections[i].trim();
    if (!section) continue;
    
    // First chunk might not have a heading (content before first ##)
    let title = filename;
    let sectionName = null;
    
    if (i > 0) {
      // Extract heading from start of section
      const lines = section.split('\n');
      sectionName = lines[0].trim();
      title = `${filename} - ${sectionName}`;
      section = lines.slice(1).join('\n').trim();
    }
    
    if (!section || section.length < 50) continue; // Skip tiny chunks
    
    // If chunk is too big, split further
    if (section.length > 4000) {
      const subChunks = splitByParagraphs(section, 3000);
      subChunks.forEach((chunk, j) => {
        chunks.push({
          id: hashId(`${filepath}-${i}-${j}`),
          text: chunk,
          title: `${title} (part ${j + 1})`,
          section: sectionName,
        });
      });
    } else {
      chunks.push({
        id: hashId(`${filepath}-${i}`),
        text: section,
        title,
        section: sectionName,
      });
    }
  }
  
  return chunks;
}

function splitByParagraphs(text, maxLen) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';
  
  for (const para of paragraphs) {
    if (current.length + para.length > maxLen && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += '\n\n' + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function hashId(str) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 16);
}

async function getMarkdownFiles(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const mdFiles = [];
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      // Recurse into subdirectories
      mdFiles.push(...await getMarkdownFiles(fullPath));
    } else if (file.name.endsWith('.md')) {
      mdFiles.push(fullPath);
    }
  }
  
  return mdFiles;
}

async function main() {
  console.log('Syncing pitch docs to Vectorize...');
  
  // Collect all markdown files
  const pitchFiles = await getMarkdownFiles(DOCS_DIR);
  const allFiles = [...pitchFiles];
  
  // Add strategy files if they exist
  for (const stratFile of STRATEGY_FILES) {
    try {
      await fs.access(stratFile);
      allFiles.push(stratFile);
    } catch {
      console.warn(`Strategy file not found: ${stratFile}`);
    }
  }
  
  console.log(`Found ${allFiles.length} markdown files`);
  
  // Process all files into chunks
  const allChunks = [];
  for (const file of allFiles) {
    const content = await fs.readFile(file, 'utf-8');
    const chunks = chunkMarkdown(content, file);
    allChunks.push(...chunks);
    console.log(`  ${path.basename(file)}: ${chunks.length} chunks`);
  }
  
  console.log(`Total chunks: ${allChunks.length}`);
  
  // Upsert in batches
  const BATCH_SIZE = 20;
  let upserted = 0;
  
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    
    const res = await fetch(`${API_URL}/v1/pitch/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SERVICE_KEY,
      },
      body: JSON.stringify({ items: batch }),
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Upsert failed: ${res.status} ${text}`);
      process.exit(1);
    }
    
    const data = await res.json();
    upserted += data.upserted || 0;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data.upserted} upserted`);
  }
  
  console.log(`\nDone! Total upserted: ${upserted}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
