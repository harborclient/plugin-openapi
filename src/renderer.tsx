import { installReact } from "@harborclient/sdk";
import type { PluginContext } from "@harborclient/sdk";
import { ImportView } from "./components/ImportView";

const MAIN_VIEW_ID = "openapi.import";
const COMMAND_ID = "openapi.import";

/**
 * Activates the renderer half and registers the OpenAPI import UI contributions.
 *
 * @param hc - Renderer plugin context from the HarborClient host.
 */
export function activate(hc: PluginContext): void {
  installReact(hc.react);

  /**
   * Main view host that closes over the plugin context.
   */
  function ImportViewHost() {
    return <ImportView hc={hc} />;
  }

  hc.subscriptions.push(
    hc.commands.register(COMMAND_ID, () => {
      void hc.commands.execute(
        "harborclient:openMainView",
        hc.pluginId,
        MAIN_VIEW_ID
      );
    })
  );

  hc.subscriptions.push(
    hc.ui.registerMainView({
      id: MAIN_VIEW_ID,
      title: "Import OpenAPI",
      Component: ImportViewHost,
    })
  );

  hc.subscriptions.push(
    hc.ui.registerMenuItem({
      menu: "file",
      command: COMMAND_ID,
      label: "Import OpenAPI",
      group: "import",
    })
  );
}
