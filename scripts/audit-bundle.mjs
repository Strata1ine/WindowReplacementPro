import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const bundles = path.join(root, 'audit', 'bundles');
const bundle = path.join(bundles, 'windowreplacement-site-review.zip');
const origin = 'https://windowreplacement.pro';
const generatedAt = new Date().toISOString();
const npm = process.platform === 'win32' ? process.env.ComSpec : 'npm';
const npmBuildArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build'] : ['run', 'build'];
const python = process.platform === 'win32' ? 'python' : 'python3';
const screenshotRoutes = [
  ['homepage', '/'], ['windows', '/windows/'], ['doors', '/doors/'],
  ['door-glass', '/doors/decorative-door-glass/'], ['patio-doors', '/patio-doors/'],
  ['window-replacement', '/window-replacement/'], ['window-installation', '/window-installation/'],
  ['window-replacement-cost', '/window-replacement-cost/'], ['casement-windows', '/windows/casement-windows/'],
  ['awning-windows', '/windows/awning-windows/'], ['picture-windows', '/windows/picture-windows/'],
  ['bay-windows', '/windows/bay-windows/'], ['fiberglass-entry-doors', '/doors/fiberglass-entry-doors/'],
  ['steel-entry-doors', '/doors/steel-entry-doors/'],
  ['window-product', '/products/windows/slim-frame-casement-window/'],
  ['entry-door-product', '/products/entry-doors/two-panel-fiberglass-entry-door/'],
  ['door-glass-product', '/products/door-glass/black-linear-privacy-door-glass/'],
  ['patio-door-product', '/products/patio-doors/multi-panel-sliding-patio-door/']
];
const confidential = [
  /vinyl[- ]?pro/i, /window[- ]?city/i, /masonite/i, /trimlite/i, /nova\s?tech/i,
  /verre[- ]?select/i, /mennie(?:[- ]?canada)?/i, /richersons/i, /oceanview/i,
  /vista[- ]?patio[- ]?doors/i, /source-media/i, /supplier-discovery/i,
  /internalManufacturer/i, /internalModelNumber/i, /internalCanonicalId/i, /sourceUrl/i, /sourcePageUrls/i, /sourceLocalPath/i,
  /(?:api[_-]?key|client[_-]?secret|access[_-]?token|private[_-]?key)\s*[:=]/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: root, windowsHide: true, shell: false,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  let stdout = '', stderr = '';
  child.stdout?.on('data', chunk => { stdout += chunk; });
  child.stderr?.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stdout}\n${stderr}`)));
});
const walk = async directory => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
};
const decode = value => value
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));
const text = value => decode(value
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(expression);
  return decode(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
};
const matches = (value, expression) => Array.from(value.matchAll(expression));
const unique = values => Array.from(new Set(values));
const slug = route => route === '/' ? 'index' : route.slice(1, -1).replaceAll('/', '--');
const htmlFile = route => route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.slice(1), 'index.html');
const internalRoute = href => {
  try { const url = new URL(href, origin); return url.origin === origin ? url.pathname || '/' : null; }
  catch { return null; }
};
const pageType = route => {
  if (route === '/') return 'homepage';
  if (route.startsWith('/products/')) return `product:${route.split('/')[2]}`;
  if (route.startsWith('/guides/')) return route === '/guides/' ? 'guide-hub' : 'guide';
  if (route.startsWith('/locations/')) return route === '/locations/' ? 'location-hub' : 'location';
  if (route.includes('cost')) return 'pricing';
  if (route.startsWith('/windows/')) return 'window-category';
  if (route.startsWith('/doors/')) return 'door-category';
  if (route.startsWith('/patio-doors/')) return 'patio-door-category';
  if (route.startsWith('/window-') || route === '/energy-efficient-windows/') return 'service';
  return 'general';
};
const schemaTypes = html => {
  const result = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    const type = value['@type'];
    if (Array.isArray(type)) result.push(...type.map(String)); else if (type) result.push(String(type));
    Object.values(value).forEach(child => Array.isArray(child) ? child.forEach(visit) : visit(child));
  };
  for (const match of matches(html, /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* reported by the dedicated audit */ }
  }
  return unique(result).sort();
};
const readSitemap = async () => {
  const index = await readFile(path.join(dist, 'sitemap-index.xml'), 'utf8');
  const files = matches(index, /<loc>([\s\S]*?)<\/loc>/gi).map(match => new URL(decode(match[1])).pathname.split('/').pop());
  const urls = [];
  for (const file of files) {
    const xml = await readFile(path.join(dist, file), 'utf8');
    urls.push(...matches(xml, /<loc>([\s\S]*?)<\/loc>/gi).map(match => decode(match[1])));
  }
  return { files, urls: unique(urls).sort() };
};
const parsePage = (url, html, sitemapSet) => {
  const route = new URL(url).pathname;
  const meta = matches(html, /<meta\b[^>]*>/gi).map(match => match[0]);
  const links = matches(html, /<link\b[^>]*>/gi).map(match => match[0]);
  const description = meta.find(tag => attr(tag, 'name').toLowerCase() === 'description');
  const robotsTag = meta.find(tag => attr(tag, 'name').toLowerCase() === 'robots');
  const canonical = links.find(tag => attr(tag, 'rel').toLowerCase().split(/\s+/).includes('canonical'));
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const headings = matches(main, /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)
    .map(match => ({ level: Number(match[1][1]), text: text(match[2]) })).filter(item => item.text);
  const images = matches(main, /<img\b[^>]*>/gi).map(match => match[0]);
  const internalLinks = matches(main, /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)
    .map(match => {
      const href = decode(match[1] ?? match[2] ?? match[3] ?? '');
      const target = href.startsWith('#') ? null : internalRoute(href);
      return target ? { href, target, text: text(match[4]) } : null;
    }).filter(Boolean);
  const fullMainText = text(main);
  const productEditorialText = matches(main, /<(?:p|li|dd|figcaption)\b[^>]*data-product-editorial=["'](?:summary|guidance|fact)["'][^>]*>([\s\S]*?)<\/(?:p|li|dd|figcaption)>/gi).map(match => text(match[1])).join(' ');
  const mainText = route.startsWith('/products/') ? productEditorialText : fullMainText;
  const robots = attr(robotsTag ?? '', 'content') || 'index,follow (default)';
  return {
    url, route,
    title: text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    metaDescription: attr(description ?? '', 'content'),
    h1: headings.find(item => item.level === 1)?.text ?? '',
    canonical: attr(canonical ?? '', 'href'), robots,
    indexable: !/\bnoindex\b/i.test(robots),
    sitemapStatus: sitemapSet.has(route) ? 'included' : 'missing',
    wordCount: fullMainText.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0,
    imageCount: images.length,
    internalLinks: unique(internalLinks.map(link => link.target)).sort(),
    structuredDataTypes: schemaTypes(html), pageType: pageType(route),
    extract: { headings, imageAltText: unique(images.map(image => attr(image, 'alt')).filter(Boolean)), internalLinks, mainText },
    html
  };
};
const duplicateGroups = (pages, field) => Object.entries(pages.reduce((groups, page) => {
  const value = page[field]?.trim(); if (value) (groups[value] ??= []).push(page.url); return groups;
}, {})).filter(([, urls]) => urls.length > 1).map(([value, urls]) => ({ value, urls }));
const textSimilarity = pages => {
  const grams = value => {
    const words = value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [], set = new Set();
    for (let i = 0; i + 2 < words.length; i += 1) set.add(words.slice(i, i + 3).join(' '));
    return set;
  };
  const sets = pages.map(page => grams(page.extract.mainText)), result = [];
  for (let a = 0; a < pages.length; a += 1) for (let b = a + 1; b < pages.length; b += 1) {
    if (!sets[a].size || !sets[b].size) continue;
    let overlap = 0; for (const item of sets[a]) if (sets[b].has(item)) overlap += 1;
    result.push({ left: pages[a].url, right: pages[b].url, score: Number((overlap / (sets[a].size + sets[b].size - overlap)).toFixed(4)) });
  }
  return result.sort((a, b) => b.score - a.score).slice(0, 25);
};
const brokenLinks = (pages, availableRoutes) => {
  const routes = availableRoutes, result = [];
  for (const page of pages) for (const link of page.extract.internalLinks) {
    const target = new URL(link.href, origin);
    if (!routes.has(target.pathname) && target.pathname !== '/404.html') result.push({ source: page.url, href: link.href, reason: 'target route not generated' });
    if (target.hash && routes.has(target.pathname)) {
      const targetPage = pages.find(item => item.route === target.pathname);
      const escaped = decodeURIComponent(target.hash.slice(1)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (escaped && !new RegExp(`\\bid=["']${escaped}["']`, 'i').test(targetPage.html)) result.push({ source: page.url, href: link.href, reason: 'fragment target not found' });
    }
  }
  return result;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const browserExecutable = () => [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
class Cdp {
  constructor(url) { this.socket = new WebSocket(url); this.id = 1; this.pending = new Map(); this.waiters = new Map(); }
  async open() {
    await new Promise((resolve, reject) => { this.socket.addEventListener('open', resolve, { once: true }); this.socket.addEventListener('error', reject, { once: true }); });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result); }
      else { const values = this.waiters.get(message.method) ?? []; this.waiters.set(message.method, []); values.forEach(resolve => resolve(message.params)); }
    });
  }
  send(method, params = {}) { const id = this.id++; const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); this.socket.send(JSON.stringify({ id, method, params })); return promise; }
  once(method) { return new Promise(resolve => { const values = this.waiters.get(method) ?? []; values.push(resolve); this.waiters.set(method, values); }); }
  close() { this.socket.close(); }
}
const staticServer = async () => {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
      const file = path.resolve(dist, relative), safeRoot = path.resolve(dist);
      if (file !== path.join(safeRoot, 'index.html') && !file.startsWith(safeRoot + path.sep)) throw new Error('unsafe');
      const data = await readFile(file), extension = path.extname(file).toLowerCase();
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif' };
      response.writeHead(200, { 'content-type': types[extension] ?? 'application/octet-stream' }); response.end(data);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, localOrigin: `http://127.0.0.1:${server.address().port}` };
};
const screenshots = async (review, localOrigin) => {
  const executable = browserExecutable(); if (!executable) throw new Error('Chrome or Edge is required. Set CHROME_PATH if necessary.');
  const profile = await mkdtemp(path.join(os.tmpdir(), 'wrp-audit-browser-')), port = 9400 + Math.floor(Math.random() * 400);
  const browser = spawn(executable, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let client; const results = [];
  try {
    let ready = false;
    for (let i = 0; i < 100; i += 1) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) { ready = true; break; } } catch {} await delay(100); }
    if (!ready) throw new Error('Headless browser did not start.');
    const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(localOrigin)}`, { method: 'PUT' }).then(response => response.json());
    client = new Cdp(target.webSocketDebuggerUrl); await client.open(); await Promise.all([client.send('Page.enable'), client.send('Runtime.enable')]);
    for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 960 }]) {
      await client.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false, screenWidth: viewport.width, screenHeight: viewport.height });
      for (const [name, route] of screenshotRoutes) {
        const loaded = client.once('Page.loadEventFired'); await client.send('Page.navigate', { url: localOrigin + route }); await loaded;
        const evaluated = await client.send('Runtime.evaluate', { expression: `(async()=>{for(const image of document.images)image.loading='eager';await Promise.all(Array.from(document.images,image=>image.decode().catch(()=>{})));await document.fonts.ready;await new Promise(resolve=>setTimeout(resolve,250));return {h1Count:document.querySelectorAll('h1').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,brokenImages:Array.from(document.images).filter(image=>!image.complete||!image.naturalWidth).map(image=>image.currentSrc||image.src)}})()`, awaitPromise: true, returnByValue: true });
        const qa = evaluated.result.value, metrics = await client.send('Page.getLayoutMetrics'), size = metrics.cssContentSize;
        const capture = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
        await writeFile(path.join(review, 'screenshots', viewport.name, `${name}.png`), Buffer.from(capture.data, 'base64'));
        results.push({ route, viewport: viewport.width, contentWidth: size.width, contentHeight: size.height, ...qa });
        if (qa.h1Count !== 1 || qa.horizontalOverflow || qa.brokenImages.length) throw new Error(`Screenshot QA failed for ${route} at ${viewport.width}px`);
      }
    }
  } finally { client?.close(); browser.kill(); await delay(200); await rm(profile, { recursive: true, force: true }); }
  return results;
};
const list = (values, render) => values.length ? values.map(render).join('\n') : 'None.';

await mkdir(bundles, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), 'wrp-site-review-'));
const review = path.join(temporary, 'site-review'), audits = path.join(review, 'audits');
try {
  console.log('Removing previous build output...'); await rm(dist, { recursive: true, force: true });
  console.log('Running clean production build...'); await run(npm, npmBuildArgs);
  for (const directory of ['html', 'text', 'screenshots/mobile', 'screenshots/desktop', 'audits']) await mkdir(path.join(review, directory), { recursive: true });
  const sitemap = await readSitemap(), sitemapSet = new Set(sitemap.urls.map(url => new URL(url).pathname)), pages = [];
  for (const url of sitemap.urls) {
    const route = new URL(url).pathname, source = htmlFile(route), html = await readFile(source, 'utf8'), page = parsePage(url, html, sitemapSet);
    pages.push(page); await copyFile(source, path.join(review, 'html', `${slug(route)}.html`));
    const extract = [`URL: ${url}`, `Title: ${page.title}`, `H1: ${page.h1}`, '', 'HEADINGS', ...page.extract.headings.map(item => `${'#'.repeat(item.level)} ${item.text}`), '', 'MAIN CONTENT', page.extract.mainText, '', 'IMAGE ALT TEXT', ...(page.extract.imageAltText.length ? page.extract.imageAltText.map(value => `- ${value}`) : ['None.']), '', 'INTERNAL LINKS', ...(page.extract.internalLinks.length ? page.extract.internalLinks.map(link => `- ${link.text || '(no link text)'} -> ${new URL(link.href, origin).href}`) : ['None.']), ''].join('\n');
    await writeFile(path.join(review, 'text', `${slug(route)}.txt`), extract, 'utf8');
  }
  const builtHtml = (await walk(dist)).filter(file => file.endsWith('.html'));
  const builtRoutes = new Set(builtHtml.map(file => {
    const relative = path.relative(dist, file).replaceAll('\\', '/');
    if (relative === 'index.html') return '/';
    if (relative.endsWith('/index.html')) return '/' + relative.slice(0, -10);
    return '/' + relative;
  }));
  const broken = brokenLinks(pages, builtRoutes), duplicates = { titles: duplicateGroups(pages, 'title'), descriptions: duplicateGroups(pages, 'metaDescription'), h1s: duplicateGroups(pages, 'h1') }, similarities = textSimilarity(pages);
  const metadata = { missingTitles: pages.filter(page => !page.title).map(page => page.url), missingDescriptions: pages.filter(page => !page.metaDescription).map(page => page.url), missingH1s: pages.filter(page => !page.h1).map(page => page.url), missingCanonicals: pages.filter(page => !page.canonical).map(page => page.url), mismatchedCanonicals: pages.filter(page => page.canonical !== page.url).map(page => ({ url: page.url, canonical: page.canonical })), duplicates };
  const inventory = pages.map(({ extract, html, ...page }) => page);
  await writeFile(path.join(review, 'routes.json'), JSON.stringify({ generatedAt, siteOrigin: origin, routeCount: pages.length, routes: inventory }, null, 2) + '\n');
  await writeFile(path.join(audits, 'broken-links.json'), JSON.stringify({ generatedAt, count: broken.length, brokenLinks: broken }, null, 2) + '\n');
  await writeFile(path.join(audits, 'metadata.json'), JSON.stringify({ generatedAt, ...metadata }, null, 2) + '\n');
  await writeFile(path.join(audits, 'structured-data.json'), JSON.stringify({ generatedAt, pages: pages.map(page => ({ url: page.url, types: page.structuredDataTypes })) }, null, 2) + '\n');
  await writeFile(path.join(audits, 'route-sitemap.json'), JSON.stringify({ generatedAt, sitemapFiles: sitemap.files, sitemapUrls: sitemap.urls, routeCount: pages.length, sitemapCount: sitemap.urls.length }, null, 2) + '\n');
  await writeFile(path.join(audits, 'text-similarity.json'), JSON.stringify({ generatedAt, method: 'Jaccard similarity of normalized main-content word trigrams', pairs: similarities }, null, 2) + '\n');
  const auditCommands = [
    ['category-content.txt', 'node', ['scripts/category-content-audit.mjs'], { AUDIT_OUTPUT_DIR: audits }],
    ['public-copy.txt', 'node', ['scripts/audit-public-copy.mjs']],
    ['product-content.txt', 'node', ['scripts/product-content-audit.mjs'], { AUDIT_OUTPUT_DIR: audits }],
    ['supplier-leakage.txt', 'node', ['scripts/audit-public-supplier-leakage.mjs']],
    ['taxonomy-validation.txt', python, ['scripts/validate-taxonomy.py']],
    ['route-sitemap-verification.txt', python, ['scripts/verify-build.py']],
    ['structured-data-validation.txt', 'node', ['scripts/audit-structured-data.mjs']]
  ];
  for (const [filename, command, args, env] of auditCommands) { console.log(`Running ${filename}...`); const output = await run(command, args, { capture: true, env }); await writeFile(path.join(audits, filename), output.stdout + output.stderr, 'utf8'); }
  const productAudit = JSON.parse(await readFile(path.join(audits, 'product-content.json'), 'utf8'));
  const { server, localOrigin } = await staticServer(); let screenshotResults;
  try { screenshotResults = await screenshots(review, localOrigin); } finally { await new Promise(resolve => server.close(resolve)); }
  await writeFile(path.join(audits, 'screenshot-qa.json'), JSON.stringify({ generatedAt, screenshots: screenshotResults }, null, 2) + '\n');
  const byType = Object.entries(pages.reduce((counts, page) => { counts[page.pageType] = (counts[page.pageType] ?? 0) + 1; return counts; }, {})).sort(), noImages = pages.filter(page => page.imageCount === 0), thin = pages.filter(page => page.wordCount < 500), noSchema = pages.filter(page => !page.structuredDataTypes.length), suspicious = pages.filter(page => /\b(?:eas|gov|informatio|replacemen|installatio|windo|doo|choos|becaus|whethe|thes|thi|wit|an)\s*$/i.test(page.extract.mainText) || /(?:\.{3}|…)$/.test(page.extract.mainText));
  const leakageOutput = await readFile(path.join(audits, 'supplier-leakage.txt'), 'utf8'), leakage = leakageOutput.includes('Public supplier leakage audit: OK') ? 'PASS — 0 disclosures' : 'FAIL';
  const productSchemaCount = pages.filter(page => page.structuredDataTypes.includes('Product')).length, productGroupSchemaCount = pages.filter(page => page.structuredDataTypes.includes('ProductGroup')).length;
  const summary = `# WindowReplacement.pro site review bundle\n\nGenerated: ${generatedAt}\nBuild source: current repository production build\nPublic origin: ${origin}\n\n## Headline counts\n\n- Route count: ${pages.length}\n- Sitemap count: ${sitemap.urls.length}\n- Indexable page count: ${pages.filter(page => page.indexable).length}\n- Public product count: ${pages.filter(page => page.route.startsWith('/products/')).length}\n- Supplier leakage result: ${leakage}\n\n## Pages by type\n\n${list(byType, ([type, count]) => `- ${type}: ${count}`)}\n\n## Pages with no images (${noImages.length})\n\n${list(noImages, page => `- ${page.url}`)}\n\n## Pages with fewer than 500 substantive words (${thin.length})\n\n${list(thin, page => `- ${page.url} — ${page.wordCount} words`)}\n\n## Highest textual-similarity pairs\n\nMethod: Jaccard similarity over normalized main-content word trigrams.\n\n${list(similarities.slice(0, 15), pair => `- ${(pair.score * 100).toFixed(2)}% — ${pair.left} ↔ ${pair.right}`)}\n\n## Product catalogue differentiation

