# 12月31日

大晦日の昼、ゲームの中へ迷い込んだ幼馴染の二人が、六つの謎を解いて自分たちの部屋へ帰る、戦闘のない脱出アドベンチャー。ブラウザで遊べます（PC向け。マウスでもキーボードでも進められます）。

**遊ぶ：** https://kazumahoriguchi109-dot.github.io/december31/

- セーブはこのブラウザの中（IndexedDB）だけに保存されます。別のブラウザ・端末・URLとは共有されません。「セーブ一覧」から書き出せます。
- 冬景色の3D素材、会話の表情、4段階の画風を実装しています。タイトル画はAI生成、音楽はオリジナル合成音、操作音3点はKenneyのCC0素材です。出典は第三者通知とassets/audio/SOURCES.mdを参照。

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

## 2026-11-05 更新

冬のタイトル・UI、人物の顔と会話表情・短い到着動作、雪景色を追加。P01の接続表示、P03の人物遮蔽、P05の全景/側面/操作配置、P06の足元と圧板を改善しました。保存済みミュートを音声接続前に反映し、同名効果音の連打時の重なりも整理しています。セーブ形式・謎の正解条件は変更していません。

ブラウザテストは標準2workers。別サーバーを使う場合はE2E_URL（開発版）またはLIVE_URL（配布版）を指定できます。音の自動検査は人による試聴・初見プレイ評価の代わりではありません。
