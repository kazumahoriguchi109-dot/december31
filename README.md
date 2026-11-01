# 12月31日

大晦日の昼、ゲームの中へ迷い込んだ幼馴染の二人が、六つの謎を解いて自分たちの部屋へ帰る、戦闘のない脱出アドベンチャー。ブラウザで遊べます（PC向け。マウスでもキーボードでも進められます）。

**遊ぶ：** https://kazumahoriguchi109-dot.github.io/december31/

- セーブはこのブラウザの中（IndexedDB）だけに保存されます。別のブラウザ・端末・URLとは共有されません。「セーブ一覧」から書き出せます。
- 絵と音はゲームの中で作った簡素なものです（録音や既存の素材は使っていません）。

## 開発

```bash
npm ci
npm run dev        # http://127.0.0.1:5173/
npm test           # 単体テスト
npm run e2e        # ブラウザテスト（Chromium / WebKit / Firefox）
npm run build && npm run check:bundle
```

Node は `.node-version` を参照。GitHub Pages へは `main` への push で `.github/workflows/pages.yml` が自動で公開します。

## 第三者ソフトウェア

[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照。
