# 🌾 Farm Coop 3D
協力プレイ3D一人称オンライン農業ゲーム（Node.js + WebSocket + three.js）

## 遊び方
- 名前を入れ、**部屋を作成**（コード空欄でランダム生成）または**コードで参加**
- WASD移動 / Space ジャンプ / Shift ダッシュ / クリックで道具使用
- 1〜6: 鍬・小麦・人参・南瓜・水・収穫（コインは全員で共有）
- 流れ: 鍬で耕す → 種を植える（コイン消費）→ 水をやる（水が付いている間だけ成長）→ 収穫でコイン獲得

## セーブ
- 部屋コード＝セーブスロット。10秒ごと自動保存＆全員退出時に保存。同じコードで再参加すると続きから。
- `K` 手動セーブ / `L` セーブをJSONでダウンロード / ロビーの「セーブファイルから部屋を作成」で復元
- Renderの無料プランはファイルが再起動で消えるので、JSONバックアップ推奨。有料ならdiskを有効化（`render.yaml`のコメント参照）

## ローカル起動
```
npm install
npm start   # http://localhost:3000
```

## GitHub → Render
1. `git init && git add . && git commit -m init` → GitHubにpush
2. Render: New → Web Service → リポジトリ選択（`render.yaml`を自動認識。手動なら Build: `npm install` / Start: `npm start`）
3. 発行されたURLを友達に共有し、部屋コードで合流
