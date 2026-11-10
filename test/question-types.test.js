const {assignTestClass}=require('./assessment-class-fixture');
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const bcrypt=require('bcryptjs');const qt=require('../question-types');const {createApp}=require('../app');const {testPool}=require('./test-db');
const identification={question_type:'identification',prompt:'What language structures web pages?',options:[],accepted_answers:[['HTML','Hypertext Markup Language']],points:2};
const enumeration={question_type:'enumeration',prompt:'List three web languages.',options:[],accepted_answers:[['HTML'],['CSS','Cascading Style Sheets'],['JavaScript','JS']],points:3};
test('Deterministic text grading, aliases, order and duplicate rejection',()=>{
 assert.equal(qt.earned(identification,'  html  '),2);assert.equal(qt.earned(identification,'hypertext   markup language'),2);assert.equal(qt.earned(identification,'HTM'),0);
 assert.equal(qt.earned(enumeration,['js','html','cascading style sheets']),3);assert.equal(qt.earned(enumeration,['HTML','HTML','JS']),0);assert.equal(qt.earned(enumeration,['HTML','','JS']),0);assert.equal(qt.earned(enumeration,['HTML','CSS']),0);
 assert.throws(()=>qt.validate({...enumeration,accepted_answers:[['HTML'],['html']]}));assert.throws(()=>qt.answerValue(identification,1));assert.throws(()=>qt.answerValue(enumeration,['HTML']));
});
test('Mixed exam generation, save, edit, duplicate, resume and submit',async t=>{
 const pool=await testPool();const schema=fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8');await pool.exec(schema);
 const hash=await bcrypt.hash('TestPass123!',4);for(const role of ['instructor','student'])await pool.query('INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4)',[role,role+'@test.com',hash,role]);
 const mixed=[{question_type:'multiple_choice',prompt:'2 + 2?',options:['4','3','5','6'],correct_index:0,accepted_answers:[],points:1},{question_type:'true_false',prompt:'HTML structures pages.',options:['True','False'],correct_index:0,accepted_answers:[],points:1},identification,enumeration];
 const service=createApp(pool,'test-secret-longer-than-thirty-two-characters',{key:'test-fake',fetch:async(_,opts)=>{const request=JSON.parse(opts.body);assert.deepEqual(JSON.parse(request.input).distribution,{multiple_choice:1,true_false:1,identification:1,enumeration:1});return {ok:true,json:async()=>({steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({questions:mixed})}]}]})};}});
 const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));await pool.end();});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 function client(){let cookie='',token='';return async(url,method='GET',body)=>{await assignTestClass(pool,url,method,body);const r=await fetch(base+url,{method,headers:{Cookie:cookie,...(method==='GET'?{}:{'Content-Type':'application/json','X-CSRF-Token':token})},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();if(d.token)token=d.token;return{status:r.status,...d};};}
 const teacher=client(),student=client();for(const [c,role]of [[teacher,'instructor'],[student,'student']]){await c('/csrf');assert.equal((await c('/login','POST',{email:role+'@test.com',password:'TestPass123!'})).status,200);}
 const e=(await teacher('/exams','POST',{title:'Mixed types',description:'Test',duration_minutes:30,passing_score:50,max_attempts:1})).exam;const route=`/exams/${e.id}`;
 assert.equal((await teacher(route+'/ai/generate','POST',{topic:'Web development',count:3,difficulty:'easy',question_type:'mixed'})).status,400);
 const generated=await teacher(route+'/ai/generate','POST',{topic:'Web development',count:4,difficulty:'easy',question_type:'mixed'});assert.equal(generated.status,200);assert.equal(generated.questions[2].question_type,'identification');
 assert.equal((await teacher(route+'/questions/bulk','POST',{questions:generated.questions})).status,201);
 let qs=(await teacher(route+'/questions')).questions;assert.equal(qs.length,4);assert.equal(qs[2].correct_index,null);
 assert.equal((await teacher(route+'/questions/'+qs[2].id,'PUT',{...identification,prompt:'Name the page structure language.'})).status,200);
 const copy=(await teacher(route+'/duplicate','POST')).exam;const cq=(await teacher(`/exams/${copy.id}/questions`)).questions;assert.deepEqual(cq.map(q=>q.question_type),mixed.map(q=>q.question_type));assert.deepEqual(cq[3].accepted_answers,enumeration.accepted_answers);
 await teacher(route+'/status','POST',{status:'published'});
 const a=(await student(route+'/start','POST')).attempt;assert.equal(a.questions[2].accepted_answers,undefined);assert.equal(a.questions[2].correct_index,undefined);assert.equal(a.questions[3].item_count,3);
 const answers={[qs[0].id]:0,[qs[1].id]:0,[qs[2].id]:'hypertext  markup LANGUAGE',[qs[3].id]:['JS','HTML','CSS']};
 assert.equal((await student(`/attempts/${a.id}/answers`,'PUT',{answers:{[qs[3].id]:['HTML']}})).status,400);
 assert.equal((await student(`/attempts/${a.id}/answers`,'PUT',{answers})).status,200);const resume=(await student(route+'/start','POST')).attempt;assert.deepEqual(resume.answers,answers);
 const done=(await student(`/attempts/${a.id}/submit`,'POST',{answers})).attempt;assert.equal(done.score,7);assert.equal(done.total_points,7);assert.deepEqual(done.questions.map(q=>q.earned_points),[1,1,2,3]);assert.deepEqual(done.questions[3].accepted_answers,enumeration.accepted_answers);
 // Idempotent migration leaves typed questions and historical snapshots intact.
 await pool.exec(schema);assert.equal((await teacher(route+'/questions')).questions[2].question_type,'identification');assert.equal((await student(`/attempts/${a.id}`)).attempt.score,7);
});
test('Upgrade from the original delivered schema preserves choice questions and snapshots',async t=>{
 const pool=await testPool();t.after(()=>pool.end());await pool.exec(fs.readFileSync(path.join(__dirname,'legacy-schema.sql'),'utf8'));
 await pool.query("INSERT INTO users(full_name,email,password_hash,role) VALUES('Teacher','old@test.com','unused','instructor')");await pool.query("INSERT INTO exams(instructor_id,title) VALUES(1,'Existing exam')");
 await pool.query("INSERT INTO exam_questions(exam_id,prompt,options,correct_index,points,position) VALUES(1,'Existing question',$1,0,1,1)",[JSON.stringify(['True','False'])]);
 const before=(await pool.query('SELECT * FROM exam_questions')).rows[0];await pool.exec(fs.readFileSync(path.join(__dirname,'../migrations/003-question-types.sql'),'utf8'));const after=(await pool.query('SELECT * FROM exam_questions')).rows[0];assert.equal(after.id,before.id);assert.deepEqual(after.options,before.options);assert.equal(after.correct_index,0);assert.equal(after.question_type,'true_false');assert.equal(qt.earned(before,0),1);
 const v=qt.validate(identification);await pool.query('INSERT INTO exam_questions(exam_id,prompt,options,correct_index,points,question_type,accepted_answers,position) VALUES(1,$1,$2,$3,$4,$5,$6,2)',v);assert.equal((await pool.query('SELECT count(*)::int AS n FROM exam_questions')).rows[0].n,2);
});
