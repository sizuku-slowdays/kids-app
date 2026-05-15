const questions = [

  // =========================
  // やさしい：20問
  // =========================
  {
    level: "easy",
    genre: "計算",
    question: "25 × 4 = ?",
    options: ["50", "75", "100", "125"],
    answer: "100",
    explanation: "25を4つ集めると100です。25×4=100。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "120 ÷ 6 = ?",
    options: ["12", "18", "20", "24"],
    answer: "20",
    explanation: "6×20=120なので、120÷6=20です。"
  },
  {
    level: "easy",
    genre: "割合",
    question: "1000円の10%はいくら？",
    options: ["10円", "50円", "100円", "200円"],
    answer: "100円",
    explanation: "10%は10分の1です。1000円の10分の1は100円です。"
  },
  {
    level: "easy",
    genre: "単位",
    question: "1時間30分は何分？",
    options: ["60分", "75分", "90分", "120分"],
    answer: "90分",
    explanation: "1時間は60分。60分+30分=90分です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "15 + 27 = ?",
    options: ["32", "42", "52", "62"],
    answer: "42",
    explanation: "15+27=42です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "80 - 35 = ?",
    options: ["35", "40", "45", "55"],
    answer: "45",
    explanation: "80から35を引くと45です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "9 × 7 = ?",
    options: ["56", "63", "72", "81"],
    answer: "63",
    explanation: "9×7=63です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "48 ÷ 8 = ?",
    options: ["5", "6", "7", "8"],
    answer: "6",
    explanation: "8×6=48なので、48÷8=6です。"
  },
  {
    level: "easy",
    genre: "割合",
    question: "500円の半分はいくら？",
    options: ["100円", "200円", "250円", "300円"],
    answer: "250円",
    explanation: "半分は2で割ります。500÷2=250円です。"
  },
  {
    level: "easy",
    genre: "単位",
    question: "2mは何cm？",
    options: ["20cm", "100cm", "200cm", "2000cm"],
    answer: "200cm",
    explanation: "1mは100cmなので、2mは200cmです。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "36 + 19 = ?",
    options: ["45", "55", "65", "75"],
    answer: "55",
    explanation: "36+19=55です。36+20=56から1引くと55です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "100 - 28 = ?",
    options: ["62", "72", "78", "82"],
    answer: "72",
    explanation: "100-28=72です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "11 × 6 = ?",
    options: ["56", "60", "66", "72"],
    answer: "66",
    explanation: "11×6=66です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "64 ÷ 4 = ?",
    options: ["12", "14", "16", "18"],
    answer: "16",
    explanation: "4×16=64なので、64÷4=16です。"
  },
  {
    level: "easy",
    genre: "買い物",
    question: "120円のものを3個買うといくら？",
    options: ["240円", "300円", "360円", "420円"],
    answer: "360円",
    explanation: "120×3=360円です。"
  },
  {
    level: "easy",
    genre: "単位",
    question: "3kgは何g？",
    options: ["30g", "300g", "3000g", "30000g"],
    answer: "3000g",
    explanation: "1kgは1000gなので、3kgは3000gです。"
  },
  {
    level: "easy",
    genre: "割合",
    question: "200円の25%はいくら？",
    options: ["25円", "40円", "50円", "100円"],
    answer: "50円",
    explanation: "25%は4分の1です。200÷4=50円です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "13 × 5 = ?",
    options: ["55", "60", "65", "70"],
    answer: "65",
    explanation: "13×5=65です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "90 ÷ 9 = ?",
    options: ["8", "9", "10", "11"],
    answer: "10",
    explanation: "9×10=90なので、90÷9=10です。"
  },
  {
    level: "easy",
    genre: "計算",
    question: "7 × 8 + 4 = ?",
    options: ["56", "60", "64", "68"],
    answer: "60",
    explanation: "7×8=56。56+4=60です。"
  },

  // =========================
  // ふつう：20問
  // =========================
  {
    level: "normal",
    genre: "方程式",
    question: "3x + 5 = 20 のとき、x は？",
    options: ["3", "4", "5", "6"],
    answer: "5",
    explanation: "3x+5=20 → 3x=15 → x=5です。"
  },
  {
    level: "normal",
    genre: "平方根",
    question: "√49 の値は？",
    options: ["6", "7", "8", "9"],
    answer: "7",
    explanation: "7×7=49なので、√49=7です。"
  },
  {
    level: "normal",
    genre: "図形",
    question: "三角形の内角の和は？",
    options: ["90°", "120°", "180°", "360°"],
    answer: "180°",
    explanation: "どんな三角形でも、内角の和は180°です。"
  },
  {
    level: "normal",
    genre: "計算",
    question: "18 × 5 = ?",
    options: ["80", "85", "90", "95"],
    answer: "90",
    explanation: "18×5=90です。10×5=50、8×5=40、合わせて90。"
  },
  {
    level: "normal",
    genre: "関数",
    question: "y = 2x + 3 で、x = 4 のとき y は？",
    options: ["8", "9", "10", "11"],
    answer: "11",
    explanation: "y=2×4+3=8+3=11です。"
  },
  {
    level: "normal",
    genre: "因数分解",
    question: "x² + 5x + 6 を因数分解すると？",
    options: ["(x+1)(x+6)", "(x+2)(x+3)", "(x+2)(x+4)", "(x+3)(x+3)"],
    answer: "(x+2)(x+3)",
    explanation: "足して5、かけて6になる数は2と3です。"
  },
  {
    level: "normal",
    genre: "方程式",
    question: "2x - 7 = 9 のとき、x は？",
    options: ["6", "7", "8", "9"],
    answer: "8",
    explanation: "2x-7=9 → 2x=16 → x=8です。"
  },
  {
    level: "normal",
    genre: "割合",
    question: "定価2000円の商品が20%引き。値引き後はいくら？",
    options: ["1200円", "1400円", "1600円", "1800円"],
    answer: "1600円",
    explanation: "20%引きは80%の値段です。2000×0.8=1600円です。"
  },
  {
    level: "normal",
    genre: "図形",
    question: "縦6cm、横8cmの長方形の面積は？",
    options: ["14cm²", "28cm²", "42cm²", "48cm²"],
    answer: "48cm²",
    explanation: "長方形の面積は縦×横。6×8=48cm²です。"
  },
  {
    level: "normal",
    genre: "計算",
    question: "72 ÷ 8 + 6 = ?",
    options: ["12", "15", "18", "21"],
    answer: "15",
    explanation: "72÷8=9。9+6=15です。"
  },
  {
    level: "normal",
    genre: "平方根",
    question: "√81 の値は？",
    options: ["7", "8", "9", "10"],
    answer: "9",
    explanation: "9×9=81なので、√81=9です。"
  },
  {
    level: "normal",
    genre: "方程式",
    question: "x ÷ 4 = 6 のとき、x は？",
    options: ["10", "16", "20", "24"],
    answer: "24",
    explanation: "x÷4=6なので、両辺に4をかけて x=24 です。"
  },
  {
    level: "normal",
    genre: "関数",
    question: "y = -x + 5 で、x = 2 のとき y は？",
    options: ["2", "3", "5", "7"],
    answer: "3",
    explanation: "y=-2+5=3です。"
  },
  {
    level: "normal",
    genre: "図形",
    question: "半径5cmの円の直径は？",
    options: ["5cm", "10cm", "15cm", "25cm"],
    answer: "10cm",
    explanation: "直径は半径の2倍です。5×2=10cmです。"
  },
  {
    level: "normal",
    genre: "計算",
    question: "35 × 12 = ?",
    options: ["320", "360", "400", "420"],
    answer: "420",
    explanation: "35×12=35×10+35×2=350+70=420です。"
  },
  {
    level: "normal",
    genre: "因数分解",
    question: "x² + 7x + 10 を因数分解すると？",
    options: ["(x+1)(x+10)", "(x+2)(x+5)", "(x+3)(x+4)", "(x+5)(x+5)"],
    answer: "(x+2)(x+5)",
    explanation: "足して7、かけて10になる数は2と5です。"
  },
  {
    level: "normal",
    genre: "方程式",
    question: "5x = 45 のとき、x は？",
    options: ["5", "7", "9", "10"],
    answer: "9",
    explanation: "5x=45なので、45÷5=9です。"
  },
  {
    level: "normal",
    genre: "割合",
    question: "300人の40%は何人？",
    options: ["90人", "100人", "120人", "140人"],
    answer: "120人",
    explanation: "300×0.4=120人です。"
  },
  {
    level: "normal",
    genre: "図形",
    question: "底辺10cm、高さ6cmの三角形の面積は？",
    options: ["30cm²", "40cm²", "50cm²", "60cm²"],
    answer: "30cm²",
    explanation: "三角形の面積は底辺×高さ÷2。10×6÷2=30cm²です。"
  },
  {
    level: "normal",
    genre: "計算",
    question: "144 ÷ 12 = ?",
    options: ["10", "11", "12", "14"],
    answer: "12",
    explanation: "12×12=144なので、144÷12=12です。"
  },

  // =========================
  // むずかしい：20問
  // =========================
  {
    level: "hard",
    genre: "三平方",
    question: "直角三角形で、斜辺が13、一辺が5のとき、もう一辺は？",
    options: ["8", "10", "12", "14"],
    answer: "12",
    explanation: "13²-5²=169-25=144。√144=12です。"
  },
  {
    level: "hard",
    genre: "図形",
    question: "半径3cmの円の面積は？",
    options: ["3π cm²", "6π cm²", "9π cm²", "12π cm²"],
    answer: "9π cm²",
    explanation: "円の面積はπr²。半径3なので、π×3²=9π cm²です。"
  },
  {
    level: "hard",
    genre: "連立方程式",
    question: "x + y = 10、x - y = 2 のとき、x は？",
    options: ["4", "5", "6", "8"],
    answer: "6",
    explanation: "2つの式を足すと2x=12。よってx=6です。"
  },
  {
    level: "hard",
    genre: "二次方程式",
    question: "x² - 9 = 0 の解は？",
    options: ["x=3のみ", "x=-3のみ", "x=±3", "x=9"],
    answer: "x=±3",
    explanation: "x²=9なので、x=3またはx=-3です。"
  },
  {
    level: "hard",
    genre: "割合",
    question: "ある数の20%が36です。ある数はいくつ？",
    options: ["120", "160", "180", "200"],
    answer: "180",
    explanation: "20%は5分の1です。36×5=180です。"
  },
  {
    level: "hard",
    genre: "三平方",
    question: "直角三角形で、2辺が6cmと8cmのとき、斜辺は？",
    options: ["9cm", "10cm", "12cm", "14cm"],
    answer: "10cm",
    explanation: "6²+8²=36+64=100。√100=10cmです。"
  },
  {
    level: "hard",
    genre: "連立方程式",
    question: "x + y = 12、x = y + 4 のとき、x は？",
    options: ["6", "7", "8", "9"],
    answer: "8",
    explanation: "x=y+4を代入すると、y+4+y=12。2y=8でy=4。x=8です。"
  },
  {
    level: "hard",
    genre: "二次方程式",
    question: "x² - 5x + 6 = 0 の解は？",
    options: ["x=1,6", "x=2,3", "x=-2,-3", "x=3,6"],
    answer: "x=2,3",
    explanation: "x²-5x+6=(x-2)(x-3)。よってx=2,3です。"
  },
  {
    level: "hard",
    genre: "図形",
    question: "半径4cmの円周の長さは？",
    options: ["4π cm", "8π cm", "12π cm", "16π cm"],
    answer: "8π cm",
    explanation: "円周は2πr。半径4なので、2π×4=8π cmです。"
  },
  {
    level: "hard",
    genre: "関数",
    question: "y = 3x - 2 で、y = 10 のとき x は？",
    options: ["2", "3", "4", "5"],
    answer: "4",
    explanation: "10=3x-2 → 3x=12 → x=4です。"
  },
  {
    level: "hard",
    genre: "平方根",
    question: "√144 + √25 = ?",
    options: ["12", "15", "17", "19"],
    answer: "17",
    explanation: "√144=12、√25=5。12+5=17です。"
  },
  {
    level: "hard",
    genre: "割合",
    question: "600円の商品を15%引きで買うといくら？",
    options: ["490円", "500円", "510円", "540円"],
    answer: "510円",
    explanation: "15%引きは85%の値段。600×0.85=510円です。"
  },
  {
    level: "hard",
    genre: "図形",
    question: "一辺が7cmの正方形の対角線の長さは？",
    options: ["7cm", "7√2 cm", "14cm", "14√2 cm"],
    answer: "7√2 cm",
    explanation: "正方形の対角線は一辺×√2。よって7√2 cmです。"
  },
  {
    level: "hard",
    genre: "関数",
    question: "一次関数 y = ax + 2 が点(3, 11)を通る。aは？",
    options: ["2", "3", "4", "5"],
    answer: "3",
    explanation: "11=3a+2 → 3a=9 → a=3です。"
  },
  {
    level: "hard",
    genre: "因数分解",
    question: "x² - 16 を因数分解すると？",
    options: ["(x-4)(x-4)", "(x+4)(x+4)", "(x-4)(x+4)", "(x-8)(x+2)"],
    answer: "(x-4)(x+4)",
    explanation: "x²-16は平方の差です。x²-4²=(x-4)(x+4)。"
  },
  {
    level: "hard",
    genre: "確率",
    question: "サイコロを1回振って、偶数が出る確率は？",
    options: ["1/6", "1/3", "1/2", "2/3"],
    answer: "1/2",
    explanation: "偶数は2,4,6の3つ。全体6通りなので3/6=1/2です。"
  },
  {
    level: "hard",
    genre: "連立方程式",
    question: "2x + y = 11、x + y = 7 のとき、x は？",
    options: ["2", "3", "4", "5"],
    answer: "4",
    explanation: "2つの式を引くとx=4です。"
  },
  {
    level: "hard",
    genre: "二次関数",
    question: "y = x² - 4 で、x = 3 のとき y は？",
    options: ["3", "4", "5", "9"],
    answer: "5",
    explanation: "y=3²-4=9-4=5です。"
  },
  {
    level: "hard",
    genre: "計算",
    question: "48 × 25 = ?",
    options: ["1000", "1100", "1200", "1300"],
    answer: "1200",
    explanation: "25は100の4分の1。48×25=48×100÷4=1200です。"
  },
  {
    level: "hard",
    genre: "図形",
    question: "底面積20cm²、高さ9cmの三角柱の体積は？",
    options: ["90cm³", "120cm³", "180cm³", "200cm³"],
    answer: "180cm³",
    explanation: "柱の体積は底面積×高さ。20×9=180cm³です。"
  },

  // =========================
  // 挑戦：20問
  // =========================
  {
    level: "challenge",
    genre: "三角比",
    question: "sin30° の値は？",
    options: ["1/2", "√2/2", "√3/2", "1"],
    answer: "1/2",
    explanation: "sin30°=1/2です。基本の三角比としてよく出ます。"
  },
  {
    level: "challenge",
    genre: "三角比",
    question: "cos60° の値は？",
    options: ["1/2", "√2/2", "√3/2", "1"],
    answer: "1/2",
    explanation: "cos60°=1/2です。sin30°と同じ値になります。"
  },
  {
    level: "challenge",
    genre: "三角比",
    question: "tan45° の値は？",
    options: ["0", "1/2", "1", "√3"],
    answer: "1",
    explanation: "tan45°=1です。45°の直角二等辺三角形を考えると分かりやすいです。"
  },
  {
    level: "challenge",
    genre: "関数",
    question: "二次関数 y = x² で、x = -3 のとき y は？",
    options: ["-9", "-6", "6", "9"],
    answer: "9",
    explanation: "(-3)²=9です。マイナス同士をかけるとプラスになります。"
  },
  {
    level: "challenge",
    genre: "ひらめき計算",
    question: "125 × 8 = ?",
    options: ["800", "900", "1000", "1200"],
    answer: "1000",
    explanation: "125×8=1000です。よく使う暗算パターンです。"
  },
  {
    level: "challenge",
    genre: "三角比",
    question: "sin60° の値は？",
    options: ["1/2", "√2/2", "√3/2", "1"],
    answer: "√3/2",
    explanation: "sin60°=√3/2です。"
  },
  {
    level: "challenge",
    genre: "三角比",
    question: "cos45° の値は？",
    options: ["1/2", "√2/2", "√3/2", "1"],
    answer: "√2/2",
    explanation: "cos45°=√2/2です。"
  },
  {
    level: "challenge",
    genre: "三角比",
    question: "tan30° の値は？",
    options: ["1/√3", "1", "√3", "2"],
    answer: "1/√3",
    explanation: "tan30°=1/√3です。√3/3とも表せます。"
  },
  {
    level: "challenge",
    genre: "関数",
    question: "y = 2x² で、x = -2 のとき y は？",
    options: ["-8", "-4", "4", "8"],
    answer: "8",
    explanation: "2×(-2)²=2×4=8です。"
  },
  {
    level: "challenge",
    genre: "二次方程式",
    question: "x² - 4x = 0 の解は？",
    options: ["x=0,4", "x=2のみ", "x=-4,0", "x=4のみ"],
    answer: "x=0,4",
    explanation: "x²-4x=x(x-4)。よってx=0,4です。"
  },
  {
    level: "challenge",
    genre: "ひらめき計算",
    question: "99 × 101 = ?",
    options: ["999", "9999", "10099", "10199"],
    answer: "9999",
    explanation: "99×101=(100-1)(100+1)=10000-1=9999です。"
  },
  {
    level: "challenge",
    genre: "平方根",
    question: "√50 を簡単にすると？",
    options: ["5√2", "10√2", "25√2", "2√5"],
    answer: "5√2",
    explanation: "√50=√(25×2)=5√2です。"
  },
  {
    level: "challenge",
    genre: "図形",
    question: "正三角形の1つの内角は？",
    options: ["30°", "45°", "60°", "90°"],
    answer: "60°",
    explanation: "正三角形は3つの角が等しく、180°÷3=60°です。"
  },
  {
    level: "challenge",
    genre: "確率",
    question: "コインを2回投げて、2回とも表になる確率は？",
    options: ["1/2", "1/3", "1/4", "1/8"],
    answer: "1/4",
    explanation: "表表、表裏、裏表、裏裏の4通りのうち1通りなので1/4です。"
  },
  {
    level: "challenge",
    genre: "数列",
    question: "2, 4, 8, 16, □ に入る数は？",
    options: ["20", "24", "30", "32"],
    answer: "32",
    explanation: "前の数を2倍していく数列です。16×2=32です。"
  },
  {
    level: "challenge",
    genre: "数列",
    question: "1, 4, 9, 16, □ に入る数は？",
    options: ["20", "25", "27", "32"],
    answer: "25",
    explanation: "1²,2²,3²,4²と続く平方数です。次は5²=25です。"
  },
  {
    level: "challenge",
    genre: "関数",
    question: "y = -2x + 7 で、y = -1 のとき x は？",
    options: ["2", "3", "4", "5"],
    answer: "4",
    explanation: "-1=-2x+7 → -8=-2x → x=4です。"
  },
  {
    level: "challenge",
    genre: "三平方",
    question: "直角三角形で、2辺が9と12のとき斜辺は？",
    options: ["13", "14", "15", "16"],
    answer: "15",
    explanation: "9²+12²=81+144=225。√225=15です。"
  },
  {
    level: "challenge",
    genre: "ひらめき計算",
    question: "75 × 16 = ?",
    options: ["1000", "1100", "1200", "1300"],
    answer: "1200",
    explanation: "75×16=75×8×2=600×2=1200です。"
  },
  {
    level: "challenge",
    genre: "角度",
    question: "時計の3時ちょうど、長針と短針の角度は？",
    options: ["30°", "60°", "90°", "120°"],
    answer: "90°",
    explanation: "3時は長針が12、短針が3を指すので、直角の90°です。"
  },

// =========================
// 図形だけモード用：ふつう 10問
// =========================
{
  level: "normal",
  genre: "図形",
  question: "下の三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="50,180 250,180 150,40" fill="#eef2ff" stroke="#2563eb" stroke-width="4"/>
      <text x="58" y="170" font-size="24">50°</text>
      <text x="205" y="170" font-size="24">60°</text>
      <text x="140" y="75" font-size="30">?</text>
    </svg>
  `,
  options: ["60°", "70°", "80°", "90°"],
  answer: "70°",
  explanation: "三角形の内角の和は180°です。180-50-60=70°です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="50,180 250,180 150,45" fill="#ecfeff" stroke="#0891b2" stroke-width="4"/>
      <text x="58" y="170" font-size="24">40°</text>
      <text x="205" y="170" font-size="24">80°</text>
      <text x="140" y="78" font-size="30">?</text>
    </svg>
  `,
  options: ["50°", "60°", "70°", "80°"],
  answer: "60°",
  explanation: "三角形の内角の和は180°です。180-40-80=60°です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="55,180 250,180 110,45" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <text x="65" y="168" font-size="24">35°</text>
      <text x="205" y="170" font-size="24">95°</text>
      <text x="103" y="78" font-size="30">?</text>
    </svg>
  `,
  options: ["40°", "50°", "60°", "70°"],
  answer: "50°",
  explanation: "180-35-95=50°です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の直角三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,180 240,180 60,60" fill="#f0fdf4" stroke="#16a34a" stroke-width="4"/>
      <polyline points="60,160 80,160 80,180" fill="none" stroke="#16a34a" stroke-width="3"/>
      <text x="82" y="170" font-size="22">90°</text>
      <text x="190" y="170" font-size="24">35°</text>
      <text x="70" y="85" font-size="30">?</text>
    </svg>
  `,
  options: ["45°", "50°", "55°", "65°"],
  answer: "55°",
  explanation: "直角三角形なので、90°以外の2つの角の和は90°です。90-35=55°です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の直角三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="55,180 245,180 245,55" fill="#fdf2f8" stroke="#db2777" stroke-width="4"/>
      <polyline points="225,180 225,160 245,160" fill="none" stroke="#db2777" stroke-width="3"/>
      <text x="192" y="170" font-size="22">90°</text>
      <text x="70" y="170" font-size="24">25°</text>
      <text x="230" y="88" font-size="30">?</text>
    </svg>
  `,
  options: ["55°", "60°", "65°", "75°"],
  answer: "65°",
  explanation: "直角三角形なので、90-25=65°です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の長方形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <rect x="55" y="65" width="190" height="100" fill="#eef2ff" stroke="#4f46e5" stroke-width="4"/>
      <text x="130" y="195" font-size="24">8cm</text>
      <text x="8" y="120" font-size="24">5cm</text>
    </svg>
  `,
  options: ["13cm²", "26cm²", "40cm²", "80cm²"],
  answer: "40cm²",
  explanation: "長方形の面積は、たて×横です。5×8=40cm²です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の三角形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="55,175 245,175 150,55" fill="#ecfeff" stroke="#0891b2" stroke-width="4"/>
      <line x1="150" y1="55" x2="150" y2="175" stroke="#64748b" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="120" y="205" font-size="24">10cm</text>
      <text x="160" y="120" font-size="24">6cm</text>
    </svg>
  `,
  options: ["20cm²", "30cm²", "40cm²", "60cm²"],
  answer: "30cm²",
  explanation: "三角形の面積は、底辺×高さ÷2です。10×6÷2=30cm²です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の平行四辺形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="80,165 245,165 210,75 45,75" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <line x1="210" y1="75" x2="210" y2="165" stroke="#64748b" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="130" y="195" font-size="24">12cm</text>
      <text x="218" y="125" font-size="24">5cm</text>
    </svg>
  `,
  options: ["30cm²", "50cm²", "60cm²", "120cm²"],
  answer: "60cm²",
  explanation: "平行四辺形の面積は、底辺×高さです。12×5=60cm²です。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の円の直径は何cm？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <circle cx="150" cy="110" r="65" fill="#f0fdf4" stroke="#16a34a" stroke-width="4"/>
      <line x1="150" y1="110" x2="215" y2="110" stroke="#16a34a" stroke-width="4"/>
      <text x="165" y="100" font-size="24">4cm</text>
      <circle cx="150" cy="110" r="4" fill="#16a34a"/>
    </svg>
  `,
  options: ["4cm", "6cm", "8cm", "16cm"],
  answer: "8cm",
  explanation: "直径は半径の2倍です。4×2=8cmです。"
},
{
  level: "normal",
  genre: "図形",
  question: "下の円の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <circle cx="150" cy="110" r="65" fill="#fdf2f8" stroke="#db2777" stroke-width="4"/>
      <line x1="150" y1="110" x2="215" y2="110" stroke="#db2777" stroke-width="4"/>
      <text x="165" y="100" font-size="24">3cm</text>
      <circle cx="150" cy="110" r="4" fill="#db2777"/>
    </svg>
  `,
  options: ["3π cm²", "6π cm²", "9π cm²", "12π cm²"],
  answer: "9π cm²",
  explanation: "円の面積は π×半径×半径 です。π×3×3=9π cm²です。"
},

// =========================
// 図形だけモード用：やさしい 10問
// =========================
{
  level: "easy",
  genre: "図形",
  question: "下の三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="55,180 245,180 150,55" fill="#eef2ff" stroke="#2563eb" stroke-width="4"/>
      <text x="65" y="170" font-size="24">60°</text>
      <text x="205" y="170" font-size="24">60°</text>
      <text x="140" y="82" font-size="30">?</text>
    </svg>
  `,
  options: ["40°", "50°", "60°", "90°"],
  answer: "60°",
  explanation: "三角形の内角の和は180°です。180-60-60=60°です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="50,180 250,180 150,45" fill="#ecfeff" stroke="#0891b2" stroke-width="4"/>
      <text x="60" y="170" font-size="24">50°</text>
      <text x="205" y="170" font-size="24">50°</text>
      <text x="140" y="78" font-size="30">?</text>
    </svg>
  `,
  options: ["70°", "80°", "90°", "100°"],
  answer: "80°",
  explanation: "180-50-50=80°です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の直角三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="65,180 240,180 65,60" fill="#f0fdf4" stroke="#16a34a" stroke-width="4"/>
      <polyline points="65,160 85,160 85,180" fill="none" stroke="#16a34a" stroke-width="3"/>
      <text x="88" y="170" font-size="22">90°</text>
      <text x="190" y="170" font-size="24">30°</text>
      <text x="75" y="88" font-size="30">?</text>
    </svg>
  `,
  options: ["30°", "45°", "60°", "90°"],
  answer: "60°",
  explanation: "直角三角形では、90°以外の2つの角の和は90°です。90-30=60°です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の長方形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <rect x="65" y="70" width="170" height="90" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <text x="130" y="190" font-size="24">6cm</text>
      <text x="20" y="122" font-size="24">4cm</text>
    </svg>
  `,
  options: ["10cm²", "20cm²", "24cm²", "30cm²"],
  answer: "24cm²",
  explanation: "長方形の面積は、たて×横です。4×6=24cm²です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の正方形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <rect x="90" y="55" width="120" height="120" fill="#fdf2f8" stroke="#db2777" stroke-width="4"/>
      <text x="125" y="205" font-size="24">5cm</text>
    </svg>
  `,
  options: ["10cm²", "20cm²", "25cm²", "30cm²"],
  answer: "25cm²",
  explanation: "正方形の面積は、一辺×一辺です。5×5=25cm²です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の三角形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,175 240,175 150,65" fill="#eef2ff" stroke="#2563eb" stroke-width="4"/>
      <line x1="150" y1="65" x2="150" y2="175" stroke="#64748b" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="125" y="205" font-size="24">8cm</text>
      <text x="160" y="125" font-size="24">5cm</text>
    </svg>
  `,
  options: ["20cm²", "30cm²", "40cm²", "80cm²"],
  answer: "20cm²",
  explanation: "三角形の面積は、底辺×高さ÷2です。8×5÷2=20cm²です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の円の直径は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <circle cx="150" cy="110" r="60" fill="#ecfeff" stroke="#0891b2" stroke-width="4"/>
      <line x1="150" y1="110" x2="210" y2="110" stroke="#0891b2" stroke-width="4"/>
      <circle cx="150" cy="110" r="4" fill="#0891b2"/>
      <text x="162" y="100" font-size="24">5cm</text>
    </svg>
  `,
  options: ["5cm", "10cm", "15cm", "25cm"],
  answer: "10cm",
  explanation: "直径は半径の2倍です。5×2=10cmです。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <line x1="80" y1="170" x2="220" y2="170" stroke="#16a34a" stroke-width="5"/>
      <line x1="80" y1="170" x2="80" y2="60" stroke="#16a34a" stroke-width="5"/>
      <polyline points="80,145 105,145 105,170" fill="none" stroke="#16a34a" stroke-width="3"/>
      <text x="115" y="150" font-size="30">?</text>
    </svg>
  `,
  options: ["45°", "60°", "90°", "180°"],
  answer: "90°",
  explanation: "まっすぐ立った線と横の線でできる角は直角、つまり90°です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の平行四辺形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="80,165 235,165 205,80 50,80" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <line x1="205" y1="80" x2="205" y2="165" stroke="#64748b" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="125" y="195" font-size="24">7cm</text>
      <text x="215" y="125" font-size="24">4cm</text>
    </svg>
  `,
  options: ["11cm²", "14cm²", "28cm²", "56cm²"],
  answer: "28cm²",
  explanation: "平行四辺形の面積は、底辺×高さです。7×4=28cm²です。"
},
{
  level: "easy",
  genre: "図形",
  question: "下の三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="55,180 245,180 150,50" fill="#fdf2f8" stroke="#db2777" stroke-width="4"/>
      <text x="65" y="170" font-size="24">45°</text>
      <text x="205" y="170" font-size="24">45°</text>
      <text x="140" y="80" font-size="30">?</text>
    </svg>
  `,
  options: ["45°", "60°", "90°", "100°"],
  answer: "90°",
  explanation: "180-45-45=90°です。"
},

// =========================
// 図形だけモード用：むずかしい 10問
// =========================
{
  level: "hard",
  genre: "三平方",
  question: "下の直角三角形で、？の長さは？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,175 240,175 60,70" fill="#eef2ff" stroke="#2563eb" stroke-width="4"/>
      <polyline points="60,155 80,155 80,175" fill="none" stroke="#2563eb" stroke-width="3"/>
      <text x="125" y="195" font-size="24">12</text>
      <text x="25" y="130" font-size="24">5</text>
      <text x="145" y="120" font-size="28">?</text>
    </svg>
  `,
  options: ["12", "13", "14", "15"],
  answer: "13",
  explanation: "5²+12²=25+144=169。√169=13です。"
},
{
  level: "hard",
  genre: "三平方",
  question: "下の直角三角形で、？の長さは？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,175 245,175 60,65" fill="#ecfeff" stroke="#0891b2" stroke-width="4"/>
      <polyline points="60,155 80,155 80,175" fill="none" stroke="#0891b2" stroke-width="3"/>
      <text x="130" y="198" font-size="24">8</text>
      <text x="145" y="115" font-size="24">17</text>
      <text x="25" y="130" font-size="28">?</text>
    </svg>
  `,
  options: ["9", "12", "15", "16"],
  answer: "15",
  explanation: "斜辺17、一辺8です。17²-8²=289-64=225。√225=15です。"
},
{
  level: "hard",
  genre: "図形",
  question: "下の円の円周の長さは？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <circle cx="150" cy="110" r="65" fill="#f0fdf4" stroke="#16a34a" stroke-width="4"/>
      <line x1="150" y1="110" x2="215" y2="110" stroke="#16a34a" stroke-width="4"/>
      <circle cx="150" cy="110" r="4" fill="#16a34a"/>
      <text x="165" y="100" font-size="24">6cm</text>
    </svg>
  `,
  options: ["6π cm", "12π cm", "18π cm", "36π cm"],
  answer: "12π cm",
  explanation: "円周は2πrです。2×π×6=12π cmです。"
},
{
  level: "hard",
  genre: "図形",
  question: "下の円の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <circle cx="150" cy="110" r="65" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <line x1="150" y1="110" x2="215" y2="110" stroke="#ca8a04" stroke-width="4"/>
      <circle cx="150" cy="110" r="4" fill="#ca8a04"/>
      <text x="165" y="100" font-size="24">5cm</text>
    </svg>
  `,
  options: ["10π cm²", "20π cm²", "25π cm²", "50π cm²"],
  answer: "25π cm²",
  explanation: "円の面積はπr²です。π×5²=25π cm²です。"
},
{
  level: "hard",
  genre: "図形",
  question: "下の台形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="75,165 225,165 195,75 105,75" fill="#fdf2f8" stroke="#db2777" stroke-width="4"/>
      <line x1="195" y1="75" x2="195" y2="165" stroke="#64748b" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="130" y="67" font-size="24">8cm</text>
      <text x="125" y="195" font-size="24">14cm</text>
      <text x="205" y="125" font-size="24">6cm</text>
    </svg>
  `,
  options: ["48cm²", "54cm²", "60cm²", "66cm²"],
  answer: "66cm²",
  explanation: "台形の面積は、(上底+下底)×高さ÷2です。(8+14)×6÷2=66cm²です。"
},
{
  level: "hard",
  genre: "図形",
  question: "下の正方形の対角線の長さは？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <rect x="85" y="55" width="130" height="130" fill="#eef2ff" stroke="#2563eb" stroke-width="4"/>
      <line x1="85" y1="185" x2="215" y2="55" stroke="#ef4444" stroke-width="4"/>
      <text x="125" y="212" font-size="24">6cm</text>
      <text x="145" y="120" font-size="28">?</text>
    </svg>
  `,
  options: ["6cm", "6√2 cm", "12cm", "12√2 cm"],
  answer: "6√2 cm",
  explanation: "正方形の対角線は一辺×√2です。6√2 cmです。"
},
{
  level: "hard",
  genre: "角度",
  question: "下の平行線で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <line x1="45" y1="80" x2="255" y2="80" stroke="#0891b2" stroke-width="4"/>
      <line x1="45" y1="155" x2="255" y2="155" stroke="#0891b2" stroke-width="4"/>
      <line x1="100" y1="190" x2="210" y2="45" stroke="#0f172a" stroke-width="4"/>
      <text x="175" y="72" font-size="24">65°</text>
      <text x="105" y="150" font-size="30">?</text>
    </svg>
  `,
  options: ["55°", "65°", "115°", "125°"],
  answer: "65°",
  explanation: "平行線の同位角は等しいので、？も65°です。"
},
{
  level: "hard",
  genre: "角度",
  question: "下の直線上で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <line x1="45" y1="160" x2="255" y2="160" stroke="#16a34a" stroke-width="5"/>
      <line x1="150" y1="160" x2="215" y2="70" stroke="#16a34a" stroke-width="5"/>
      <text x="172" y="145" font-size="24">120°</text>
      <text x="95" y="145" font-size="30">?</text>
    </svg>
  `,
  options: ["40°", "50°", "60°", "70°"],
  answer: "60°",
  explanation: "直線上の角度の和は180°です。180-120=60°です。"
},
{
  level: "hard",
  genre: "図形",
  question: "下の三角形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="50,175 250,175 190,55" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <line x1="190" y1="55" x2="190" y2="175" stroke="#64748b" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="125" y="205" font-size="24">15cm</text>
      <text x="200" y="120" font-size="24">8cm</text>
    </svg>
  `,
  options: ["40cm²", "50cm²", "60cm²", "120cm²"],
  answer: "60cm²",
  explanation: "三角形の面積は底辺×高さ÷2です。15×8÷2=60cm²です。"
},
{
  level: "hard",
  genre: "図形",
  question: "下の直方体の体積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="80,80 190,80 230,115 120,115" fill="#e0f2fe" stroke="#2563eb" stroke-width="3"/>
      <polygon points="120,115 230,115 230,175 120,175" fill="#dbeafe" stroke="#2563eb" stroke-width="3"/>
      <polygon points="80,80 120,115 120,175 80,140" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
      <line x1="80" y1="140" x2="190" y2="140" stroke="#2563eb" stroke-width="3"/>
      <line x1="190" y1="80" x2="230" y2="115" stroke="#2563eb" stroke-width="3"/>
      <line x1="190" y1="80" x2="190" y2="140" stroke="#2563eb" stroke-width="3"/>
      <text x="145" y="202" font-size="22">6cm</text>
      <text x="235" y="150" font-size="22">4cm</text>
      <text x="72" y="110" font-size="22">5cm</text>
    </svg>
  `,
  options: ["60cm³", "80cm³", "100cm³", "120cm³"],
  answer: "120cm³",
  explanation: "直方体の体積は、たて×横×高さです。6×4×5=120cm³です。"
},

// =========================
// 図形だけモード用：挑戦 10問
// =========================
{
  level: "challenge",
  genre: "三角比",
  question: "下の直角三角形で、sinθ は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,175 240,175 60,70" fill="#eef2ff" stroke="#2563eb" stroke-width="4"/>
      <polyline points="60,155 80,155 80,175" fill="none" stroke="#2563eb" stroke-width="3"/>
      <text x="135" y="198" font-size="22">4</text>
      <text x="28" y="130" font-size="22">3</text>
      <text x="145" y="115" font-size="22">5</text>
      <text x="210" y="160" font-size="28">θ</text>
    </svg>
  `,
  options: ["3/5", "4/5", "3/4", "4/3"],
  answer: "3/5",
  explanation: "sinθは、向かい側の辺÷斜辺です。θの向かい側は3、斜辺は5なので3/5です。"
},
{
  level: "challenge",
  genre: "三角比",
  question: "下の直角三角形で、cosθ は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,175 240,175 60,70" fill="#ecfeff" stroke="#0891b2" stroke-width="4"/>
      <polyline points="60,155 80,155 80,175" fill="none" stroke="#0891b2" stroke-width="3"/>
      <text x="135" y="198" font-size="22">4</text>
      <text x="28" y="130" font-size="22">3</text>
      <text x="145" y="115" font-size="22">5</text>
      <text x="210" y="160" font-size="28">θ</text>
    </svg>
  `,
  options: ["3/5", "4/5", "3/4", "5/4"],
  answer: "4/5",
  explanation: "cosθは、となりの辺÷斜辺です。θのとなりの辺は4、斜辺は5なので4/5です。"
},
{
  level: "challenge",
  genre: "三角比",
  question: "下の直角三角形で、tanθ は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,175 240,175 60,70" fill="#f0fdf4" stroke="#16a34a" stroke-width="4"/>
      <polyline points="60,155 80,155 80,175" fill="none" stroke="#16a34a" stroke-width="3"/>
      <text x="135" y="198" font-size="22">4</text>
      <text x="28" y="130" font-size="22">3</text>
      <text x="145" y="115" font-size="22">5</text>
      <text x="210" y="160" font-size="28">θ</text>
    </svg>
  `,
  options: ["3/4", "4/3", "3/5", "4/5"],
  answer: "3/4",
  explanation: "tanθは、向かい側の辺÷となりの辺です。3÷4=3/4です。"
},
{
  level: "challenge",
  genre: "相似",
  question: "下の2つの三角形は相似です。？の長さは？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="35,165 120,165 35,85" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <polygon points="170,165 285,165 170,55" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <text x="67" y="190" font-size="22">4</text>
      <text x="10" y="125" font-size="22">3</text>
      <text x="220" y="190" font-size="22">8</text>
      <text x="145" y="120" font-size="28">?</text>
    </svg>
  `,
  options: ["4", "5", "6", "7"],
  answer: "6",
  explanation: "横の長さが4から8で2倍になっています。縦も3×2=6です。"
},
{
  level: "challenge",
  genre: "円周角",
  question: "同じ弧に対する中心角が100°のとき、円周角？は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <circle cx="150" cy="110" r="75" fill="#fdf2f8" stroke="#db2777" stroke-width="4"/>
      <circle cx="150" cy="110" r="4" fill="#db2777"/>
      <line x1="150" y1="110" x2="92" y2="65" stroke="#db2777" stroke-width="3"/>
      <line x1="150" y1="110" x2="208" y2="65" stroke="#db2777" stroke-width="3"/>
      <line x1="92" y1="65" x2="150" y2="185" stroke="#0f172a" stroke-width="3"/>
      <line x1="208" y1="65" x2="150" y2="185" stroke="#0f172a" stroke-width="3"/>
      <text x="130" y="88" font-size="22">100°</text>
      <text x="140" y="165" font-size="28">?</text>
    </svg>
  `,
  options: ["40°", "50°", "80°", "100°"],
  answer: "50°",
  explanation: "同じ弧に対する円周角は中心角の半分です。100÷2=50°です。"
},
{
  level: "challenge",
  genre: "角度",
  question: "下の二等辺三角形で、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="60,175 240,175 150,50" fill="#eef2ff" stroke="#2563eb" stroke-width="4"/>
      <text x="136" y="80" font-size="24">40°</text>
      <text x="70" y="165" font-size="30">?</text>
      <text x="200" y="165" font-size="30">?</text>
    </svg>
  `,
  options: ["60°", "65°", "70°", "80°"],
  answer: "70°",
  explanation: "二等辺三角形なので底角は等しいです。(180-40)÷2=70°です。"
},
{
  level: "challenge",
  genre: "面積比",
  question: "下の長方形で、ぬられた部分の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <rect x="55" y="55" width="190" height="120" fill="#ffffff" stroke="#16a34a" stroke-width="4"/>
      <polygon points="55,55 245,55 55,175" fill="#dcfce7" stroke="#16a34a" stroke-width="3"/>
      <text x="125" y="205" font-size="24">10cm</text>
      <text x="10" y="120" font-size="24">6cm</text>
    </svg>
  `,
  options: ["20cm²", "30cm²", "40cm²", "60cm²"],
  answer: "30cm²",
  explanation: "長方形の半分がぬられています。長方形は10×6=60cm²。半分は30cm²です。"
},
{
  level: "challenge",
  genre: "三平方",
  question: "下の図で、正方形の対角線が10cmのとき、一辺は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <rect x="85" y="55" width="130" height="130" fill="#ecfeff" stroke="#0891b2" stroke-width="4"/>
      <line x1="85" y1="185" x2="215" y2="55" stroke="#ef4444" stroke-width="4"/>
      <text x="135" y="120" font-size="24">10cm</text>
      <text x="125" y="212" font-size="28">?</text>
    </svg>
  `,
  options: ["5cm", "5√2 cm", "10√2 cm", "20cm"],
  answer: "5√2 cm",
  explanation: "正方形の対角線は一辺×√2です。一辺=10÷√2=5√2 cmです。"
},
{
  level: "challenge",
  genre: "円",
  question: "半径3cmの円を半分にした図形の面積は？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <path d="M85 120 A65 65 0 0 1 215 120 Z" fill="#fefce8" stroke="#ca8a04" stroke-width="4"/>
      <line x1="150" y1="120" x2="215" y2="120" stroke="#ca8a04" stroke-width="4"/>
      <circle cx="150" cy="120" r="4" fill="#ca8a04"/>
      <text x="165" y="110" font-size="24">3cm</text>
    </svg>
  `,
  options: ["3π cm²", "4.5π cm²", "6π cm²", "9π cm²"],
  answer: "4.5π cm²",
  explanation: "円の面積は9π cm²です。その半分なので4.5π cm²です。"
},
{
  level: "challenge",
  genre: "角度",
  question: "下の外角が120°のとき、？の角度は何度？",
  figure: `
    <svg viewBox="0 0 300 220" class="quiz-figure">
      <polygon points="70,175 210,175 135,70" fill="#fdf2f8" stroke="#db2777" stroke-width="4"/>
      <line x1="210" y1="175" x2="260" y2="175" stroke="#db2777" stroke-width="4"/>
      <text x="218" y="160" font-size="24">120°</text>
      <text x="82" y="165" font-size="24">50°</text>
      <text x="128" y="98" font-size="30">?</text>
    </svg>
  `,
  options: ["50°", "60°", "70°", "80°"],
  answer: "70°",
  explanation: "外角は、離れた2つの内角の和です。120=50+? なので、？=70°です。"
}

];
