# 機械可読データ

MDが仕様正本。dialogue.jsonはdocs/DIALOGUE.mdの台詞とメタデータに対応、生成スクリプトで同時更新する。save.schema.jsonは保存の構造、save.example.jsonは1件の初期例。puzzles.jsonとworld.jsonは謎/座標の基準。screens.jsonは画面状態。

ゲームコードではない。schemaと型の一致だけで意味上の整合を保証しない。progressとpuzzles、Toto位置、会話cursorの条件はMDおよび検証スクリプトで照合する。実装時に型生成するならバージョンを固定し、MDの変更と同じ変更単位で行う。

## 追加（2026-11-01）

- `objectives.json`：目的文の機械可読データ（STORYの場面契約とPUZZLESの目的表示を統合。先に一致した規則を採用、謎の場所の規則を節目全体の規則より先に置く）。
- `ui_copy.json`：拒否・状態などのUI文言（C01のP03早呼びなどを含む）。MD（PUZZLES/CONTROLS/SCREENS）と同じ変更単位で直す。
