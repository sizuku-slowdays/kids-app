const weights = ['100g', '150g', '200g', '300g'];

const menu = [
  {id:'loin', name:'ロース ステーキ', category:'ステーキ', prices:[1706,2246,2678,3758]},
  {id:'sagari', name:'サガリ ステーキ', category:'ステーキ', prices:[1490,1922,2354,3110]},
  {id:'ribeye', name:'リブロース ステーキ', category:'ステーキ', prices:[1814,2354,2894,3974]},
  {id:'sirloin', name:'サーロイン ステーキ', category:'ステーキ', prices:[2246,3002,3650,5162]},
  {id:'fillet', name:'ヒレ ステーキ', category:'ステーキ', prices:[2894,3974,5054,7214]},
  {id:'hamburg', name:'ハンバーグ ステーキ', category:'ハンバーグ', prices:[1274,1490,1814,2354]},
  {id:'chicken', name:'チキン ステーキ', category:'ステーキ', prices:[1058,1274,1490,1922]},
  {id:'pork', name:'唐津開拓豚', category:'ステーキ', prices:[1166,1490,1706,2138]},
  {id:'curry', name:'ビーフカレー', category:'カレー', prices:[1274]},
];

export const californiaStore = {
  id:'california-steak-nogata',
  name:'カリフォルニアステーキ 野方店',
  type:'order',
  note:'店頭メニュー画像の税込価格。ご飯・スープ・ビーフシチュー食べ放題の案内あり。カレーは個別表記あり。トッピングの税込価格は要確認。',
  categories:['ステーキ', 'ハンバーグ', 'カレー'],
  courses:[],
  source_version:'california-steak-nogata-20261124',
  products:menu.map(({id,name,category,prices})=>({
    id:'california-'+id,
    name,
    category,
    period:'all',
    time_note:'提供時間帯の記載なし',
    note:id==='curry'?'スープ付き・ライス大盛り無料。ビーフシチュー食べ放題の対象かは要確認。':'ご飯・スープ・ビーフシチュー食べ放題付き。',
    hidden:false,
    variants:prices.map((price,index)=>({
      id:'california-'+id+'-'+(id==='curry'?'plate':weights[index]),
      label:id==='curry'?'1皿':weights[index],
      price,
    })),
  })),
};
