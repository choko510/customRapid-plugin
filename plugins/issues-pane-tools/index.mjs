export function enable(api) {
  api.registerCommand({
    id: 'open-issues-pane',
    label: api.t('plugin_manager.bundled.issues_pane.command_label'),
    keywords: 'issues qa validation pane',
    run: () => api.context.systems.ui?.Overmap?.MapPanes?.Issues?.togglePane()
  });
}

export function disable() {}

export function dispose() {}
