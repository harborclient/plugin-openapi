import type { PluginContext } from '@harborclient/sdk';
import { ImportView } from './components/ImportView';
import { setOpenApiImportSession } from './importSession';
import { canImportOpenApiSpec } from './openapi/parse';
import { registerImportHandler } from './pluginImports';

const MAIN_VIEW_ID = 'openapi.import';

/**
 * Returns whether this webview is the plugin agent (not an isolated view shell).
 */
function isAgentWebview(): boolean {
  const role = new URL(globalThis.location.href).searchParams.get('role');
  return role == null || role === 'agent';
}

/**
 * Activates the renderer half and registers the OpenAPI import UI contributions.
 *
 * @param hc - Renderer plugin context from the HarborClient host.
 */
export function activate(hc: PluginContext): void {
  /**
   * Main view host that closes over the plugin context.
   */
  function ImportViewHost() {
    return <ImportView hc={hc} />;
  }

  hc.subscriptions.push(
    hc.ui.registerMainView({
      id: MAIN_VIEW_ID,
      title: 'Import OpenAPI',
      Component: ImportViewHost
    })
  );

  if (!isAgentWebview()) {
    return;
  }

  hc.subscriptions.push(
    registerImportHandler(hc, ['.json', '.yaml', '.yml'], {
      canImport: (file) => canImportOpenApiSpec(file.contents),
      import: async (file) => {
        await setOpenApiImportSession(hc.storage, {
          contents: file.contents,
          path: file.path,
          name: file.name
        });
        await hc.commands.execute('harborclient:openMainView', hc.pluginId, MAIN_VIEW_ID);
      }
    })
  );
}
