const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bcrypt=require('bcryptjs');
const {configHash}=require('../seb-security');
const {testPool}=require('./test-db');

const implementations=[
 {name:'workspace-root app',createApp:require('../app').createApp,schema:'../schema.sql'},
 {name:'live inner app',createApp:require('../ExamPortal/app').createApp,schema:'../ExamPortal/schema.sql'}
];
const configKey='a'.repeat(64);

for(const implementation of implementations)test(`${implementation.name} enforces SEB on student attempts`,async t=>{
 const previous=Object.fromEntries(['SEB_REQUIRED','SEB_CONFIG_KEY','SEB_BASE_URL'].map(name=>[name,process.env[name]]));
 let pool,service,server;
 t.after(async()=>{
  if(service)service.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  if(pool)await pool.end();
  for(const[name,value]of Object.entries(previous)){
   if(value===undefined)delete process.env[name];
   else process.env[name]=value;
  }
 });
 process.env.SEB_REQUIRED='true';
 process.env.SEB_CONFIG_KEY=configKey;
 delete process.env.SEB_BASE_URL;
 pool=await testPool();
 await pool.exec(fs.readFileSync(path.join(__dirname,implementation.schema),'utf8'));
 const passwordHash=await bcrypt.hash('TestPass123!',4);
 for(const[name,email,role]of [
  ['Teacher','teacher@example.test','instructor'],
  ['Student','student@example.test','student'],
  ['Administrator','admin@example.test','admin']
 ])await pool.query('INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4)',[name,email,passwordHash,role]);
 service=implementation.createApp(pool,'testing-secret-that-is-more-than-32-characters');
 server=service.app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const apiBase=origin+'/api';
 process.env.SEB_BASE_URL=origin;

 function client(useSeb=false){
  let cookie='',csrf='';
  return{
   async call(route,method='GET',body){
    const headers={Cookie:cookie};
    if(method!=='GET'){
     headers['Content-Type']='application/json';
     headers['X-CSRF-Token']=csrf;
    }
    if(useSeb)headers['X-SafeExamBrowser-ConfigKeyHash']=configHash(origin+'/api'+route,configKey);
    const response=await fetch(apiBase+route,{method,headers,...(method==='GET'?{}:{body:JSON.stringify(body??{})})});
    const setCookie=response.headers.get('set-cookie');
    if(setCookie)cookie=setCookie.split(';')[0];
    const data=await response.json();
    if(data.token)csrf=data.token;
    return{status:response.status,...data};
   },
   async login(email){
    await this.call('/csrf');
    const result=await this.call('/login','POST',{email,password:'TestPass123!'});
    assert.equal(result.status,200);
    return result;
   }
  };
 }

 const teacher=client(),chrome=client(),seb=client(true),admin=client();
 await teacher.login('teacher@example.test');
 await chrome.login('student@example.test');
 await seb.login('student@example.test');
 await admin.login('admin@example.test');

 const classResult=await teacher.call('/classes','POST',{name:'SEB Test Class'});
 assert.equal(classResult.status,201);
 assert.equal((await chrome.call('/classes/join','POST',{code:classResult.class.join_code})).status,201);
 const examResult=await teacher.call('/exams','POST',{
  title:'Protected Exam',description:'Regression test',duration_minutes:20,passing_score:50,max_attempts:1
 });
 assert.equal(examResult.status,201);
 const examId=examResult.exam.id;
 assert.equal((await teacher.call(`/exams/${examId}/audience`,'PUT',{class_only:true,class_ids:[classResult.class.id]})).status,200);
 assert.equal((await teacher.call(`/exams/${examId}/questions`,'POST',{
  prompt:'Pick the correct answer.',options:['Correct','Incorrect'],correct_index:0,points:1
 })).status,201);
 assert.equal((await teacher.call(`/exams/${examId}/status`,'POST',{status:'published'})).status,200);

 assert.equal((await chrome.call('/me')).status,200);
 assert.equal((await chrome.call('/classes')).classes.length,1);
 const listing=await chrome.call('/exams');
 assert.equal(listing.status,200);
 assert.equal(listing.exams.length,1);
 assert.equal((await chrome.call('/results')).status,200);
 const blockedStart=await chrome.call(`/exams/${examId}/start`,'POST');
 assert.equal(blockedStart.status,403);
 assert.match(blockedStart.message,/Safe Exam Browser Required/);

 const started=await seb.call(`/exams/${examId}/start`,'POST');
 assert.equal(started.status,200,started.message);
 const attemptId=started.attempt.id;
 const questionId=started.attempt.questions[0].id;
 assert.equal(started.attempt.questions[0].correct_index,undefined);

 const updatedListing=await chrome.call('/exams');
 assert.equal(updatedListing.exams[0].active_attempt_id,attemptId);
 assert.equal((await teacher.call(`/exams/${examId}/questions`)).questions[0].correct_index,0);
 assert.equal((await teacher.call(`/attempts/${attemptId}`)).attempt.questions[0].prompt,'Pick the correct answer.');
 assert.equal((await admin.call('/users')).status,200);

 for(const [route,method,body]of [
  [`/attempts/${attemptId}`,'GET'],
  [`/attempts/${attemptId}/answers`,'PUT',{answers:{[questionId]:0}}],
  [`/attempts/${attemptId}/submit`,'POST',{answers:{[questionId]:0}}]
 ]){
  const denied=await chrome.call(route,method,body);
  assert.equal(denied.status,403,`${method} ${route} should be blocked`);
  assert.match(denied.message,/Safe Exam Browser Required/);
 }
 const unanswered=await seb.call(`/attempts/${attemptId}`);
 assert.equal(unanswered.status,200);
 assert.deepEqual(unanswered.attempt.answers,{});
 assert.equal(unanswered.attempt.questions[0].correct_index,undefined);

 const saved=await seb.call(`/attempts/${attemptId}/answers`,'PUT',{answers:{[questionId]:0}});
 assert.equal(saved.status,200);
 assert.equal(saved.attempt.answers[questionId],0);
 const submitted=await seb.call(`/attempts/${attemptId}/submit`,'POST',{answers:{[questionId]:0}});
 assert.equal(submitted.status,200);
 assert.equal(submitted.attempt.score,1);
 assert.equal(submitted.attempt.questions[0].correct_index,0);
 assert.equal((await chrome.call(`/attempts/${attemptId}`)).status,403);
 assert.equal((await chrome.call('/results')).status,200);
 assert.equal((await teacher.call(`/exams/${examId}/participation`)).status,200);
 assert.equal((await admin.call(`/attempts/${attemptId}`)).status,200);
});
