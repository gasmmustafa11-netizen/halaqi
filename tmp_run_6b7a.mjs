// Minimal DOM mocks for Vite chunk initialization
const events = {};
global.window = {
  addEventListener: (e, f) => { events[e] = f; },
  removeEventListener: () => {},
  scrollTo: () => {},
  location: { href: 'http://localhost:4173/' },
  navigator: { online: true, onLine: true },
  document: { hidden: false, addEventListener: () => {} },
};
global.document = global.window.document;
Object.defineProperty(global, "navigator", { value: global.window.navigator, writable: true, configurable: true });
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.HTMLDivElement = class {};
global.HTMLElement = class {};
global.document.createElement = (tag) => ({ tagName: tag, style: {}, appendChild: () => {}, setAttribute: () => {}, addEventListener: () => {}, removeChild: () => {} });
global.document.body = { appendChild: () => {}, style: {} };
global.document.head = { appendChild: () => {} };
try {
  await import('./tmp_build_6b7a/dist/assets/index-CSnEJbGJ.js');
  console.log('IMPORT_OK');
} catch (e) {
  console.log('RUNTIME_EXCEPTION:', e.message || e);
  console.log('STACK:', e.stack ? e.stack.split('\n').slice(0,8).join('\n') : 'none');
}
// Additional mocks to get past React init
global.document.createElement = (tag) => ({ tagName: tag, style: {}, appendChild: () => {}, setAttribute: () => {}, addEventListener: () => {}, removeChild: () => {} });
global.document.body = { appendChild: () => {}, style: {} };
global.document.head = { appendChild: () => {} };
