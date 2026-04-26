import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
Element.prototype.scrollIntoView = vi.fn();

const storage = new Map<string, string>();

const localStorageMock: Storage = {
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  removeItem: (key: string) => {
    storage.delete(key);
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  get length() {
    return storage.size;
  }
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageMock
});

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageMock
});
