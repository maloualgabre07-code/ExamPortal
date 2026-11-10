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
for(const count of [1,25,26,60,100])test(`AI generates ${count} questions in batches`,async()=>{
 const h=makeHarness();const req={params:{id:'1'},user:{id:11},body:{topic:'Web development',lesson:'',count,difficulty:'medium',question_type:'multiple_choice'}};
 let payload;await h.route(req,{json:o=>payload=o});
 assert.equal(payload.questions.length,count);assert.equal(h.getCalls(),Math.ceil(count/10));
});
test('mixed distribution works across batch boundaries',async()=>{
 const h=makeHarness();let payload;await h.route({params:{id:'1'},user:{id:12},body:{topic:'Web',count:100,difficulty:'hard',question_type:'mixed'}},{json:o=>payload=o});
 assert.equal(payload.questions.length,100);
 assert.equal(h.getCalls(),10);
 const totals={};for(const q of payload.questions)totals[q.question_type]=(totals[q.question_type]||0)+1;
 assert.deepEqual(totals,{multiple_choice:25,true_false:25,identification:25,enumeration:25});
});

test('AI generation rejects more than 100 questions',async()=>{
 const h=makeHarness();
 const req={params:{id:'1'},user:{id:13},body:{topic:'Web development',lesson:'',count:101,difficulty:'medium',question_type:'multiple_choice'}};
 await assert.rejects(()=>h.route(req,{json:()=>{}}),e=>e.status===400);
 assert.equal(h.getCalls(),0);
});

test('AI retries an invalid batch and accepts a valid retry',async()=>{
 const routes=new Map();let calls=0;const app={post:(path,...handlers)=>routes.set(path,handlers.at(-1))};
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
 const questionInput=q=>[q.prompt,JSON.stringify(q.options),q.correct_index,q.points,q.question_type,JSON.stringify(q.accepted_answers)];
 const valid={question_type:'multiple_choice',prompt:'What does HTML define?',options:['Page structure','Database schema','Network routing','Image compression'],correct_index:0,points:1,accepted_answers:[]};
 const fetch=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({questions:++calls===1?[]:[valid]})})});
 attachAI(app,{pool:{},auth:()=>{},roles:()=>{},ownExam:async()=>({}),editable:()=>{},id:Number,text:s=>s,integer:(v,min,max)=>{if(!Number.isInteger(v)||v<min||v>max)fail(400,'Invalid count');return v;},questionInput,fail},{key:'test-key',fetch});
 let payload;await routes.get('/api/exams/:id/ai/generate')({params:{id:'1'},user:{id:14},body:{topic:'HTML',count:1,difficulty:'medium',question_type:'multiple_choice'}},{json:o=>payload=o});
 assert.equal(calls,2);assert.equal(payload.questions.length,1);assert.equal(payload.questions[0].prompt,valid.prompt);
});
