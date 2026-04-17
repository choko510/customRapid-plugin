export function enable(api) {
  const scene = api.context.systems.gfx?.scene;
  const toggleRapidLayer = () => {
    const isEnabled = scene?.layers?.get('rapid')?.enabled;
    if (isEnabled) {
      scene?.disableLayers('rapid');
    } else {
      scene?.enableLayers('rapid');
    }
  };

  api.registerCommand({
    id: 'toggle-rapid-layer',
    label: api.t('plugin_manager.bundled.rapid_layer.command_label'),
    keywords: 'rapid ai layer toggle',
    run: toggleRapidLayer
  });

  api.registerToolbarButton({
    id: 'toggle-rapid-layer',
    label: api.t('plugin_manager.bundled.rapid_layer.toolbar_label'),
    title: api.t('plugin_manager.bundled.rapid_layer.command_label'),
    run: toggleRapidLayer
  });
}

export function disable() {}

export function dispose() {}
