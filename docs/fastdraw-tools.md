# fastdraw-tools Plugin Specification

`fastdraw-tools` は、JOSM FastDraw のワークフローを Rapid Plugin 上で再現することを目的にした描画支援プラグインです。  
本資料は、実装仕様・設計意図・将来拡張ポイントをまとめています。

## 1. 目的

- クリック数を減らして曲線形状を素早く取得する
- 取得後に epsilon ベースで簡略化し、通常 OSM way として確定する
- 既存 way の再簡略化にも対応する（注意: 既存タグは削除）

## 2. エントリポイントと公開コマンド

`enable(api)` で次を登録します。

1. Command: `toggle-fastdraw-mode`（`Shift+F`）
2. Command: `open-fastdraw-settings`（`Q`）
3. Toolbar: `toggle-fastdraw-mode`

## 3. 操作仕様

## 3.1 基本フロー

1. `Shift+F` で FastDraw モード開始
2. ドラッグ / クリック / `Space` で点を追加
3. `Enter` で簡略化レビューへ遷移
4. `ArrowUp` / `ArrowDown` で epsilon 調整
5. `Enter` で way 確定
6. `Ctrl+Enter` / `Cmd+Enter` でクリップボードタグを適用して確定

## 3.2 編集操作

- `Ctrl+Click` / `Cmd+Click`: 固定点トグル（簡略化で保持）
- 既存 node に近い場合: snap して取り込み
- `Backspace` / `Delete`: 点削除
- `Shift+Click`: 点または線分近傍を削除
- review 中の点ドラッグ: 位置調整

## 3.3 既存 way 再簡略化

- 1 本の way を選択した状態で `Shift+F`
- 案内メッセージ表示後、`Shift+F` 再押下で取り込み
- review 後 `Enter` で置換確定
- 置換後の way はタグなし（元タグを引き継がない）

## 4. 内部ステートモデル

主な phase:

- `capture`: 点収集中
- `review`: 簡略化結果レビュー中

主な配列:

- `rawPoints`: 収集された元点列
- `reviewPoints`: 簡略化後の点列

固定点:

- `fixedRawIndices`: 元点で固定扱い
- `fixedReviewIndices`: review 点で固定表示

## 5. 簡略化仕様

アルゴリズム:

- RDP（Douglas-Peucker）系
- 画面ピクセル座標で誤差評価
- 端点 + 固定点を必保持
- 固定点の区間ごとに RDP 実行して統合

パラメータ:

- `epsilonPx`（初期 6）
- `epsilonStepFactor`（初期 1.35）
- `sampleMinDistancePx`（初期 4）
- `snapDistancePx`（初期 8）
- `autoSampleByDistance`（初期 true）

## 6. fastdraw.* 設定

保存キー:

- `fastdraw.settings.v1`（storage system）

`Q` でテキスト編集し、次フォーマットで反映します。

```text
fastdraw.epsilonPx=6
fastdraw.epsilonStepFactor=1.35
fastdraw.sampleMinDistancePx=4
fastdraw.snapDistancePx=8
fastdraw.autoSampleByDistance=true
```

補足:

- 不正値は sanitize して安全範囲へクランプ
- review 中に設定変更した場合は即再簡略化

## 7. タグ貼り付け仕様

`Ctrl+Enter` / `Cmd+Enter` 時:

- `navigator.clipboard.readText()` で取得
- 次形式を parse:
  - JSON object (`{"key":"value"}`)
  - `key=value` 行形式

失敗時はエラー通知し、確定処理を中断します。

## 8. 描画プレビュー

DOM Overlay (`.fastdraw-preview`) を map 上へ追加し、SVG で表示します。

- capture: 赤線
- review: 緑線
- review 点: 青枠
- 固定点: 黄リング

モード終了時は overlay を必ず破棄します。

## 9. 既知の制約

- undo/redo を FastDraw 専用 state と完全同期していない
- clipboard API 非対応環境では `Ctrl+Enter` が使えない
- 置換時のタグ継承は intentionally 未実装

## 10. テスト対象

`test/plugins/fastdraw-tools.test.mjs` で次を検証しています。

1. command / toolbar registration
2. `simplifyPolyline` が固定点を保持
3. クリップボードタグ parser（text / json）
4. `fastdraw.*` 設定 parser

## 11. 今後の拡張候補

1. 固定点の UI 表示トグル
2. 既存タグ引き継ぎオプション
3. Undo/Redo と FastDraw phase/state の同期強化
4. 設定 UI の modal 化（prompt 依存解消）

