import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean);
const chromePath = chromeCandidates.find(candidate => existsSync(candidate));
if (!chromePath) throw new Error('Set CHROME_PATH to a local Chrome or Edge executable.');

const routes = [
  ['homepage', '/'],
  ['windows-category', '/windows/'],
  ['entry-doors-category', '/doors/'],
  ['door-glass-category', '/doors/decorative-door-glass/'],
  ['patio-doors-category', '/patio-doors/'],
  ['guide-authority', '/guides/window-styles/'],
  ['product-showroom', '/products/entry-doors/oak-grain-fiberglass-entry-door/']
];
const outputDirectory = path.resolve('audit/frontend/mobile-navigation');
await mkdir(outputDirectory, { recursive: true });

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'], ['.woff2', 'font/woff2']
]);

const startStaticServer = async () => {
  const distDirectory = path.resolve('dist');
  if (!existsSync(path.join(distDirectory, 'index.html'))) {
    throw new Error('Production build not found. Run npm run build before mobile navigation QA.');
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      if (pathname === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      const relativePath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const filePath = path.resolve(distDirectory, `.${relativePath}`);
      if (!filePath.startsWith(`${distDirectory}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error('Not a file');
      response.writeHead(200, { 'content-type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream' });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}` };
};

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async open() {
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
      (this.listeners.get(message.method) ?? []).forEach(listener => listener(message.params));
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    const response = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return response;
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
  close() { this.socket.close(); }
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'windowreplacement-mobile-nav-qa-'));
const debuggingPort = 9400 + Math.floor(Math.random() * 400);
const browserProcess = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${debuggingPort}`, `--user-data-dir=${profileDirectory}`,
  '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
  '--disable-extensions', '--disable-sync', '--no-first-run', '--no-default-browser-check', 'about:blank'
], { stdio: 'ignore', windowsHide: true });

let server;
let client;
const failures = [];
const results = [];
const runtimeErrors = [];

try {
  const staticSite = await startStaticServer();
  server = staticSite.server;
  let target;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
      target = (await response.json()).find(item => item.type === 'page');
      if (target) break;
    } catch { /* Browser is still starting. */ }
    await delay(100);
  }
  if (!target) throw new Error('Timed out waiting for Chrome DevTools.');
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  client.on('Runtime.exceptionThrown', event => runtimeErrors.push(event.exceptionDetails?.text ?? 'Runtime exception'));
  client.on('Log.entryAdded', event => {
    if (event.entry?.level === 'error') runtimeErrors.push(event.entry.text);
  });

  const evaluate = async expression => {
    const response = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const setViewport = (width, height = 844) => client.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height
  });
  const load = async (route, width = 390) => {
    await setViewport(width);
    const expectedUrl = `${staticSite.origin}${route}`;
    await client.send('Page.navigate', { url: expectedUrl });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(`location.href === ${JSON.stringify(expectedUrl)} && document.readyState === "complete"`)) break;
      await delay(50);
    }
    await evaluate('document.fonts.ready');
    await delay(80);
  };
  const state = () => evaluate(`(() => {
    const button = document.querySelector('[data-menu-toggle]');
    const navigation = document.querySelector('[data-mobile-nav]');
    const buttonRect = button?.getBoundingClientRect();
    const navRect = navigation?.getBoundingClientRect();
    const style = navigation ? getComputedStyle(navigation) : null;
    const links = Array.from(navigation?.querySelectorAll('a') ?? []);
    return {
      path: location.pathname, hash: location.hash, buttonTag: button?.tagName,
      buttonVisible: Boolean(buttonRect?.width && buttonRect?.height),
      buttonLabel: button?.getAttribute('aria-label'), expanded: button?.getAttribute('aria-expanded'),
      controls: button?.getAttribute('aria-controls'), navId: navigation?.id, hidden: navigation?.hidden,
      display: style?.display, visibility: style?.visibility, opacity: style?.opacity,
      pointerEvents: style?.pointerEvents, navWidth: navRect?.width ?? 0, navHeight: navRect?.height ?? 0,
      bodyLocked: document.body.classList.contains('menu-open'), horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      buttonHit: buttonRect ? Boolean(document.elementFromPoint(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2)?.closest('[data-menu-toggle]')) : false,
      visibleLinks: links.filter(link => { const rect = link.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).length,
      linkCount: links.length, focusedHref: document.activeElement?.closest('a')?.getAttribute('href') ?? null
    };
  })()`);
  const buttonCenter = () => evaluate(`(() => { const rect = document.querySelector('[data-menu-toggle]')?.getBoundingClientRect(); return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null; })()`);
  const clickPoint = async point => {
    if (!point) throw new Error('Clickable point was not found.');
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await delay(80);
  };
  const clickToggle = async () => clickPoint(await buttonCenter());
  const pressKey = async (key, code = key, keyCode = 0) => {
    const text = key === 'Enter' ? '\r' : key === ' ' ? ' ' : undefined;
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text, unmodifiedText: text, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await delay(80);
  };
  const screenshot = async name => {
    const capture = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(path.join(outputDirectory, name), Buffer.from(capture.data, 'base64'));
  };
  const assertState = (condition, message) => { if (!condition) failures.push(message); };

  for (const [name, route] of routes) {
    await load(route);
    const before = await state();
    if (name === 'homepage') await screenshot('homepage-closed-390.png');
    assertState(before.buttonTag === 'BUTTON' && before.buttonVisible && before.buttonHit, `${name}: toggle is not a visible, hittable button`);
    assertState(before.expanded === 'false' && before.hidden === true && before.display === 'none', `${name}: initial state is not closed`);
    assertState(before.controls === before.navId && Boolean(before.buttonLabel), `${name}: toggle accessibility attributes are incomplete`);
    await clickToggle();
    const open = await state();
    if (name === 'homepage') await screenshot('homepage-open-390.png');
    if (name === 'product-showroom') await screenshot('product-showroom-open-390.png');
    assertState(open.expanded === 'true' && open.hidden === false && open.display !== 'none', `${name}: DOM state did not open`);
    assertState(open.navHeight > 700 && open.navWidth === 390, `${name}: open navigation has invalid geometry ${open.navWidth}x${open.navHeight}`);
    assertState(open.visibility === 'visible' && open.opacity === '1' && open.pointerEvents !== 'none', `${name}: open navigation is not visible or interactive`);
    assertState(open.visibleLinks === open.linkCount && open.linkCount >= 10, `${name}: not all navigation links are available`);
    assertState(open.bodyLocked && !open.horizontalOverflow && open.focusedHref === '/windows/', `${name}: scroll, overflow, or initial focus state is incorrect`);
    if (name === 'homepage') {
      await pressKey('Tab', 'Tab', 9);
      const tabbedHref = await evaluate('document.activeElement?.closest("a")?.getAttribute("href") ?? null');
      assertState(tabbedHref === '/doors/', 'homepage: tab order does not advance through navigation links');
    }
    await pressKey('Escape', 'Escape', 27);
    const escaped = await state();
    const toggleFocused = await evaluate("document.activeElement?.matches('[data-menu-toggle]') ?? false");
    assertState(escaped.expanded === 'false' && escaped.hidden === true && !escaped.bodyLocked && toggleFocused, `${name}: Escape did not restore closed state and focus`);
    await pressKey('Enter', 'Enter', 13);
    assertState((await state()).expanded === 'true', `${name}: Enter did not activate the toggle`);
    await pressKey('Escape', 'Escape', 27);
    await pressKey(' ', 'Space', 32);
    assertState((await state()).expanded === 'true', `${name}: Space did not activate the toggle`);
    await pressKey('Escape', 'Escape', 27);
    await clickToggle();
    await clickToggle();
    const repeated = await state();
    assertState(repeated.expanded === 'false' && !repeated.bodyLocked, `${name}: repeated pointer presses desynchronized state`);
    await clickToggle();
    const firstLink = await evaluate(`(() => { const link = document.querySelector('[data-mobile-nav] a'); const rect = link?.getBoundingClientRect(); return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null; })()`);
    await clickPoint(firstLink);
    for (let attempt = 0; attempt < 60 && (await state()).path !== '/windows/'; attempt += 1) await delay(50);
    const navigated = await state();
    assertState(navigated.path === '/windows/' && navigated.expanded === 'false' && navigated.hidden === true && !navigated.bodyLocked, `${name}: link navigation did not reset menu state`);
    results.push({ name, route, before, open, escaped, navigated });
  }

  for (const width of [375, 430, 768]) {
    await load('/', width);
    await clickToggle();
    const open = await state();
    assertState(open.expanded === 'true' && open.navHeight > 700 && open.navWidth === width && !open.horizontalOverflow, `${width}px: pointer-open geometry failed`);
    await clickToggle();
    const closed = await state();
    assertState(closed.expanded === 'false' && closed.hidden === true && !closed.bodyLocked, `${width}px: pointer-close state failed`);
    results.push({ name: `viewport-${width}`, open, closed });
  }

  await load('/');
  await clickToggle();
  await setViewport(1200, 844);
  await delay(120);
  const resized = await state();
  assertState(resized.expanded === 'false' && resized.hidden === true && !resized.bodyLocked, 'desktop resize did not reset the menu');

  await load('/');
  await clickToggle();
  const ctaPoint = await evaluate(`(() => { const link = document.querySelector('[data-mobile-nav] .button'); link?.scrollIntoView({ block: 'center' }); const rect = link?.getBoundingClientRect(); return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null; })()`);
  await clickPoint(ctaPoint);
  const ctaState = await state();
  assertState(ctaState.path === '/' && ctaState.hash === '#quote' && ctaState.expanded === 'false' && !ctaState.bodyLocked, 'mobile CTA did not navigate or reset state');

  if (runtimeErrors.length) failures.push(...runtimeErrors.map(error => `browser runtime: ${error}`));
  const report = { routes: routes.length, viewports: [375, 390, 430, 768], runtimeErrors, failures, results };
  await writeFile(path.join(outputDirectory, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) throw new Error(`Mobile navigation QA failed:\n- ${failures.join('\n- ')}`);
  console.log(`Mobile navigation QA: PASS (${routes.length} page types; 375, 390, 430 and 768px)`);
  console.log(`Screenshots and results: ${outputDirectory}`);
} finally {
  client?.close();
  browserProcess.kill();
  await Promise.race([new Promise(resolve => browserProcess.once('exit', resolve)), delay(2000)]);
  if (server) await new Promise(resolve => server.close(resolve));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(profileDirectory, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error?.code !== 'EBUSY' || attempt === 19) console.warn(`Temporary browser profile cleanup: ${error.message}`);
      else await delay(100);
    }
  }
}