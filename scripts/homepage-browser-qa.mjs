import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const baseUrl = process.env.HOMEPAGE_QA_URL ?? 'http://127.0.0.1:4321/';
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean);
const chromePath = chromeCandidates.find(candidate => existsSync(candidate));
if (!chromePath) throw new Error('Set CHROME_PATH to a local Chrome or Edge executable.');

const outputDirectory = path.resolve('audit/frontend/screenshots');
const resultPath = path.resolve('audit/frontend/browser-qa-results.json');
await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'windowreplacement-homepage-qa-'));
const port = 9333;
const browserProcess = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDirectory}`,
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-gpu',
  '--disable-sync',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
], { stdio: 'ignore', windowsHide: true });

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const waitForJson = async url => {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Map();
  }
  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        return;
      }
      const listeners = this.waiters.get(message.method);
      if (!listeners?.length) return;
      this.waiters.set(message.method, []);
      listeners.forEach(resolve => resolve(message.params));
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }
  once(method) {
    return new Promise(resolve => {
      const listeners = this.waiters.get(method) ?? [];
      listeners.push(resolve);
      this.waiters.set(method, listeners);
    });
  }
  close() { this.socket.close(); }
}

let client;
const runtimeErrors = [];
const networkFailures = [];
const evaluate = async expression => {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const setViewport = viewport => client.send('Emulation.setDeviceMetricsOverride', {
  width: viewport.width,
  height: viewport.height,
  deviceScaleFactor: viewport.deviceScaleFactor,
  mobile: viewport.mobile,
  screenWidth: viewport.width,
  screenHeight: viewport.height
});
const loadHomepage = async viewport => {
  await setViewport(viewport);
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url: baseUrl });
  await loaded;
  await evaluate('document.fonts.ready.then(() => new Promise(resolve => setTimeout(resolve, 250)))');
  await evaluate(`(async () => {
    document.querySelector('astro-dev-toolbar')?.remove();
    const images = Array.from(document.images);
    images.forEach(image => image.loading = 'eager');
    await Promise.all(images.map(image => image.decode().catch(() => undefined)));
    await new Promise(resolve => setTimeout(resolve, 120));
  })()`);
};
const screenshot = async (filename, clip) => {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    ...(clip ? { clip: { ...clip, scale: 1 } } : {})
  });
  await writeFile(path.join(outputDirectory, filename), Buffer.from(result.data, 'base64'));
};

const fullPageScreenshot = async filename => {
  const metrics = await client.send('Page.getLayoutMetrics');
  const { width, height } = metrics.cssContentSize;
  await screenshot(filename, { x: 0, y: 0, width, height });
};
const elementClip = selector => evaluate(`(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(0, rect.left + window.scrollX),
    y: Math.max(0, rect.top + window.scrollY),
    width: Math.min(document.documentElement.scrollWidth, rect.width),
    height: rect.height
  };
})()`);

const viewports = [
  { name: 'mobile-375', width: 375, height: 812, mobile: false, deviceScaleFactor: 1 },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false, deviceScaleFactor: 1 },
  { name: 'desktop-1280', width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 },
  { name: 'wide-1600', width: 1600, height: 1000, mobile: false, deviceScaleFactor: 1 }
];
const viewportResults = [];

try {
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }).then(response => response.json());
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);

  client.socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
      networkFailures.push({ errorText: message.params.errorText, blockedReason: message.params.blockedReason ?? null });
    }
  });

  for (const viewport of viewports) {
    await loadHomepage(viewport);
    const dimensions = await evaluate(`({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    })`);
    const images = await evaluate(`Array.from(document.images).map(image => ({
      src: image.currentSrc || image.src,
      alt: image.alt,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    }))`);
    viewportResults.push({
      viewport,
      dimensions,
      brokenImages: images.filter(image => image.naturalWidth === 0),
      incompleteImages: images.filter(image => !image.complete && image.naturalWidth > 0)
    });
    await fullPageScreenshot(`homepage-${viewport.name}.png`);
  }

  await loadHomepage(viewports[2]);
  await evaluate("document.querySelector('[data-nav-dropdown] > summary')?.click()");
  await delay(120);
  await screenshot('desktop-header-menu.png', { x: 0, y: 0, width: 1280, height: 430 });
  await evaluate("document.querySelector('[data-nav-dropdown]')?.removeAttribute('open')");

  const featuredClip = await elementClip('#featured-products');
  if (!featuredClip) throw new Error('Featured-products section not found.');
  await screenshot('featured-product-cards.png', featuredClip);
  const footerClip = await elementClip('.site-footer');
  if (!footerClip) throw new Error('Footer not found.');
  await screenshot('footer-desktop.png', footerClip);

  await loadHomepage(viewports[0]);
  const mobileBefore = await evaluate(`({
    hidden: document.querySelector('[data-mobile-nav]')?.hidden,
    expanded: document.querySelector('[data-menu-toggle]')?.getAttribute('aria-expanded')
  })`);
  await evaluate("document.querySelector('[data-menu-toggle]')?.click()");
  await delay(120);
  const mobileOpen = await evaluate(`({
    hidden: document.querySelector('[data-mobile-nav]')?.hidden,
    expanded: document.querySelector('[data-menu-toggle]')?.getAttribute('aria-expanded'),
    bodyLocked: document.body.classList.contains('menu-open'),
    navigationWidth: document.querySelector('[data-mobile-nav]')?.getBoundingClientRect().width
  })`);
  await evaluate("document.querySelector('.skip-link')?.setAttribute('hidden', '')");
  await evaluate(`(() => {
    const header = document.querySelector('[data-site-header]');
    const navigation = document.querySelector('[data-mobile-nav]');
    if (header) {
      header.style.position = 'absolute';
      header.style.width = '100vw';
      header.style.left = '0';
    }
    if (navigation) {
      navigation.style.position = 'absolute';
      navigation.style.width = '100vw';
      navigation.style.right = 'auto';
      navigation.style.minHeight = (window.innerHeight - 70) + 'px';
      navigation.style.height = (window.innerHeight - 70) + 'px';
    }
  })()`);
  const mobileMenuFullPath = path.join(outputDirectory, '_mobile-menu-full.png');
  await screenshot('_mobile-menu-full.png');
  await sharp(mobileMenuFullPath).extract({ left: 0, top: 0, width: 375, height: 812 }).toFile(path.join(outputDirectory, 'mobile-menu.png'));
  await rm(mobileMenuFullPath);
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await delay(120);
  const mobileAfterEscape = await evaluate(`({
    hidden: document.querySelector('[data-mobile-nav]')?.hidden,
    expanded: document.querySelector('[data-menu-toggle]')?.getAttribute('aria-expanded'),
    focused: document.activeElement?.matches('[data-menu-toggle]')
  })`);

  const pageAudit = await evaluate(`(async () => {
    const forbidden = ['source-only', 'facts-ready', 'uncertain/review', 'stale'];
    const text = document.body.innerText.toLowerCase();
    const hrefs = Array.from(document.querySelectorAll('a[href]'), link => link.href)
      .filter(href => href.startsWith(location.origin))
      .map(href => href.split('#')[0])
      .filter(Boolean);
    const uniqueLinks = Array.from(new Set(hrefs));
    const linkResults = [];
    for (const href of uniqueLinks) {
      try {
        const response = await fetch(href, { method: 'HEAD' });
        linkResults.push({ href, status: response.status, ok: response.ok });
      } catch (error) {
        linkResults.push({ href, status: 0, ok: false, error: String(error) });
      }
    }
    return {
      title: document.title,
      h1Count: document.querySelectorAll('h1').length,
      publishedCountVisible: Array.from(document.querySelectorAll('.home-hero__facts div')).some(item =>
        item.querySelector('dt')?.textContent?.trim() === '203'
        && item.querySelector('dd')?.textContent?.trim() === 'published products'),
      forbiddenTermsVisible: forbidden.filter(term => text.includes(term)),
      brokenLinks: linkResults.filter(result => !result.ok),
      internalLinkCount: uniqueLinks.length,
      imageCount: document.images.length,
      productCardCount: document.querySelectorAll('.product-card').length,
      categoryCardCount: document.querySelectorAll('.category-card').length
    };
  })()`);

  const results = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    viewportResults,
    interactions: { mobileBefore, mobileOpen, mobileAfterEscape },
    pageAudit,
    runtimeErrors,
    networkFailures,
    screenshotDirectory: path.relative(process.cwd(), outputDirectory).replaceAll('\\', '/')
  };
  await writeFile(resultPath, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  client?.close();
  browserProcess.kill();
  await delay(200);
  await rm(profileDirectory, { recursive: true, force: true });
}
