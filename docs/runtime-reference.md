# Rapid Plugin Runtime Reference (for customRapid-plugin)

この資料は、Rapid 本体の PluginSystem 実装調査を元に、`customRapid-plugin` で実用的に使うための技術メモを整理したものです。  
実装・保守の判断材料として使うことを目的にしています。

## 1. Runtime ロードフロー

Rapid 側では概ね次の順で処理されます。

1. Active registry URL から `registry.json` を fetch
2. 対象 plugin の `manifestURL` を fetch
3. （必要に応じて）`manifestHash` / `signature` / `keyID` を検証
4. plugin module を dynamic import
5. `enable(api, manifest)` を呼び出し
6. plugin contribution（command / toolbar など）を登録

補足:

- registry plugin は revoke リストにより即時 disable 対象になります
- capability は初回 enable 時に prompt 対象です

## 2. Manifest / Registry の意味づけ

## 2.1 Registry 側 (`registry.json`)

- 配信インデックス
- `id` と `manifestURL` が必須
- 署名配布する場合のみ `manifestHash` / `signature` / `keyID` を 3 点セットで追加

## 2.2 Manifest 側 (`plugins/<id>/manifest.json`)

- plugin metadata の本体
- `kinds` と `capabilities` は UX と permission 表示の契約
- `entrypoint` は直接 import される実行 URL

## 3. Host API リファレンス

Rapid host API（調査時点）:

- `registerCommand(spec)`
- `registerOperation(spec)` (`registerCommand` alias)
- `registerToolbarButton(spec)`
- `registerDatasetManifest(manifest)`
- `notify(message, kind?)`
- `t(stringID, replacements?)`
- `context`

### 3.1 command / toolbar spec

`registerCommand`:

- `id`（必須）
- `label`（必須）
- `keywords`（任意）
- `shortcut`（任意）
- `run`（必須）

`registerToolbarButton`:

- `id`（必須）
- `label`（必須）
- `title`（任意）
- `run`（必須）

実運用では、`run` で null-safe に host 依存を辿るのが基本です。

```js
run: () => api.context.systems.ui?.CommandPalette?.show()
```

## 4. Contribution ID の扱い

plugin 側で登録する `id` は local ID です。  
Rapid host 側で `pluginID/localID` 形式へ namespaced 化されるため、plugin 内一意を守れば衝突しにくい設計です。

## 5. Capability の実務ルール

capability 文字列は host に厳密列挙される仕組みではなく、permission prompt 表示契約として扱われます。  
ただし、ユーザー理解と将来互換のために命名規約を固定してください。

推奨:

- `ui.toolbar`
- `ui.commandPalette`
- `ui.panes.issues`
- `map.layers`
- `map.edit`

## 6. 編集系プラグイン実装メモ

`fastdraw-tools` のように OSM 要素を直接生成する plugin は、`globalThis.Rapid` 経由で action/entity を使う構成が扱いやすいです。

代表例:

- `Rapid.osmNode(...)`
- `Rapid.osmWay(...)`
- `Rapid.actionAddEntity(...)`
- `Rapid.actionDeleteWay(...)`

編集反映は `editor` システム経由で行います。

1. `editor.beginTransaction()`
2. `editor.perform(...actions)`
3. `editor.commit({ annotation, selectedIDs })`
4. `editor.endTransaction()`

この順序を守ると、履歴・選択状態・Undo/Redo と整合しやすくなります。

## 7. Pointer / Keyboard 入力処理メモ

Pixi event を扱う場合、次を意識してください。

1. pointer event から map/screen 座標を明示的に計算する
2. target feature 参照は `DisplayObject.__feature__` を親方向へ辿る
3. editor モード競合を避けるため、必要なときは `preventDefault` / `stopPropagation`
4. 入力中は `input` / `textarea` / `contenteditable` へのショートカット侵入を防ぐ

## 8. テスト設計の標準

この repo では `node:test` + `assert/strict` を採用しています。  
高速で依存が少ないため、plugin ごとに純粋関数テスト + register/run テストを置く方針が適しています。

最低カバレッジの目安:

1. `enable()` で registration される
2. `run()` の happy path
3. host subsystem が無いときの safe path
4. パーサや簡略化など純粋ロジックの deterministic test

## 9. 互換性・保守ポリシー

- `plugin id` は後方互換の識別子なので変更しない
- command ID / toolbar ID は破壊変更しない
- capability 追加時は permission 変更として扱う
- `pluginVersion` は semantic version を維持

## 10. 運用チェック

CI（`.github/workflows/validate.yml`）は以下を必須化しています。

1. `npm run lint`
2. `npm run test`
3. `npm run validate`

ローカルでも同じ順で `npm run check` を実行し、結果一致を確認してから push してください。

