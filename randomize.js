const crypto=require('crypto');
function shuffle(values,randomInt=crypto.randomInt){const a=[...values];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function snapshot(questions,exam,randomInt=crypto.randomInt){
 let selected=questions.map(q=>({...q,options:[...q.options],accepted_answers:JSON.parse(JSON.stringify(q.accepted_answers||[]))}));
 if(exam.shuffle_questions||exam.sample_count>0)selected=shuffle(selected,randomInt);
 if(exam.sample_count>0)selected=selected.slice(0,exam.sample_count);
 if(exam.shuffle_options)selected=selected.map(q=>{if(q.question_type!=='multiple_choice')return q;const indices=shuffle(q.options.map((_,i)=>i),randomInt);return {...q,options:indices.map(i=>q.options[i]),correct_index:indices.indexOf(q.correct_index)};});
 return selected;
}
module.exports={shuffle,snapshot};
