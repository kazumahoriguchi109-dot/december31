export const STAGE_ANNOUNCEMENTS = [
 {title:'冒険のはじまり',support:'宝箱をクリックして開けよう',kind:'START'},
 {title:'2Dの世界へようこそ',support:'↑ ↓ / W S で移動　白い印でトトに待機をお願いしよう',kind:'WORLD UNLOCKED'},
 {title:'世界に色がついた！',support:'↑ ↓ ← → / WASD で移動　近くのレバーをクリック / E',kind:'WORLD UNLOCKED'},
 {title:'3Dの世界へようこそ',support:'T / 人物切替で、ふたりを動かそう',kind:'WORLD UNLOCKED'},
 {title:'昔と今がつながった',support:'昔の部屋は上下移動　T / 人物切替',kind:'STAGE CLEAR'},
 {title:'時間の流れを使いこなそう',support:'足場の乗り降りは、クリック / E',kind:'STAGE CLEAR'},
 {title:'ふたりで、帰り道をつくろう',support:'T / 人物切替で協力しよう',kind:'STAGE CLEAR'},
 {title:'おかえり、12月31日',support:'6つの謎をクリア！',kind:'ALL CLEAR'},
] as const;

/** タッチ端末向けの補足文（キーボード表記を使わない）。STAGE_ANNOUNCEMENTS と同じ並び。 */
export const TOUCH_SUPPORT = [
 '宝箱をタップして開けよう',
 '画面の ↑ ↓ で移動　白い印でトトに待機をお願いしよう',
 '画面の矢印で移動　近くのレバーをタップ',
 '「トトに切替」で、ふたりを動かそう',
 '昔の部屋は上下移動　「切替」ボタンで人物を替えよう',
 '足場の乗り降りは「調べる」ボタン',
 '「切替」ボタンで協力しよう',
 '6つの謎をクリア！',
] as const;
