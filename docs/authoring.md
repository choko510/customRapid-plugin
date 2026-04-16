# Plugin追加手順

## 1. プラグインディレクトリ作成

`plugins/<plugin-id>/` を作成し、以下を置きます。

- `manifest.json`
- `index.mjs`

## 2. manifest.json 作成

例:

```json
{
  "version": 1,
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "Example plugin",
  "pluginVersion": "1.0.0",
  "kinds": ["ui", "operation"],
  "capabilities": ["ui.toolbar", "ui.commandPalette"],
  "entrypoint": "https://raw.githubusercontent.com/choko510/customRapid-plugin/main/plugins/my-plugin/index.mjs"
}
```

## 3. registry.json へ登録

`registry.json` の `plugins` に追加します。

```json
{
  "id": "my-plugin",
  "manifestURL": "https://raw.githubusercontent.com/choko510/customRapid-plugin/main/plugins/my-plugin/manifest.json"
}
```

署名配布する場合は `manifestHash` / `signature` / `keyID` も同時に追加します。

## 4. 検証

```bash
npm run validate
```

## 5. 公開

`main` ブランチにマージされると、Rapid側は以下URL経由で最新を取得します。

- `https://raw.githubusercontent.com/choko510/customRapid-plugin/main/registry.json`
