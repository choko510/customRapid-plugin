# customRapid-plugin

Rapid Plugin Manager向けの配信用レジストリ/プラグインリポジトリです。  
既定のレジストリURLは次の通りです。

- `https://raw.githubusercontent.com/choko510/customRapid-plugin/main/registry.json`

## 目的

- Rapid Plugin Managerからインストール可能なプラグインを配信する
- プラグインのmanifest/entrypointを一元管理する
- レジストリJSONの整合性をCIで検証する

## クイックスタート

1. 依存インストール
   - `npm install`
2. Lint
   - `npm run lint`
3. テスト
   - `npm run test`
4. レジストリ検証
   - `npm run validate`

## ディレクトリ構成

- `registry.json` : Plugin Managerが読む配信インデックス
- `plugins/<plugin-id>/manifest.json` : プラグイン定義
- `plugins/<plugin-id>/index.mjs` : プラグイン本体
- `scripts/validate-registry.mjs` : レジストリ検証スクリプト
- `test/plugins/*.test.mjs` : プラグイン挙動テスト
- `.github/workflows/validate.yml` : CI

## 現在配信中のプラグイン

- `command-palette-tools`
- `rapid-layer-tools`
- `issues-pane-tools`
- `fastdraw-tools`

## 配信ルール

- `manifestURL` と `entrypoint` は raw.githubusercontent の絶対URLで記述する
- `registry.json` の `plugins[].id` と `manifest.json` の `id` は一致させる
- 署名付き配布する場合は `manifestHash` / `signature` / `keyID` を付与する

## ドキュメント

- `docs/README.md` : ドキュメント索引
- `docs/authoring.md` : プラグイン追加の標準手順
- `docs/runtime-reference.md` : Rapid Plugin runtime / API リファレンス
- `docs/fastdraw-tools.md` : FastDraw plugin 設計・操作仕様
