import type { Disposable, PluginContext } from '@harborclient/sdk';

/**
 * File selected through **File → Import** and forwarded to plugin import handlers.
 */
export interface ImportFile {
  /**
   * Base file name including extension.
   */
  name: string;

  /**
   * Absolute path to the selected file.
   */
  path: string;

  /**
   * Normalized extension with a leading dot (for example `.json`).
   */
  extension: string;

  /**
   * Raw UTF-8 file contents.
   */
  contents: string;
}

/**
 * Callbacks registered for one import format.
 */
export interface ImportHandler {
  /**
   * Returns whether this handler should process the file.
   */
  canImport: (file: ImportFile) => boolean | Promise<boolean>;

  /**
   * Performs the import workflow for a matched file.
   */
  import: (file: ImportFile) => void | Promise<void>;
}

/**
 * Plugin context extended with HarborClient import handler registration.
 */
export interface PluginContextWithImports extends PluginContext {
  /**
   * **File → Import** handler registration provided by the HarborClient host.
   */
  imports: {
    /**
     * Registers a handler for one or more file extensions.
     */
    registerHandler: (extensions: string | string[], handler: ImportHandler) => Disposable;
  };
}

/**
 * Registers an import handler (auto-tracked by the host on deactivation).
 *
 * @param hc - Renderer plugin context from the HarborClient host.
 * @param extensions - File extensions such as `.json` or `yaml`.
 * @param handler - Import detection and execution callbacks.
 * @returns Disposable that unregisters the handler.
 */
export function registerImportHandler(
  hc: PluginContext,
  extensions: string | string[],
  handler: ImportHandler
): Disposable {
  const context = hc as PluginContextWithImports;
  return context.imports.registerHandler(extensions, handler);
}
