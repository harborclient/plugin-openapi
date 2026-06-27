import {
  Button,
  FormGroup,
  Input,
  LoadingMessage,
  StatusMessage
} from '@harborclient/sdk/components';
import type { PluginContext } from '@harborclient/sdk';
import { useCallback, useEffect, useMemo, useState } from '@harborclient/sdk/react';
import { methodColorClass } from '@harborclient/sdk/ui';
import {
  operationsToCreateRequests,
  parseOpenApiSpec,
  type ParsedOpenApiOperation,
  type ParsedOpenApiSpec
} from '../openapi/parse';

const STORAGE_KEY_LAST_PATH = 'lastSpecPath';

interface Props {
  /**
   * Renderer plugin context from the host.
   */
  hc: PluginContext;
}

/**
 * Groups parsed operations by their OpenAPI tag folder for preview rendering.
 *
 * @param operations - Flattened operations from the parsed spec.
 * @returns Folder names mapped to operation rows.
 */
function groupOperationsByFolder(
  operations: ParsedOpenApiOperation[]
): Map<string, ParsedOpenApiOperation[]> {
  const groups = new Map<string, ParsedOpenApiOperation[]>();

  for (const operation of operations) {
    const folder = operation.folder ?? '';
    const existing = groups.get(folder) ?? [];
    existing.push(operation);
    groups.set(folder, existing);
  }

  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Full main-area workflow for picking, previewing, and importing an OpenAPI spec.
 */
export function ImportView({ hc }: Props) {
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specPath, setSpecPath] = useState<string | null>(null);
  const [parsedSpec, setParsedSpec] = useState<ParsedOpenApiSpec | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const collectionNameError = error === 'Collection name is required.' ? error : undefined;
  const globalError = error != null && error !== 'Collection name is required.' ? error : null;

  /**
   * Loads the last picked spec path from plugin storage on mount.
   */
  useEffect(() => {
    let active = true;
    void hc.storage
      .get<string>(STORAGE_KEY_LAST_PATH)
      .then((value) => {
        if (active && typeof value === 'string' && value.trim()) {
          setSpecPath(value);
        }
      })
      .catch(() => {
        /* ignore missing storage */
      });
    return () => {
      active = false;
    };
  }, [hc.storage]);

  /**
   * Keeps the collection name aligned with the parsed API title.
   */
  useEffect(() => {
    if (parsedSpec && !collectionName.trim()) {
      setCollectionName(parsedSpec.title);
    }
  }, [parsedSpec, collectionName]);

  /**
   * Selected operations derived from the current checkbox state.
   */
  const selectedOperations = useMemo(() => {
    if (!parsedSpec) {
      return [];
    }
    return parsedSpec.operations.filter((operation) => selectedIds.has(operation.id));
  }, [parsedSpec, selectedIds]);

  /**
   * Parsed operations grouped by tag folder for the preview list.
   */
  const groupedOperations = useMemo(() => {
    if (!parsedSpec) {
      return new Map<string, ParsedOpenApiOperation[]>();
    }
    return groupOperationsByFolder(parsedSpec.operations);
  }, [parsedSpec]);

  /**
   * Reads and parses an OpenAPI file from an absolute path on the allowlist.
   *
   * @param path - User-selected spec file path.
   */
  const loadSpecFromPath = useCallback(
    async (path: string): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const text = await hc.fs.readFile(path);
        const parsed = parseOpenApiSpec(text);
        setSpecPath(path);
        setParsedSpec(parsed);
        setCollectionName(parsed.title);
        setSelectedIds(new Set(parsed.operations.map((operation) => operation.id)));
        await hc.storage.set(STORAGE_KEY_LAST_PATH, path);
      } catch (loadError) {
        setParsedSpec(null);
        setSelectedIds(new Set());
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to read the OpenAPI file.'
        );
      } finally {
        setBusy(false);
      }
    },
    [hc.fs, hc.storage]
  );

  /**
   * Opens the native file picker and loads the chosen OpenAPI document.
   */
  const handlePickFile = useCallback(async (): Promise<void> => {
    setError(null);
    const paths = await hc.fs.pickFile({
      title: 'Choose an OpenAPI spec',
      filters: [
        { name: 'OpenAPI', extensions: ['json', 'yaml', 'yml'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'YAML', extensions: ['yaml', 'yml'] }
      ]
    });

    if (paths.length === 0) {
      return;
    }

    await loadSpecFromPath(paths[0]);
  }, [hc.fs, loadSpecFromPath]);

  /**
   * Toggles one operation in the import selection set.
   *
   * @param operationId - Stable operation id from the parsed spec.
   */
  const handleToggleOperation = useCallback((operationId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }
      return next;
    });
  }, []);

  /**
   * Selects or clears every operation in one folder group.
   *
   * @param folder - Folder label shown in the preview, or empty for root operations.
   * @param checked - Whether the folder group should be selected.
   */
  const handleToggleFolder = useCallback(
    (folder: string, checked: boolean): void => {
      if (!parsedSpec) {
        return;
      }

      setSelectedIds((current) => {
        const next = new Set(current);
        for (const operation of parsedSpec.operations) {
          if ((operation.folder ?? '') === folder) {
            if (checked) {
              next.add(operation.id);
            } else {
              next.delete(operation.id);
            }
          }
        }
        return next;
      });
    },
    [parsedSpec]
  );

  /**
   * Creates a HarborClient collection from the selected preview operations.
   */
  const handleImport = useCallback(async (): Promise<void> => {
    const trimmedName = collectionName.trim();
    if (!trimmedName) {
      setError('Collection name is required.');
      return;
    }
    if (selectedOperations.length === 0) {
      setError('Select at least one operation to import.');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const result = await hc.host.createCollection({
        name: trimmedName,
        requests: operationsToCreateRequests(selectedOperations)
      });
      hc.ui.showToast(`Imported ${selectedOperations.length} requests into "${trimmedName}"`);
      void result.collectionId;
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'Failed to import the OpenAPI spec.'
      );
    } finally {
      setImporting(false);
    }
  }, [collectionName, hc.host, hc.ui, selectedOperations]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center justify-between border-b border-separator px-4 py-3">
        <div>
          <h1 className="text-[16px] font-medium text-text">Import OpenAPI</h1>
          <p className="text-[14px] text-muted">
            Parse an OpenAPI 3.x spec locally and create a HarborClient collection grouped by tags.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy || importing}
          onClick={() => {
            void handlePickFile();
          }}
        >
          Choose file…
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {busy ? <LoadingMessage>Loading OpenAPI spec…</LoadingMessage> : null}

        {globalError != null ? (
          <StatusMessage id="openapi-import-error" className="mb-4 text-danger" live>
            {globalError}
          </StatusMessage>
        ) : null}

        {!parsedSpec && !busy ? (
          <StatusMessage live={false}>
            Choose an OpenAPI JSON or YAML file to preview its operations before importing.
            {specPath != null ? (
              <>
                {' '}
                Last file: <span className="font-mono text-text">{specPath}</span>
              </>
            ) : null}
          </StatusMessage>
        ) : null}

        {parsedSpec != null ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <FormGroup
                label="Collection name"
                htmlFor="openapi-collection-name"
                error={collectionNameError}
              >
                <Input
                  id="openapi-collection-name"
                  type="text"
                  value={collectionName}
                  disabled={importing}
                  onChange={(event) => {
                    setCollectionName(event.target.value);
                  }}
                />
              </FormGroup>
              {specPath != null ? (
                <p className="text-[14px] text-muted">
                  Source: <span className="font-mono text-text-secondary">{specPath}</span>
                </p>
              ) : null}
              {parsedSpec.baseUrl ? (
                <p className="text-[14px] text-muted">
                  Base URL:{' '}
                  <span className="font-mono text-text-secondary">{parsedSpec.baseUrl}</span>
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] text-text">
                {selectedOperations.length} of {parsedSpec.operations.length} operations selected
              </p>
              <Button
                variant="primary"
                disabled={importing || selectedOperations.length === 0}
                onClick={() => {
                  void handleImport();
                }}
              >
                {importing ? 'Importing…' : 'Import collection'}
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {[...groupedOperations.entries()].map(([folder, operations]) => {
                const folderLabel = folder || 'Untagged';
                const folderCheckboxId = `openapi-folder-${folderLabel.replace(/\s+/g, '-')}`;
                const selectedInFolder = operations.filter((operation) =>
                  selectedIds.has(operation.id)
                ).length;
                const allSelected = selectedInFolder === operations.length;
                const partiallySelected = selectedInFolder > 0 && !allSelected;

                return (
                  <section
                    key={folderLabel}
                    aria-labelledby={`${folderCheckboxId}-label`}
                    className="rounded border border-separator bg-control"
                  >
                    <div className="flex items-center gap-2 border-b border-separator px-3 py-2">
                      <Input
                        id={folderCheckboxId}
                        type="checkbox"
                        checked={allSelected}
                        ref={(element) => {
                          if (element) {
                            element.indeterminate = partiallySelected;
                          }
                        }}
                        disabled={importing}
                        onChange={(event) => {
                          handleToggleFolder(folder, event.target.checked);
                        }}
                      />
                      <h2
                        id={`${folderCheckboxId}-label`}
                        className="text-[14px] font-medium text-text"
                      >
                        {folderLabel}
                      </h2>
                      <span className="text-[14px] text-muted">({operations.length})</span>
                    </div>
                    <ul className="divide-y divide-separator">
                      {operations.map((operation) => {
                        const checkboxId = `openapi-operation-${operation.id}`;
                        return (
                          <li key={operation.id} className="px-3 py-2">
                            <FormGroup
                              layout="checkboxAdjacent"
                              htmlFor={checkboxId}
                              labelClassName="min-w-0 flex-1 cursor-pointer"
                              label={
                                <>
                                  <span className="block text-[14px] font-medium text-text">
                                    {operation.name}
                                  </span>
                                  <span className="mt-1 block font-mono text-[14px] text-text-secondary">
                                    <span className={methodColorClass(operation.method)}>
                                      {operation.method}
                                    </span>{' '}
                                    {operation.url}
                                  </span>
                                  {operation.comment ? (
                                    <span className="mt-1 block text-[14px] text-muted">
                                      {operation.comment}
                                    </span>
                                  ) : null}
                                </>
                              }
                            >
                              <Input
                                id={checkboxId}
                                type="checkbox"
                                checked={selectedIds.has(operation.id)}
                                disabled={importing}
                                onChange={() => {
                                  handleToggleOperation(operation.id);
                                }}
                              />
                            </FormGroup>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
