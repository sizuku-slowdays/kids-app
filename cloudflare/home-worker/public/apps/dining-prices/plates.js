const MAX_PRICE = 1000000, MAX_COUNT = 9999, MAX_ROWS = 40;
const yen = n => n.toLocaleString('ja-JP') + '円';
const blank = () => ({price:'',count:'0'});
const integer = (value, max) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= max;

export function plateTotals(rows) {
  let total = 0, count = 0;
  for (const row of rows) {
    if (!integer(row.count, MAX_COUNT) || (row.price !== '' && !integer(row.price, MAX_PRICE)) || (Number(row.count) > 0 && row.price === '')) return null;
    count += Number(row.count);
    total += Number(row.price || 0) * Number(row.count);
  }
  return {total,count};
}

export class PlateCalculator {
  constructor(root) { this.root = root; this.key = null; }
  useHousehold(household) {
    const key = 'dining-plates-v1:' + household;
    if (this.key === key) return;
    this.key = key;
    this.rows = [blank(), blank(), blank()];
    this.storageOK = true;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(saved) && saved.length > 0 && saved.length <= MAX_ROWS && saved.every(r => r && typeof r.price === 'string' && typeof r.count === 'string') && plateTotals(saved)) this.rows = saved;
    } catch { this.storageOK = false; }
    this.render();
    this.root.hidden = false;
  }
  render() {
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const summary = el('summary','🍣 回転寿司のお皿計算');
    const help = el('p','お店の税込単価と枚数を入れると合計できます。サイドメニューも、単価ごとに追加できます。','help');
    const result = el('div',undefined,'plate-result');
    this.total = el('strong'); this.total.setAttribute('aria-live','polite');
    this.count = el('span'); result.append(this.count,this.total);
    const list = el('div',undefined,'plate-list');
    this.controls = this.rows.map((row,i) => {
      const box = el('div',undefined,'plate-row');
      const heading = el('div',undefined,'heading');
      const remove = el('button','削除','text danger'); remove.type = 'button'; remove.setAttribute('aria-label',`単価${i+1}の行を削除`);
      remove.onclick = () => { if (Number(row.count)>0 && !confirm('この行の枚数も削除しますか？')) return; this.rows.splice(i,1); if (!this.rows.length) this.rows.push(blank()); this.render(); this.save(); };
      heading.append(el('strong',`単価 ${i+1}`),remove);
      const inputs = el('div',undefined,'plate-inputs');
      const label = el('label','税込単価（円）');
      const price = el('input'); price.type='number'; price.min='0'; price.max=String(MAX_PRICE); price.step='1'; price.inputMode='numeric'; price.value=row.price; price.placeholder='例：150'; price.setAttribute('aria-label',`単価${i+1}の税込料金`); label.append(price);
      const counter = el('div',undefined,'plate-counter');
      const minus = el('button','−'); minus.type='button'; minus.setAttribute('aria-label',`単価${i+1}を1枚減らす`);
      const quantity = el('input'); quantity.type='number'; quantity.min='0'; quantity.max=String(MAX_COUNT); quantity.step='1'; quantity.inputMode='numeric'; quantity.value=row.count; quantity.setAttribute('aria-label',`単価${i+1}の枚数`);
      const plus = el('button','＋'); plus.type='button'; plus.setAttribute('aria-label',`単価${i+1}を1枚増やす`);
      counter.append(minus,quantity,plus);
      const qtyLabel=el('div'); qtyLabel.append(el('span','枚数'),counter); inputs.append(label,qtyLabel);
      const subtotal=el('p',undefined,'plate-subtotal');
      const change = () => {row.price=price.validity.badInput?'invalid':price.value; row.count=quantity.validity.badInput?'invalid':quantity.value; this.update(); this.save();};
      price.oninput=change; quantity.oninput=change;
      const step = delta => {if (!integer(row.count,MAX_COUNT)) return; const next=Number(row.count)+delta; if(next<0||next>MAX_COUNT)return; quantity.value=String(next); change();};
      minus.onclick=()=>step(-1); plus.onclick=()=>step(1);
      box.append(heading,inputs,subtotal); list.append(box);
      return {price,quantity,minus,plus,subtotal};
    });
    const actions=el('div',undefined,'plate-actions');
    const add=el('button','＋ 単価を追加'); add.type='button'; add.disabled=this.rows.length>=MAX_ROWS;
    add.onclick=()=>{this.rows.push(blank());this.render();this.save();this.controls.at(-1).price.focus();};
    const reset=el('button','枚数をすべて0にする','text'); reset.type='button';
    reset.onclick=()=>{if(!confirm('枚数をすべて0にしますか？ 単価は残ります。'))return;this.rows.forEach(r=>r.count='0');this.render();this.save();};
    actions.append(add,reset);
    this.message=el('p',undefined,'help'); this.message.setAttribute('role','status');
    this.root.replaceChildren(summary,help,result,list,actions,this.message);
    this.update();
  }
  update() {
    const result=plateTotals(this.rows);
    this.total.textContent=result?yen(result.total):'入力を確認してください';
    this.count.textContent=result?`合計 ${result.count.toLocaleString('ja-JP')}枚`:'合計を計算できません';
    this.rows.forEach((r,i)=>{
      const c=this.controls[i],priceOK=r.price===''||integer(r.price,MAX_PRICE),countOK=integer(r.count,MAX_COUNT);
      c.price.setAttribute('aria-invalid',String(!priceOK || r.price===''&&Number(r.count)>0));
      c.quantity.setAttribute('aria-invalid',String(!countOK));
      c.minus.disabled=!countOK||Number(r.count)===0; c.plus.disabled=!countOK||Number(r.count)>=MAX_COUNT;
      c.subtotal.textContent=priceOK&&countOK&&(r.price!==''||Number(r.count)===0)?'小計 '+yen(Number(r.price||0)*Number(r.count)):'単価・枚数を確認してください';
    });
    this.message.textContent=!result?'単価は0〜1,000,000円、枚数は0〜9,999の整数で入力してください。枚数のある行には単価が必要です。':this.storageOK?'この家庭の計算をこの端末に自動保存します。次の食事では枚数を0にしてください。':'この端末では保存できません。ページを閉じると計算は消えます。';
  }
  save() {
    if (!plateTotals(this.rows)) return;
    try {localStorage.setItem(this.key,JSON.stringify(this.rows));this.storageOK=true;} catch {this.storageOK=false;}
    this.update();
  }
}
