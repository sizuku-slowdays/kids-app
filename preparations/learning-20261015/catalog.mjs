// Original introductory material. No third-party recordings or copied dictionary content.
export const catalogVersion='draft-original-20261015-1';
export const catalog=[
 ...Array.from({length:26},(_,i)=>{const upper=String.fromCharCode(65+i);return {id:'letter-'+upper,level:'alphabet',display:upper+' '+upper.toLowerCase(),speech:upper,meaning:'アルファベットの '+upper};}),
 ...[['apple','りんご'],['cat','ねこ'],['dog','いぬ'],['book','ほん'],['sun','たいよう'],['moon','つき'],['red','あか'],['blue','あお'],['green','みどり'],['yellow','きいろ'],['one','いち'],['two','に'],['three','さん'],['four','よん'],['five','ご'],['six','ろく'],['seven','なな'],['eight','はち'],['nine','きゅう'],['ten','じゅう'],['bird','とり'],['fish','さかな'],['milk','ぎゅうにゅう'],['water','みず'],['school','がっこう'],['pen','ペン'],['desk','つくえ'],['chair','いす'],['happy','うれしい'],['hello','こんにちは']].map(([word,meaning])=>({id:'word-'+word,level:'words',display:word,speech:word,meaning}))
];
