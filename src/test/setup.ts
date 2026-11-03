import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, beforeEach } from 'vitest';
import { runInThisContext } from 'node:vm';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { store } from '../mocks/store';

export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => store.reset());
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());
// Node fetch and jsdom otherwise expose different AbortSignal constructors.
globalThis.AbortController = runInThisContext('AbortController');
globalThis.AbortSignal = runInThisContext('AbortSignal');
Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }) });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const originalComputedStyle = window.getComputedStyle;
window.getComputedStyle = element => originalComputedStyle(element);
