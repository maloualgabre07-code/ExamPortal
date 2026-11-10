const TYPES=['multiple_choice','true_false','identification','enumeration'];
const normalize=v=>String(v).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const typeOf=q=>q.question_type||(q.options?.length===2?'true_false':'multiple_choice');
function invalid(message){const e=Error(message);e.status=400;throw e;}
function validate(b){
 const type=typeOf(b),prompt=typeof b.prompt==='string'?b.prompt.trim():'';
 if(!TYPES.includes(type))invalid('Choose a supported question type.');
 if(!prompt||prompt.length>2000)invalid('Question must contain 1–2000 characters.');
 if(!Number.isInteger(b.points)||b.points<1||b.points>100)invalid('Points must be a whole number from 1 to 100.');
 let options=[],correct=null,key=[];
 if(type==='multiple_choice'||type==='true_false'){
  const count=type==='true_false'?2:4;
  if(!Array.isArray(b.options)||b.options.length!==count)invalid(`Provide ${count} answer options.`);
  options=b.options.map(x=>{if(typeof x!=='string'||!x.trim()||x.trim().length>500)invalid('Options must contain 1–500 characters.');return x.trim();});
  if(new Set(options.map(normalize)).size!==count)invalid('Answer options must be different.');
  if(!Number.isInteger(b.correct_index)||b.correct_index<0||b.correct_index>=count)invalid('Choose a correct answer.');correct=b.correct_index;
 }else{
  key=b.accepted_answers;
  if(!Array.isArray(key)||key.length<1||key.length>(type==='identification'?1:20))invalid('Identification requires one answer group; enumeration requires 1–20 groups.');
  const seen=new Set();key=key.map(group=>{
   if(!Array.isArray(group)||!group.length||group.length>10)invalid('Each answer group requires 1–10 accepted spellings.');
   return group.map(x=>{if(typeof x!=='string'||!x.trim()||x.trim().length>500)invalid('Accepted answers must contain 1–500 characters.');const norm=normalize(x);if(seen.has(norm))invalid('Accepted answers must be distinct across all groups.');seen.add(norm);return x.trim();});
  });
 }
 return [prompt,JSON.stringify(options),correct,b.points,type,JSON.stringify(key)];
}
function answerValue(q,v){
 const type=typeOf(q);
 if(type==='multiple_choice'||type==='true_false'){if(!Number.isInteger(v)||v<0||v>=q.options.length)invalid('Choose a valid answer.');return v;}
 if(type==='identification'){if(typeof v!=='string'||v.length>500)invalid('Identification answers must be text of at most 500 characters.');return v;}
 if(!Array.isArray(v)||v.length!==q.accepted_answers.length||v.some(x=>typeof x!=='string'||x.length>500))invalid('Enter one text answer per enumeration field (at most 500 characters).');return v;
}
function earned(q,v){
 const type=typeOf(q);
 if(type==='multiple_choice'||type==='true_false')return v===q.correct_index?q.points:0;
 if(type==='identification')return typeof v==='string'&&q.accepted_answers[0].some(a=>normalize(a)===normalize(v))?q.points:0;
 if(!Array.isArray(v)||v.length!==q.accepted_answers.length||v.some(x=>!normalize(x))||new Set(v.map(normalize)).size!==v.length)return 0;
 const used=new Set();for(const value of v){const i=q.accepted_answers.findIndex((g,i)=>!used.has(i)&&g.some(a=>normalize(a)===normalize(value)));if(i<0)return 0;used.add(i);}return q.points;
}
function safeQuestion(q,complete,answers){
 if(complete)return {...q,question_type:typeOf(q),earned_points:earned(q,answers[String(q.id)])};
 return {id:q.id,prompt:q.prompt,options:q.options,points:q.points,question_type:typeOf(q),item_count:typeOf(q)==='enumeration'?q.accepted_answers.length:undefined};
}
module.exports={TYPES,normalize,typeOf,validate,answerValue,earned,safeQuestion};
