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
  }

];
