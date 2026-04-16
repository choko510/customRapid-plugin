export function enable(api) {
  const showCommandPalette = () => api.context.systems.ui?.CommandPalette?.show();

  api.registerCommand({
    id: 'open-command-palette',
    label: api.t('plugin_manager.bundled.command_palette.command_label'),
    keywords: 'command palette quick actions',
    run: showCommandPalette
  });

  api.registerToolbarButton({
    id: 'open-command-palette',
    label: api.t('plugin_manager.bundled.command_palette.toolbar_label'),
    title: api.t('plugin_manager.bundled.command_palette.command_label'),
    run: showCommandPalette
  });
}

export function disable() {}

export function dispose() {}
