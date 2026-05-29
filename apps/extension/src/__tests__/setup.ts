// Chrome API mock — must be set up before any module that imports chrome.*
const storageMock: Record<string, Record<string, unknown>> = { local: {}, session: {} };

const mockStorage = (area: "local" | "session") => ({
  get: vi.fn(async (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    return Object.fromEntries(keys.map((k) => [k, storageMock[area][k]]));
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(storageMock[area], items);
  }),
  remove: vi.fn(async (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    keys.forEach((k) => delete storageMock[area][k]);
  }),
  setAccessLevel: vi.fn(async () => {}),
});

globalThis.chrome = {
  storage: {
    local: mockStorage("local"),
    session: mockStorage("session"),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    id: "test-extension-id",
    sendMessage: vi.fn(),
    lastError: null,
    getManifest: vi.fn(() => ({ version: "0.1.0", content_scripts: [] })),
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    onMessage: { addListener: vi.fn() },
  },
  permissions: {
    contains: vi.fn(async () => false),
    request: vi.fn(async () => true),
  },
  tabs: {
    query: vi.fn(async () => [{ id: 1, url: "https://example.com" }]),
    create: vi.fn(),
    get: vi.fn(async (id: number) => ({ id, url: "https://example.com" })),
    onRemoved: { addListener: vi.fn() },
  },
  action: {
    setBadgeText: vi.fn(async () => {}),
    setBadgeBackgroundColor: vi.fn(async () => {}),
  },
  webNavigation: {
    onCommitted: { addListener: vi.fn() },
    onHistoryStateUpdated: { addListener: vi.fn() },
  },
  scripting: {
    executeScript: vi.fn(async () => {}),
  },
} as unknown as typeof chrome;

// Helper: reset mock storage between tests
export function resetStorage() {
  storageMock.local = {};
  storageMock.session = {};
}

export { storageMock };
