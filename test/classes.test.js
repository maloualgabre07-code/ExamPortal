const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const bcrypt=require('bcryptjs');const {createApp}=require('../app');const {testPool}=require('./test-db');
test('Self-registration, class ownership, enrollment, assigned exam authorization and participation',async t=>{
 const pool=await testPool();await pool.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8'));
 const hash=await bcrypt.hash('TestPass123!',4);for(const [name,role]of [['Teacher','instructor'],['Other','instructor'],['Admin','admin']])await pool.query('INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4)',[name,name.toLowerCase()+'@test.com',hash,role]);
 const service=createApp(pool,'testing-secret-that-is-more-than-32-characters');const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));await pool.end();});const base=`http://127.0.0.1:${server.address().port}/api`;
 function client(){let cookie='',token='';return{async call(url,method='GET',body,omit=false){const r=await fetch(base+url,{method,headers:{Cookie:cookie,...(method==='GET'?{}:{'Content-Type':'application/json',...(!omit?{'X-CSRF-Token':token}:{})})},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();if(d.token)token=d.token;return{status:r.status,...d};},async login(email){await this.call('/csrf');const r=await this.call('/login','POST',{email,password:'TestPass123!'});assert.equal(r.status,200);return r.user;}};}
 const teacher=client(),other=client(),admin=client(),one=client(),two=client();await teacher.login('teacher@test.com');await other.login('other@test.com');await admin.login('admin@test.com');
 for(const [c,name]of [[one,'One'],[two,'Two']]){await c.call('/csrf');assert.equal((await c.call('/register','POST',{full_name:name,email:name.toLowerCase()+'@test.com',password:'TestPass123!',role:'student'})).status,201);}
 const s1=await one.login('one@test.com'),s2=await two.login('two@test.com');assert.equal(s1.role,'student');assert.equal((await one.call('/students')).status,403);assert.equal((await one.call('/classes','POST',{name:'Forbidden'})).status,403);
 const students=(await teacher.call('/students')).students;assert.equal(students.length,2);assert.equal(students[0].password_hash,undefined);assert.equal((await teacher.call('/students?search=one%40test.com')).students.length,1);
 assert.equal((await teacher.call('/classes','POST',{name:'Missing CSRF'},true)).status,403);
 const cl=(await teacher.call('/classes','POST',{name:'BSIT 4A',description:'Web development'})).class;const cr=`/classes/${cl.id}`;
 assert.equal((await teacher.call(cr,'PUT',{name:'BSIT 4A Updated',description:'Updated'})).status,200);
 assert.equal((await other.call(cr+'/students')).status,403);assert.equal((await other.call(cr+'/students','POST',{student_id:s1.id})).status,403);
 assert.equal((await teacher.call(cr+'/students','POST',{student_id:s1.id})).status,403);assert.equal((await one.call('/classes/join','POST',{code:cl.join_code})).status,201);assert.equal((await one.call('/classes/join','POST',{code:cl.join_code})).status,409);
 assert.equal((await one.call('/classes')).classes.length,1);assert.equal((await two.call('/classes')).classes.length,0);assert.equal((await one.call(cr+'/students')).status,403);
 const ex=(await teacher.call('/exams','POST',{title:'Assigned Exam',description:'Class-only',duration_minutes:30,passing_score:50,max_attempts:2})).exam,er=`/exams/${ex.id}`;
 const foreign=(await other.call('/classes','POST',{name:'Other class'})).class;
 assert.equal((await teacher.call(er+'/audience','PUT',{class_only:true,class_ids:[foreign.id]})).status,403);
 assert.equal((await teacher.call(er+'/audience','PUT',{class_only:true,class_ids:[]})).status,400);
 assert.equal((await teacher.call(er+'/audience','PUT',{class_only:true,class_ids:[cl.id]})).status,200);
 const copy=(await teacher.call(er+'/duplicate','POST')).exam;assert.equal(copy.class_only,true);assert.deepEqual((await teacher.call(`/exams/${copy.id}/audience`)).class_ids,[cl.id]);
 assert.equal((await teacher.call(er+'/questions','POST',{prompt:'HTML structures pages?',options:['True','False'],correct_index:0,points:1})).status,201);await teacher.call(er+'/status','POST',{status:'published'});
 assert.equal((await teacher.call(er+'/audience','PUT',{class_only:false,class_ids:[]})).status,400);
 assert.equal((await teacher.call(cr,'DELETE')).status,409);
 assert.equal((await one.call('/exams')).exams.length,1);assert.equal((await two.call('/exams')).exams.length,0);assert.equal((await two.call(er+'/start','POST')).status,403);
 assert.equal((await other.call(er+'/participation')).status,403);assert.equal((await one.call(er+'/participation')).status,403);
 const a=(await one.call(er+'/start','POST')).attempt;assert.ok(a);let report=(await teacher.call(er+'/participation')).students;assert.equal(report.length,1);assert.equal(report[0].in_progress,1);
 await teacher.call(cr+'/students/'+s1.id,'DELETE');assert.equal((await one.call('/exams')).exams.length,0);assert.equal((await one.call(er+'/start','POST')).status,403);
 assert.equal((await one.call(`/attempts/${a.id}/submit`,'POST',{answers:{[a.questions[0].id]:0}})).status,403);
 await one.call('/classes/join','POST',{code:cl.join_code});
 assert.equal((await one.call(`/attempts/${a.id}/submit`,'POST',{answers:{[a.questions[0].id]:0}})).attempt.score,1);
 await two.call('/classes/join','POST',{code:cl.join_code});report=(await teacher.call(er+'/participation')).students;assert.equal(report.length,2);assert.equal(report.find(s=>s.id===s1.id).completed,1);assert.equal(report.find(s=>s.id===s1.id).best_percentage,100);assert.equal(report.find(s=>s.id===s2.id).attempts,0);
 assert.equal((await admin.call(cr+'/students')).status,200);assert.equal((await teacher.call('/classes')).classes.length,1);assert.equal((await other.call('/classes')).classes.length,1);
 const removable=(await teacher.call('/classes','POST',{name:'Remove me'})).class;await teacher.call(`/classes/${removable.id}/students`,'POST',{student_id:s1.id});assert.equal((await teacher.call(`/classes/${removable.id}`,'DELETE')).status,200);assert.equal((await teacher.call('/students')).students.length,2);
 await pool.exec(fs.readFileSync(path.join(__dirname,'../migrations/004-classes.sql'),'utf8'));assert.equal((await teacher.call(cr+'/students')).students.length,2);assert.equal((await one.call('/results')).results[0].score,1);
});
