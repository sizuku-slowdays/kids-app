// Checked 2026-10-16 against the PDF linked by the official Fukushige shop page.
// The official table has no junior/senior high school category. Never guess that rate.
export const nurubonStore = {
 id:'nurubon-fukushige',name:'焼肉ヌルボンガーデン 福重店',type:'buffet',age_scheme:'split-school',
 source_url:'https://www.nurubon.co.jp/img/tenpo/pdf/5ten_tabe.pdf',source_version:'nurubon-fukushige-20261016',
 note:'福重店公式PDFを2026/10/16確認。サラダバー・ソフトクリームバー付き。高学年＝小4〜6、低学年＝小1〜3。幼児＝4歳〜未就学児。全コースLO30分前。中高生専用料金は公式記載なしのため確認待ち。',
 courses:[
  {id:'otegaru120',name:'お手軽120分',prices:[3718,3388,null,1859,1408,748,0]},
  {id:'otegaru90',name:'お手軽90分',prices:[3278,2948,null,1639,1188,748,0]},
  {id:'nurubon',name:'ヌルボン120分',prices:[4708,4378,null,2354,1518,748,0]},
  {id:'kiwami',name:'極味120分',prices:[5808,5478,null,2904,1628,748,0]},
  {id:'gensen',name:'国産牛厳撰120分',prices:[6908,6578,null,3454,1738,748,0]}
 ],
 drink_options:[
  {id:'soft',name:'ソフトドリンク飲み放題',prices:[550,550,550,550,550,110,0]},
  {id:'no-beer',name:'ビールなし飲み放題',prices:[1738,1738,null,null,null,null,null]},
  {id:'beer',name:'ビールあり飲み放題',prices:[2178,2178,null,null,null,null,null]}
 ],
 drink_note:'飲み放題を付ける場合はグループ全員が選択。ソフトとお酒は併用可、ビールあり・なし同士の併用不可。お酒は20歳以上のみ。4歳〜未就学児のソフト110円、3歳以下無料。90分コースでも同じ飲み放題料金。'
};
