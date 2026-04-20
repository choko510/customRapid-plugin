# photo-adjust-tools

`photo-adjust-tools` は、JOSM の PhotoAdjust ワークフローに近い写真位置補正操作を Rapid へ追加するプラグインです。

## Modes of operation

以下のどちらかで機能します。

1. 写真レイヤーが有効なとき（Mapillary / KartaView / Streetside）
2. `Photo Adjust Map Mode` が ON のとき（Shift+P またはツールバー）

優先ルール:

- 写真レイヤーがアクティブな場合は、そのレイヤーのみ編集対象
- Map Mode と写真レイヤーが同時に有効なら、写真レイヤー優先
- Map Mode 単体時は読み込み済みの写真レイヤー全体を対象

## Functions

### Select a photo

写真をクリックして選択します。

### Add another photo to selection

`Shift + クリック` で選択へ追加します。

### Add range of photos to selection

`Ctrl + Shift + クリック` で、同一レイヤー内の範囲を追加選択します。

### Move a photo

選択写真をドラッグして位置を移動します。

### Place a photo on the map

`Ctrl + Alt + クリック` で、現在選択写真をクリック地点に配置します。

### Set the direction of a photo

`Ctrl + クリック` で、現在選択写真の向きをクリック地点へ向けます。

### Edit photo GPS data

`Edit Photo GPS Data` コマンドで、テキスト入力により以下を更新できます。

- latitude
- longitude
- direction

変更は Rapid 内の写真表示位置・向きに即時反映されます。

## Notes

- 操作対象は「現在ロードされている写真データ」です。
- Geotagged Images の削除/ディスク削除や PageUp/PageDown ナビゲーションは Rapid 本体側の機能を利用してください。
