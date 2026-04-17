# customRapid-plugin Authoring Guide

このドキュメントは、`customRapid-plugin` に新規プラグインを追加して配信するための標準手順です。  
Quickstart だけでなく、manifest/registry の設計方針、実装パターン、検証ルールまでをまとめています。

## 1. 前提

- Node.js 20 以上（`package.json` の `engines.node`）
- npm 利用
- 配信先は `main` ブランチ（raw URL が常に `main` を参照）

```bash
npm install
npm run check
```

`npm run check` は以下を連続実行します。

1. `npm run lint`
2. `npm run test`
3. `npm run validate`

## 2. 配信アーキテクチャ

このリポジトリは 3 層構造です。

1. `registry.json`  
   Plugin Manager が最初に読むインデックス。
2. `plugins/<plugin-id>/manifest.json`  
   プラグインメタデータ。
3. `plugins/<plugin-id>/index.mjs`  
   実行される entrypoint。

`registry.json -> manifest.json -> index.mjs` の参照がすべて整合している必要があります。

## 3. 新規プラグイン追加手順

## 3.1 ディレクトリ作成

```text
plugins/<plugin-id>/
  manifest.json
  index.mjs
```

`plugin-id` は将来変更しない前提で命名してください（互換性の軸になります）。

## 3.2 manifest.json 作成

テンプレート:

```json
{
  "version": 1,
  "id": "my-plugin",
  "name": "My Plugin",
  "ja-name": "マイプラグイン",
  "description": "Example plugin",
  "ja-description": "説明",
  "pluginVersion": "1.0.0",
  "kinds": ["ui", "operation"],
  "tags": ["productivity"],
  "capabilities": ["ui.toolbar", "ui.commandPalette"],
  "entrypoint": "https://raw.githubusercontent.com/choko510/customRapid-plugin/main/plugins/my-plugin/index.mjs"
}
```

必須:

- `id`
- `name`
- `kinds`（空配列不可）
- `entrypoint`

推奨:

- `ja-name`, `ja-description`（Plugin Manager 表示の日本語品質向上）
- `tags`（検索・フィルタ性向上）

### `kinds` の制約

`scripts/validate-registry.mjs` で許可されるのは次の 3 種のみです。

- `data`
- `ui`
- `operation`

## 3.3 index.mjs 実装

entrypoint は `enable` を必ず export してください。

```js
export function enable(api) {
  api.registerCommand({
    id: 'my-command',
    label: 'My Command',
    keywords: 'example',
    run: () => {}
  });
}

export function disable() {}
export function dispose() {}
```

`disable` / `dispose` は任意ですが、イベント解除や後始末を持つプラグインでは実装推奨です。

## 3.4 registry.json へ登録

```json
{
  "id": "my-plugin",
  "manifestURL": "https://raw.githubusercontent.com/choko510/customRapid-plugin/main/plugins/my-plugin/manifest.json"
}
```

署名配布する場合のみ、次の 3 つを同時に設定してください。

- `manifestHash`
- `signature`
- `keyID`

部分指定（2/3 など）は `validate-registry.mjs` でエラーになります。

## 3.5 テスト追加

`test/plugins/<plugin-id>.test.mjs` を追加し、最低限次を検証してください。

1. `enable(api)` で command / toolbar が登録される
2. `run()` が依存システム未存在でも例外で落ちない
3. プラグイン固有ロジック（純関数）がある場合は直接ユニットテスト

既存例:

- `test/plugins/command-palette-tools.test.mjs`
- `test/plugins/rapid-layer-tools.test.mjs`
- `test/plugins/issues-pane-tools.test.mjs`
- `test/plugins/fastdraw-tools.test.mjs`

## 4. Host API の使い方

Rapid 側 plugin host が提供する API（2026-04 時点）:

- `api.registerCommand({ id, label, keywords?, shortcut?, run })`
- `api.registerOperation(...)`（`registerCommand` の alias）
- `api.registerToolbarButton({ id, label, title?, run })`
- `api.registerDatasetManifest(manifest)`
- `api.notify(message, kind?)`
- `api.t(stringID, replacements?)`
- `api.context`

### 実装指針

- `run` は副作用を閉じ込め、外側に生ポインタを漏らさない
- Optional chaining（`?.`）で host 依存を防御
- Command ID は plugin ローカルで一意にする（最終的に host 側で namespaced 化される）

## 5. Capability 設計指針

capabilities は host 側の permission prompt に表示される契約情報です。  
最小権限で宣言してください。

この repo で実績のある capability 名:

- `ui.toolbar`
- `ui.commandPalette`
- `ui.panes.issues`
- `map.layers`
- `map.edit`

命名は `domain.scope` 形式を推奨します。

## 6. validate-registry の実チェック項目

`npm run validate`（`scripts/validate-registry.mjs`）は主に次を検証します。

- `registry.version === 1`
- `registry.plugins` / `registry.revoked` が配列
- `plugins[].id` 重複なし
- `manifestURL` / `entrypoint` が http(s) URL
- local raw URL を指す場合、対応ファイルが実在
- `manifest.id === registry.plugins[].id`
- `manifest.kinds` が空でなく許可値のみ
- 署名 3 点セットの同時性
- `manifestHash` を指定した場合の sha256(base64) 一致

## 7. 変更時チェックリスト

PR 前に必ず確認してください。

1. `registry.json` に追加漏れがない
2. `manifest.json` の `id` とディレクトリ名が一致
3. `entrypoint` URL が実ファイルと一致
4. `npm run check` 成功
5. README の配信プラグイン一覧と docs を更新

## 8. トラブルシュート

### Plugin Manager に表示されない

- `registry.json` の `manifestURL` が誤っている
- `manifest.json` の JSON 構文が不正
- `id` 不一致（registry と manifest）

### インストールはできるが動かない

- `enable` が export されていない
- `run` 内で `api.context.systems.*` 参照が null のまま実行される
- capability 不足で intended API 使用が拒否される

### validate で落ちる

- `kinds` に未対応値が含まれる
- 署名関連フィールドが部分指定
- `manifestHash` が実ファイル内容と不一致

