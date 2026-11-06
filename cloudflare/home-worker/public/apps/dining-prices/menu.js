import {stores,dishKey,uniqueDishes} from './menu-data.js';

const categories=['焼肉','ホルモン','海鮮','野菜','一品料理','揚げ物','ご飯','麺','スープ','デザート'];
const sides=[{label:'左',store:0,course:0},{label:'右',store:1,course:2}];
const byId=id=>document.getElementById(id);
function el(tag,text,className){
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(className)node.className=className;
 return node;
}
function card(title){
 const box=el('div',undefined,'panel');
 box.append(el('h3',title));
 return box;
}
function picker(label,options,value){
 const field=el('label',label),select=el('select');
 select.setAttribute('aria-label',label);
 fillOptions(select,options,value);
 field.append(select);
 return {field,select};
}
function fillOptions(select,options,value){
 select.replaceChildren(...options.map(({name},index)=>new Option(name,String(index))));
 select.value=String(value);
}
for(const side of sides){
 const box=card(side.label+'のコース');
 const store=picker(side.label+'の店舗',stores,side.store);
 const course=picker(side.label+'のコース',stores[side.store].courses,side.course);
 store.select.onchange=()=>{
  side.store=Number(store.select.value);
  side.course=0;
  fillOptions(course.select,stores[side.store].courses,0);
  render();
 };
 course.select.onchange=()=>{side.course=Number(course.select.value);render();};
 box.append(store.field,course.field);
 byId('controls').append(box);
}
function selection(side){
 const store=stores[side.store],course=store.courses[side.course];
 const dishes=uniqueDishes(course.dishes);
 return {...side,store,course,dishes,keys:new Set(dishes.map(item=>dishKey(item.name)))};
}
function overview(item){
 const {label,store,course,dishes}=item;
 const box=card(label+'｜'+course.name);
 box.append(el('p',store.name),el('strong',course.summary||'確認できた注文品 '+dishes.length+'品'));
 if(course.note)box.append(el('p',course.note));
 const link=el('a',store.edition+'の公式PDF');
 link.href=store.url;
 const source=el('p');
 source.append(link);
 box.append(source);
 return box;
}
function barCard({label,store}){
 const box=card(label+'｜'+store.name);
 box.append(el('p',store.bars),el('strong','ゼリー '+store.jelly));
 return box;
}
function categoryColumn(item,other,category){
 const dishes=item.dishes.filter(dish=>dish.category===category);
 const column=el('div');
 if(item.course.summary){
  column.append(el('h3',item.label),el('p','—'));
  return column;
 }
 column.append(el('h3',item.label+'｜'+dishes.length+'品'));
 const list=el('ul');
 for(const {name} of dishes){
  const row=el('li',name);
  if(!other.course.summary&&!other.keys.has(dishKey(name))){
   row.className='exclusive';
   row.append(el('small',item.label+'の掲載のみ'));
  }
  list.append(row);
 }
 column.append(list);
 return column;
}
function render(){
 const [left,right]=sides.map(selection);
 byId('totals').replaceChildren(overview(left),overview(right));
 byId('bars').replaceChildren(barCard(left),barCard(right));
 const visible=new Set([...left.dishes,...right.dishes].map(item=>item.category));
 byId('categories').replaceChildren(...categories.filter(category=>visible.has(category)).map(category=>{
  const section=el('section',undefined,'panel');
  const pair=el('div',undefined,'menu-pair');
  pair.append(categoryColumn(left,right,category),categoryColumn(right,left,category));
  section.append(el('h2',category),pair);
  return section;
 }));
}
render();
