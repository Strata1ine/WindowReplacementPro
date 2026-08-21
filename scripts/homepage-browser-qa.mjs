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
const port = 9300 + Math.floor(Math.random() * 400);
const browserProcess = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDirectory}`,
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-extensions',
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
const loadPage = async (viewport, url = baseUrl) => {
  await setViewport(viewport);
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url });
  await loaded;
  await evaluate('document.fonts.ready.then(() => new Promise(resolve => setTimeout(resolve, 250)))');
  await evaluate(`(async () => {
    document.querySelector('astro-dev-toolbar')?.remove();
    const images = Array.from(document.images);
    images.forEach(image => image.loading = 'eager');
    await Promise.all(images.map(image => image.decode().catch(() => undefined)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 500));
  })()`);
};
const loadHomepage = viewport => loadPage(viewport, baseUrl);
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
  { name: 'mobile-390', width: 390, height: 844, mobile: false, deviceScaleFactor: 1 },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false, deviceScaleFactor: 1 },
  { name: 'desktop-1280', width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 },
  { name: 'desktop-1440', width: 1440, height: 960, mobile: false, deviceScaleFactor: 1 },
  { name: 'wide-1680', width: 1680, height: 1050, mobile: false, deviceScaleFactor: 1 }
];
const viewportResults = [];
const representativeRoutes = [
  { kind: 'window', path: '/products/windows/slim-frame-casement-window/' },
  { kind: 'entry-door', path: '/products/entry-doors/two-panel-fiberglass-entry-door/' },
  { kind: 'door-glass', path: '/products/door-glass/black-linear-privacy-door-glass/' },
  { kind: 'patio-door', path: '/products/patio-doors/multi-panel-sliding-patio-door/' }
];
const corePageRoutes = [
  { name: 'windows', path: '/windows/', kind: 'category', expectedProducts: 10 },
  { name: 'entry-doors', path: '/doors/', kind: 'category', expectedProducts: 12 },
  { name: 'door-glass', path: '/doors/decorative-door-glass/', kind: 'category', expectedProducts: 12 },
  { name: 'patio-doors', path: '/patio-doors/', kind: 'category', expectedProducts: 6 },
  { name: 'product-window-slim-casement', path: '/products/windows/slim-frame-casement-window/', kind: 'product', category: 'windows' },
  { name: 'product-window-double-hung', path: '/products/windows/double-hung-window/', kind: 'product', category: 'windows' },
  { name: 'product-entry-two-panel', path: '/products/entry-doors/two-panel-fiberglass-entry-door/', kind: 'product', category: 'entry-doors' },
  { name: 'product-entry-craftsman', path: '/products/entry-doors/craftsman-fiberglass-entry-door/', kind: 'product', category: 'entry-doors' },
  { name: 'product-glass-linear', path: '/products/door-glass/black-linear-privacy-door-glass/', kind: 'product', category: 'door-glass' },
  { name: 'product-glass-sidelite', path: '/products/door-glass/narrow-sidelite-decorative-glass/', kind: 'product', category: 'door-glass' },
  { name: 'product-patio-multi-panel', path: '/products/patio-doors/multi-panel-sliding-patio-door/', kind: 'product', category: 'patio-doors' },
  { name: 'product-patio-slim-aluminum', path: '/products/patio-doors/slim-frame-aluminum-patio-door/', kind: 'product', category: 'patio-doors' }
];

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
    const categoryLayouts = await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.category-card'));
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const box = rect => ({
        top: Math.round(rect.top * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        left: Math.round(rect.left * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100
      });
      return cards.map((card, index) => {
        const content = card.querySelector('.category-card__content');
        const media = card.querySelector('.category-card__media');
        const heading = card.querySelector('h3');
        const link = card.querySelector('.text-link');
        const cardRect = card.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const mediaRect = media.getBoundingClientRect();
        const nextRect = cards[index + 1]?.getBoundingClientRect();
        const mediaStyle = getComputedStyle(media);
        return {
          title: heading?.textContent?.trim() ?? '',
          card: box(cardRect),
          content: box(contentRect),
          media: box(mediaRect),
          mediaComputedMinHeight: mediaStyle.minHeight,
          contentInsideCard: contentRect.top >= cardRect.top - 1 && contentRect.bottom <= cardRect.bottom + 1 && contentRect.left >= cardRect.left - 1 && contentRect.right <= cardRect.right + 1,
          headingVisible: visible(heading),
          linkVisible: visible(link),
          overlapsNext: Boolean(nextRect && contentRect.right > nextRect.left + 1 && contentRect.left < nextRect.right - 1 && contentRect.bottom > nextRect.top + 1 && contentRect.top < nextRect.bottom - 1),
          followingGap: nextRect ? Math.round((nextRect.top - cardRect.bottom) * 100) / 100 : null,
          followingStartsBelow: nextRect ? nextRect.top >= cardRect.bottom - 1 : true
        };
      });
    })()`);
    viewportResults.push({
      viewport,
      dimensions,
      brokenImages: images.filter(image => image.naturalWidth === 0),
      incompleteImages: images.filter(image => !image.complete && image.naturalWidth > 0),
      categoryLayouts
    });
    await fullPageScreenshot(`homepage-${viewport.name}.png`);
  }

  await loadHomepage(viewports[2]);
  await evaluate("document.querySelector('[data-nav-dropdown] > summary')?.click()");
  await delay(120);
  await screenshot('desktop-header-menu.png', { x: 0, y: 0, width: 1280, height: 430 });
  await evaluate("document.querySelector('[data-nav-dropdown]')?.removeAttribute('open')");

  await loadHomepage(viewports[3]);
  const desktopHeroClip = await elementClip('.home-hero');
  if (!desktopHeroClip) throw new Error('Homepage hero not found.');
  await screenshot('desktop-hero.png', desktopHeroClip);

  const productPathsClip = await elementClip('#product-paths');
  if (!productPathsClip) throw new Error('Product-path section not found.');
  await screenshot('product-path-cards.png', productPathsClip);

  const featuredClip = await elementClip('#featured-products');
  if (!featuredClip) throw new Error('Featured-products section not found.');
  await screenshot('featured-product-cards.png', featuredClip);
  const footerClip = await elementClip('.site-footer');
  if (!footerClip) throw new Error('Footer not found.');
  await screenshot('footer-desktop.png', footerClip);

  const mhtmlSnapshot = await client.send('Page.captureSnapshot', { format: 'mhtml' });
  const mhtmlSource = mhtmlSnapshot.data.toLowerCase();
  const mhtmlAudit = {
    byteLength: Buffer.byteLength(mhtmlSnapshot.data),
    expectedProductAssetsEmbedded: ['wrp-w001', 'wrp-d001', 'wrp-p001'].filter(asset => mhtmlSource.includes(asset)),
    supplierTermsEmbedded: ['vinyl-pro', 'window city', 'masonite', 'trimlite', 'novatech', 'verre select', 'mennie', 'richersons', 'oceanview', 'vista patio doors'].filter(term => mhtmlSource.includes(term))
  };

  await loadHomepage(viewports[0]);
  const mobileHeroClip = await elementClip('.home-hero');
  if (!mobileHeroClip) throw new Error('Mobile homepage hero not found.');
  await screenshot('mobile-hero.png', mobileHeroClip);
  const mobileCategoriesClip = await elementClip('.category-grid');
  if (!mobileCategoriesClip) throw new Error('Mobile category grid not found.');
  await screenshot('mobile-category-cards.png', mobileCategoriesClip);
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
  await sharp(mobileMenuFullPath).extract({ left: 0, top: 0, width: 390, height: 844 }).toFile(path.join(outputDirectory, 'mobile-menu.png'));
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
    const forbidden = [
      'vinyl-pro', 'vinyl pro', 'window city', 'masonite', 'trimlite', 'novatech',
      'verre select', 'mennie', 'richersons', 'oceanview', 'vista patio doors',
      'source-only', 'facts-ready', 'uncertain/review', 'stale',
      'reviewed customer-facing identity', 'approved specifications', 'clean product media',
      'reviewed configurations', 'published records', 'reviewed technical evidence',
      'service-area pages are published', 'representative approved product configurations'
    ];
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
      heroFactsPresent: Boolean(document.querySelector('.home-hero__facts')),
      neutralReferencesVisible: ['wrp-w001', 'wrp-d001', 'wrp-g001', 'wrp-p001'].every(reference => text.includes(reference)),
      forbiddenTermsVisible: forbidden.filter(term => text.includes(term)),
      inventoryCountTexts: Array.from(document.querySelectorAll('.window-style-card span:last-child, .taxonomy-panel li a span:last-child'))
        .map(element => element.textContent?.trim() ?? '')
        .filter(value => /^\d+$|^\d+\s+(?:reviewed\s+)?(?:configuration|configurations|record|records)$/i.test(value)),
      containedMediaBackgrounds: Array.from(document.querySelectorAll('.home-hero__door, .product-card__media, .category-card__media.media-frame--contain')).map(element => {
        const style = getComputedStyle(element);
        return {
          className: element.className,
          backgroundImage: style.backgroundImage,
          backgroundSize: style.backgroundSize
        };
      }),
      publicPathLeaks: uniqueLinks.filter(href => {
        const pathname = new URL(href).pathname.toLowerCase();
        const supplierSegments = ['vinyl-pro', 'window-city', 'masonite', 'trimlite', 'novatech', 'verre-select', 'mennie-canada', 'richersons', 'oceanview', 'vista'];
        return pathname.startsWith('/brands/') || supplierSegments.some(segment => pathname.startsWith('/products/' + segment + '/'));
      }),
      publicMediaPathLeaks: Array.from(document.images, image => new URL(image.currentSrc || image.src).pathname).filter(pathname => !pathname.startsWith('/media/products/wrp-')),
      brokenLinks: linkResults.filter(result => !result.ok),
      internalLinkCount: uniqueLinks.length,
      imageCount: document.images.length,
      productCardCount: document.querySelectorAll('.product-card').length,
      categoryCardCount: document.querySelectorAll('.category-card').length
    };
  })()`);

  const representativePageAudits = [];
  for (const route of representativeRoutes) {
    const routeUrl = new URL(route.path, baseUrl).href;
    await loadPage(viewports[2], routeUrl);
    const audit = await evaluate(`(() => {
      const forbidden = [
        'vinyl-pro', 'vinyl pro', 'window city', 'masonite', 'trimlite', 'novatech',
        'verre select', 'mennie', 'richersons', 'oceanview', 'vista patio doors',
        'manufacturer:', 'supplier:', 'source url', 'provenance'
      ];
      const text = document.body.innerText.toLowerCase();
      const paths = Array.from(document.querySelectorAll('a[href], img[src]'), element => {
        const value = element.href || element.currentSrc || element.src;
        return value ? new URL(value, location.href).pathname.toLowerCase() : '';
      });
      const images = Array.from(document.images);
      const productImage = images[0];
      const imageStyle = productImage ? getComputedStyle(productImage) : null;
      const imageRect = productImage?.getBoundingClientRect();
      let decodedDarkPixelRatio = null;
      if (productImage) {
        const canvas = document.createElement('canvas');
        canvas.width = productImage.naturalWidth;
        canvas.height = productImage.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(productImage, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let darkPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) if (pixels[index] + pixels[index + 1] + pixels[index + 2] < 600) darkPixels += 1;
        decodedDarkPixelRatio = darkPixels / (pixels.length / 4);
      }
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.trim() ?? '',
        h1Count: document.querySelectorAll('h1').length,
        reference: document.querySelector('.product-card__meta')?.textContent?.trim() ?? '',
        disclaimerCount: document.querySelectorAll('.product-disclosure').length,
        forbiddenTermsVisible: forbidden.filter(term => text.includes(term)),
        pathLeaks: paths.filter(pathname => pathname.startsWith('/brands/') || pathname.startsWith('/public/') || pathname.startsWith('/documents/') || pathname.includes('/suppliers/')),
        imageCount: images.length,
        brokenImages: images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc || image.src),
        mediaPaths: images.map(image => new URL(image.currentSrc || image.src).pathname),
        imageMetrics: productImage ? {
          width: imageRect.width,
          height: imageRect.height,
          display: imageStyle.display,
          visibility: imageStyle.visibility,
          opacity: imageStyle.opacity,
          objectFit: imageStyle.objectFit,
          position: imageStyle.position,
          decodedDarkPixelRatio,
        } : null,
      };
    })()`);
    representativePageAudits.push({ ...route, url: routeUrl, ...audit });
    await fullPageScreenshot(`product-${route.kind}.png`);
  }


  const corePageAudits = [];
  for (const route of corePageRoutes) {
    for (const viewport of viewports) {
      const routeUrl = new URL(route.path, baseUrl).href;
      await loadPage(viewport, routeUrl);
      const audit = await evaluate(`(() => {
        const text = document.body.innerText.toLowerCase();
        const forbidden = [
          'vinyl-pro', 'vinyl pro', 'window city', 'masonite', 'trimlite', 'novatech',
          'verre select', 'mennie', 'richersons', 'oceanview', 'vista patio doors',
          'source url', 'provenance', 'supplier:', 'manufacturer:'
        ];
        const images = Array.from(document.images);
        const clipped = Array.from(document.querySelectorAll(
          '.choice-card,.guidance-card,.consideration-grid article,.installation-steps li,.product-specification-groups>section,.product-editorial-grid>section,.product-gallery-grid figure,.public-catalogue .product-card,.quote-cta'
        )).filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1 || rect.width > innerWidth + 1;
        }).map(element => element.className);
        const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
          .map(script => { try { return JSON.parse(script.textContent); } catch { return null; } })
          .filter(Boolean);
        const schemaText = JSON.stringify(schemas).toLowerCase();
        return {
          title: document.title,
          h1Count: document.querySelectorAll('h1').length,
          h1: document.querySelector('h1')?.textContent?.trim() ?? '',
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          viewportWidth: innerWidth,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          clipped,
          brokenImages: images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc || image.src),
          choiceCards: document.querySelectorAll('.choice-card').length,
          catalogueProductCards: document.querySelectorAll('.public-catalogue .product-card').length,
          catalogueGroups: document.querySelectorAll('.public-catalogue__group').length,
          keyFeatureCount: document.querySelectorAll('.product-key-features li').length,
          editorialGuidanceGroups: document.querySelectorAll('.product-editorial-grid>section').length,
          galleryCount: document.querySelectorAll('.product-gallery-grid figure').length,
          relatedProductCount: document.querySelectorAll('.product-related .product-card').length,
          emptySpecificationRows: Array.from(document.querySelectorAll('.product-specification-groups dl div'))
            .filter(row => !row.querySelector('dt')?.textContent?.trim() || !row.querySelector('dd')?.textContent?.trim()).length,
          headerPresent: Boolean(document.querySelector('.site-header')),
          footerPresent: Boolean(document.querySelector('.site-footer')),
          quotePresent: Boolean(document.querySelector('.quote-cta')),
          forbiddenTerms: forbidden.filter(term => text.includes(term)),
          privatePathLeaks: Array.from(document.querySelectorAll('[href],[src]'))
            .map(element => element.href || element.currentSrc || element.src || '')
            .filter(value => /brands|source-media|documents|suppliers|vinyl-pro|window-city|masonite|trimlite|novatech|oceanview|vista/i.test(value)),
          schemaTypes: schemas.map(schema => schema['@type']),
          fabricatedSchemaFields: ['brand','manufacturer','offers','price','rating','review']
            .filter(field => schemaText.includes('"' + field + '"'))
        };
      })()`);
      corePageAudits.push({ ...route, viewport, url: routeUrl, ...audit });
      if (viewport.width === 390 || viewport.width === 1440) {
        await fullPageScreenshot('core-' + route.name + '-' + viewport.name + '.png');
      }
    }
  }
  const failures = [];
  for (const result of viewportResults) {
    if (result.dimensions.horizontalOverflow) failures.push('horizontal overflow at ' + result.viewport.width + 'px');
    if (result.brokenImages.length) failures.push('broken images at ' + result.viewport.width + 'px');
    if (result.incompleteImages.length) failures.push('incomplete images at ' + result.viewport.width + 'px');
    for (const card of result.categoryLayouts) {
      if (!card.contentInsideCard) failures.push(card.title + ' category content escapes its card at ' + result.viewport.width + 'px');
      if (!card.headingVisible) failures.push(card.title + ' category heading is not visible at ' + result.viewport.width + 'px');
      if (!card.linkVisible) failures.push(card.title + ' category link is not visible at ' + result.viewport.width + 'px');
      if (card.overlapsNext) failures.push(card.title + ' category card overlaps the next card at ' + result.viewport.width + 'px');
      if (result.viewport.width === 390 && !card.followingStartsBelow) failures.push(card.title + ' following category card does not start below it at 390px');
    }
  }
  if (mobileBefore.hidden !== true || mobileBefore.expanded !== 'false') failures.push('mobile menu initial state');
  if (mobileOpen.hidden !== false || mobileOpen.expanded !== 'true' || !mobileOpen.bodyLocked) failures.push('mobile menu open state');
  if (mobileAfterEscape.hidden !== true || mobileAfterEscape.expanded !== 'false' || !mobileAfterEscape.focused) failures.push('mobile menu Escape state');
  if (!pageAudit.neutralReferencesVisible) failures.push('neutral public references are missing');
  if (pageAudit.heroFactsPresent) failures.push('homepage hero inventory facts remain visible');
  if (pageAudit.inventoryCountTexts.length) failures.push('homepage inventory counts remain visible');
  if (pageAudit.forbiddenTermsVisible.length) failures.push('supplier or workflow disclosure visible');
  if (pageAudit.publicPathLeaks.length) failures.push('supplier-identifying link path visible');
  if (pageAudit.publicMediaPathLeaks.length) failures.push('non-neutral public media path visible');
  if (pageAudit.brokenLinks.length) failures.push('broken internal links');
  if (mhtmlAudit.expectedProductAssetsEmbedded.length !== 3) failures.push('saved MHTML does not contain all three hero product assets');
  if (pageAudit.containedMediaBackgrounds.some(media => media.backgroundImage === 'none')) failures.push('contained media is missing its background image');
  if (pageAudit.containedMediaBackgrounds.some(media => media.backgroundSize === 'auto')) failures.push('contained media background sizing was reset');
  if (mhtmlAudit.supplierTermsEmbedded.length) failures.push('saved MHTML exposes supplier terminology');
  for (const audit of representativePageAudits) {
    if (audit.h1Count !== 1) failures.push(audit.kind + ' page does not have exactly one H1');
    if (!audit.reference.includes('WRP-')) failures.push(audit.kind + ' page is missing its neutral reference');
    if (audit.disclaimerCount !== 1) failures.push(audit.kind + ' page disclosure count is not exactly one');
    if (audit.forbiddenTermsVisible.length) failures.push(audit.kind + ' page exposes supplier terminology');
    if (audit.pathLeaks.length) failures.push(audit.kind + ' page exposes an internal path');
    if (audit.brokenImages.length) failures.push(audit.kind + ' page has broken images');
    if ((audit.imageMetrics?.decodedDarkPixelRatio ?? 0) < 0.01) failures.push(audit.kind + ' page media has no usable decoded visual content');
    if (audit.mediaPaths.some(pathname => !pathname.startsWith('/media/products/wrp-'))) failures.push(audit.kind + ' page uses a non-neutral media path');
  }
  for (const audit of corePageAudits) {
    const label = audit.name + ' at ' + audit.viewport.width + 'px';
    if (audit.h1Count !== 1) failures.push(label + ' does not have exactly one H1');
    if (audit.horizontalOverflow) failures.push(label + ' has horizontal overflow');
    if (audit.clipped.length) failures.push(label + ' has clipped key content');
    if (audit.brokenImages.length) failures.push(label + ' has broken images');
    if (!audit.headerPresent || !audit.footerPresent || !audit.quotePresent) failures.push(label + ' is missing the shared layout or CTA');
    if (audit.forbiddenTerms.length || audit.privatePathLeaks.length) failures.push(label + ' exposes private identity data');
    if (audit.fabricatedSchemaFields.length) failures.push(label + ' includes prohibited schema fields');
    if (audit.emptySpecificationRows) failures.push(label + ' includes empty specification rows');
    if (audit.kind === 'category' && audit.choiceCards < 6) failures.push(label + ' is missing category choices');
    if (audit.kind === 'category' && audit.catalogueProductCards !== audit.expectedProducts) failures.push(label + ' catalogue count does not match the approved category count');
    if (audit.kind === 'category' && audit.catalogueGroups < 2) failures.push(label + ' is missing grouped catalogue browsing');
    if (audit.kind === 'product' && audit.keyFeatureCount < 3) failures.push(label + ' is missing reviewed key features');
    if (audit.kind === 'product' && audit.editorialGuidanceGroups !== 3) failures.push(label + ' is missing best-for, configuration, or consideration guidance');
    if (audit.kind === 'product' && (audit.relatedProductCount < 1 || audit.relatedProductCount > 3)) failures.push(label + ' has an invalid related-product count');
  }
  for (const category of ['windows', 'entry-doors', 'door-glass', 'patio-doors']) {
    const categoryProducts = corePageAudits.filter(audit => audit.kind === 'product' && audit.category === category);
    if (new Set(categoryProducts.map(audit => audit.name)).size < 2) failures.push(category + ' has fewer than two responsive product-page audits');
    if (!categoryProducts.some(audit => audit.galleryCount > 0)) failures.push(category + ' has no gallery-bearing product in responsive QA');
  }
  if (runtimeErrors.length) failures.push('browser runtime errors');
  if (networkFailures.length) failures.push('browser network failures');

  const results = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    viewportResults,
    interactions: { mobileBefore, mobileOpen, mobileAfterEscape },
    pageAudit,
    mhtmlAudit,
    representativePageAudits,
    corePageAudits,
    runtimeErrors,
    networkFailures,
    failures,
    screenshotDirectory: path.relative(process.cwd(), outputDirectory).replaceAll('\\', '/')
  };
  await writeFile(resultPath, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  if (failures.length) throw new Error('Homepage browser QA failed: ' + failures.join('; '));
} finally {
  client?.close();
  browserProcess.kill();
  await delay(200);
  await rm(profileDirectory, { recursive: true, force: true });
}
