import { createStorageStore, type StorageStore } from '@harborclient/sdk/store';
import type { PluginStorage } from '@harborclient/sdk';

const STORAGE_KEY = 'pendingOpenApiImport';

/**
 * Pending OpenAPI import session seeded by File -> Import.
 */
export interface OpenApiImportSession {
  /**
   * Raw UTF-8 contents of the selected OpenAPI file.
   */
  contents: string;

  /**
   * Absolute path to the selected file.
   */
  path: string;

  /**
   * Base file name including extension.
   */
  name: string;
}

/**
 * Parses a persisted import session from plugin storage.
 *
 * @param raw - Raw storage value.
 * @returns Parsed session or null when absent or invalid.
 */
function parseSession(raw: unknown): OpenApiImportSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const session = raw as Record<string, unknown>;
  if (
    typeof session.contents !== 'string' ||
    typeof session.path !== 'string' ||
    typeof session.name !== 'string'
  ) {
    return null;
  }

  return {
    contents: session.contents,
    path: session.path,
    name: session.name
  };
}

/** Per-storage API store instances for agent and view webviews. */
const stores = new WeakMap<PluginStorage, StorageStore<OpenApiImportSession | null>>();

/**
 * Returns the storage-backed import session store for one plugin context.
 *
 * @param storage - Plugin storage API from `hc.storage`.
 * @returns Reactive store shared across plugin webviews via main-process storage.
 */
export function getOpenApiImportSessionStore(
  storage: PluginStorage
): StorageStore<OpenApiImportSession | null> {
  let store = stores.get(storage);
  if (!store) {
    store = createStorageStore({
      storage,
      key: STORAGE_KEY,
      parse: parseSession
    });
    stores.set(storage, store);
  }
  return store;
}

/**
 * Persists the next OpenAPI import session for the preview UI.
 *
 * @param storage - Plugin storage API from `hc.storage`.
 * @param session - Selected import file forwarded from File -> Import.
 */
export async function setOpenApiImportSession(
  storage: PluginStorage,
  session: OpenApiImportSession
): Promise<void> {
  await getOpenApiImportSessionStore(storage).set(session);
}

/**
 * Clears the pending OpenAPI import session after it has been consumed.
 *
 * @param storage - Plugin storage API from `hc.storage`.
 */
export async function clearOpenApiImportSession(storage: PluginStorage): Promise<void> {
  await getOpenApiImportSessionStore(storage).set(null);
}