- Public product pages audited: ${productAudit.pageCount}
- Highest product-only substantive similarity: ${(productAudit.pairs[0]?.score * 100 ?? 0).toFixed(1)}%
- Product pairs above 60%: ${productAudit.pairsAbove60.length}
- Product pairs above 65%: ${productAudit.pairsAbove65.length}
- Product pages with prohibited internal-workflow language: ${productAudit.prohibitedInternalLanguagePages.length}
- Product pages with insufficient unique editorial: ${productAudit.insufficientPages.length}
- Product schema count: ${productSchemaCount}
- ProductGroup schema count: ${productGroupSchemaCount}

### Highest product-only similarity pairs

${list(productAudit.pairs.slice(0, 15), pair => `- ${(pair.score * 100).toFixed(1)}% — ${pair.left} ${pair.leftName} ↔ ${pair.right} ${pair.rightName}`)}

### Repeated editorial sentences across product pages

${list(productAudit.repeatedSentences, item => `- ${item.count} pages (${item.references.join(', ')}): ${item.text}`)}

## Pages missing structured data (${noSchema.length})\n\n${list(noSchema, page => `- ${page.url}`)}\n\n## Duplicate titles (${duplicates.titles.length} groups)\n\n${list(duplicates.titles, group => `- ${group.value}: ${group.urls.join(', ')}`)}\n\n## Duplicate descriptions (${duplicates.descriptions.length} groups)\n\n${list(duplicates.descriptions, group => `- ${group.value}: ${group.urls.join(', ')}`)}\n\n## Duplicate H1s (${duplicates.h1s.length} groups)\n\n${list(duplicates.h1s, group => `- ${group.value}: ${group.urls.join(', ')}`)}\n\n## Broken internal links (${broken.length})\n\n${list(broken, item => `- ${item.source} → ${item.href} (${item.reason})`)}\n\n## Pages with suspiciously truncated copy (${suspicious.length})\n\n${list(suspicious, page => `- ${page.url}`)}\n\n## Bundle contents\n\n- routes.json: route inventory\n- html/: built HTML for every indexable sitemap route\n- text/: public-content extracts for every route\n- screenshots/: full-page 390 px and 1440 px captures\n- audits/: content, copy, confidentiality, taxonomy, route/sitemap, link, metadata, schema, similarity, screenshot, and integrity reports\n`;
  await writeFile(path.join(review, 'summary.md'), summary, 'utf8');
  const staged = await walk(review), leaked = [];
  for (const file of staged) {
    const relative = path.relative(review, file).replaceAll('\\', '/');
    if (/(^|\/)(source-media|supplier-manifests?|node_modules|\.git|\.env|credentials?|secrets?)(\/|$)/i.test(relative)) leaked.push(`${relative}: prohibited path`);
    if (new Set(['.html', '.txt', '.md', '.json', '.xml', '.css', '.js']).has(path.extname(file).toLowerCase())) {
      const content = await readFile(file, 'utf8'); confidential.forEach((pattern, index) => { if (pattern.test(content)) leaked.push(`${relative}: confidential pattern ${index + 1}`); });
    }
  }
  if (leaked.length) throw new Error(`Bundle confidentiality scan failed:\n${leaked.join('\n')}`);
  await writeFile(path.join(audits, 'bundle-integrity.txt'), `Bundle integrity: OK\nScanned ${staged.length} staged files.\nConfidential identity, source-path, credential, and prohibited-directory matches: 0.\n`, 'utf8');
  await rm(bundle, { force: true });
  const zip = `import os,sys,zipfile\nsource,out=sys.argv[1:3]\ntmp=out+'.tmp'\nwith zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n for base,dirs,files in os.walk(source):\n  dirs.sort();files.sort()\n  for name in files:\n   full=os.path.join(base,name);z.write(full,os.path.relpath(full,os.path.dirname(source)).replace(os.sep,'/'))\nos.replace(tmp,out)`;
  await run(python, ['-c', zip, review, bundle]);
  const validate = `import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1]);n=z.namelist();count=int(sys.argv[2])\nassert 'site-review/summary.md' in n and 'site-review/routes.json' in n\nassert len([x for x in n if x.startswith('site-review/html/') and x.endswith('.html')])==count\nassert len([x for x in n if x.startswith('site-review/text/') and x.endswith('.txt')])==count\nassert len([x for x in n if x.startswith('site-review/screenshots/mobile/') and x.endswith('.png')])==18\nassert len([x for x in n if x.startswith('site-review/screenshots/desktop/') and x.endswith('.png')])==18\nassert not [x for x in n if any(p in x.lower().split('/') for p in ('source-media','node_modules','.git'))]\nprint('ZIP validation: OK (%d entries)'%len(n))`;
  await run(python, ['-c', validate, bundle, String(pages.length)]);
  const size = (await stat(bundle)).size;
  console.log(`Audit bundle: ${bundle}`); console.log(`Audit bundle size: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MiB)`);
} finally { await rm(temporary, { recursive: true, force: true }); }