# node-merge-brush Plugin Specification

`node-merge-brush` は、近接して重なっているノード群を円形範囲でまとめて整理するための編集支援プラグインです。

## 1. 目的

- 近接重複ノードを一括でマージして形状を整理する
- 「範囲を囲んで整える」作業を1アクションで行えるようにする
- 既存の `actionMergeNodes` 制約を尊重した安全な自動処理にする

## 2. 追加される操作

`enable(api)` で次を登録します。

1. Command: `toggle-node-merge-brush-mode`（`Shift+M`）
2. Command: `toggle-node-merge-brush-merge`（自動マージ ON/OFF）
3. Toolbar: `toggle-node-merge-brush-mode`（`Merge`）

ショートカット競合対策:

- `Shift+M` はプラグイン共通レジストリで排他取得します
- Rapid 本体ショートカット予約と衝突する場合も `Shift+M` は自動無効化されます
- すでに他プラグインが同じキーを使用中の場合、`Shift+M` は無効化されツールバー/コマンドパレットのみ利用可能になります
- Node Merge Brush モード中はツールロックを取得し、他の編集系プラグインモードと同時起動しません

## 3. 操作フロー

1. `Shift+M`（またはツールバー `Merge`）でモード開始
2. 円形で整えたい範囲をドラッグ
3. プレビューで候補ノードに黄色リング表示
4. マウスを離すと、近接かつ条件適合ノードを自動マージ
5. そのまま連続して次の範囲を処理可能（`Esc` か再度 `Shift+M` で終了）

`Node Merge Auto Merge` コマンドで自動マージを ON/OFF できます。

## 4. マージ判定ルール

候補ノードは次条件でフィルタされます。

- ブラシ円の内部にある
- 既定では `vertex`（ウェイ頂点）のみ対象
- ノード間距離が `mergeDistancePx` 以下
- `layer` / `level` / `addr:housenumber` / `addr:unit` が一致
- 両方が interesting tags を持つ組み合わせは除外
- 同一ウェイ上で隣接する頂点同士は除外

最終マージは Rapid 本体の `actionMergeNodes` を使用し、`disabled` 判定が通る組のみ適用します。

## 5. 既定パラメータ

- `mergeDistancePx`: `10`
- `minBrushRadiusPx`: `24`
- `maxCandidateNodes`: `800`
- `verticesOnly`: `true`
- `mergeEnabled`: `true`

## 6. トランザクションと履歴

- 編集は `editor.beginTransaction()` / `perform()` / `commit()` / `endTransaction()` で実施
- annotation は `Node Merge Brush: merged <n> groups`
- survivor ノードを選択状態に残します

## 7. 既知の制約

- 候補が非常に多い場合はパフォーマンス保護のため上限で打ち切ります
- `actionMergeNodes` の制約（relation/restriction 等）により、見た目上近くてもマージされない場合があります
