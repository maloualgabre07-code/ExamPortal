const {test}=require('node:test');
const assert=require('node:assert/strict');
const {attachAI}=require('../ai');
function makeHarness(){
 const routes=new Map();let calls=0;
 const app={post:(path,...handlers)=>routes.set(path,handlers.at(-1))};
 const types=['multiple_choice','true_false','identification','enumeration'];
 const fakeFetch=async (_url,init)=>{
  calls++;
  const {input}=JSON.parse(init.body);const {count,distribution}=JSON.parse(input);
  const qs=[];for(const type of types)for(let i=0;i<distribution[type];i++){
   const idx=qs.length;
   qs.push({question_type:type,prompt:`Batch ${calls} ${type} ${i} ${idx}`,options:type==='multiple_choice'?['A','B','C','D']:type==='true_false'?['True','False']:[],correct_index:0,points:1,accepted_answers:type==='identification'?[['valid']]:type==='enumeration'?[['one'],['two']]:[]});
  }
  assert.equal(qs.length,count);
  return {ok:true,json:async()=>({output_text:JSON.stringify({questions:qs})})};
 };
 const questionInput=q=>[q.prompt,JSON.stringify(q.options),q.correct_index,q.points,q.question_type,JSON.stringify(q.accepted_answers)];
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
 attachAI(app,{pool:{},auth:()=>{},roles:()=>{},ownExam:async()=>({}),editable:()=>{},id:Number,text:(s)=>s,integer:(v,min,max)=>{if(!Number.isInteger(v)||v<min||v>max)fail(400,'Invalid count');return v;},questionInput,fail},{key:'test-key',fetch:fakeFetch});
 return {route:routes.get('/api/exams/:id/ai/generate'),getCalls:()=>calls};
}
for(const count of [1,25,26,60,150])test(`AI generates ${count} questions in batches`,async()=>{
 const h=makeHarness();const req={params:{id:'1'},user:{id:11},body:{topic:'Web development',lesson:'',count,difficulty:'medium',question_type:'multiple_choice'}};
 let payload;await h.route(req,{json:o=>payload=o});
 assert.equal(payload.questions.length,count);assert.equal(h.getCalls(),Math.ceil(count/25));
});
test('mixed distribution works across batch boundaries',async()=>{
 const h=makeHarness();let payload;await h.route({params:{id:'1'},user:{id:12},body:{topic:'Web',count:150,difficulty:'hard',question_type:'mixed'}},{json:o=>payload=o});
 assert.equal(payload.questions.length,150);
 assert.equal(h.getCalls(),6);
 const totals={};for(const q of payload.questions)totals[q.question_type]=(totals[q.question_type]||0)+1;
 assert.deepEqual(totals,{multiple_choice:38,true_false:38,identification:37,enumeration:37});
});
