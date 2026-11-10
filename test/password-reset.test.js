const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const bcrypt=require('bcryptjs');const {createApp}=require('../app');const {testPool}=require('./test-db');
test('Email reset codes expire, lock out guesses, rotate, revoke sessions and work once',async t=>{
 const pool=await testPool();await pool.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8'));
 const hash=await bcrypt.hash('OriginalPass123!',4);for(const role of ['student','instructor'])await pool.query('INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4)',[role,role+'@example.com',hash,role]);
 const mail=[];let deliveryFails=false;const service=createApp(pool,'a-password-reset-test-secret-longer-than-32',{}, {sendMail:async m=>{if(deliveryFails)throw Error('SMTP private credentials must not be logged');mail.push(m);}});
 const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));await pool.end();});const base=`http://127.0.0.1:${server.address().port}/api`;
 function client(){let cookie='',token='';return{async call(url,method='GET',body,omit=false){const r=await fetch(base+url,{method,headers:{Cookie:cookie,...(method==='GET'?{}:{'Content-Type':'application/json',...(!omit?{'X-CSRF-Token':token}:{})})},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();if(d.token)token=d.token;return{status:r.status,...d};}};}
 const c=client(),oldSession=client();await c.call('/csrf');await oldSession.call('/csrf');await oldSession.call('/login','POST',{email:'student@example.com',password:'OriginalPass123!'});
 const email='student@example.com';
 assert.equal((await c.call('/password/forgot','POST',{email},true)).status,403);
 const requested=await c.call('/password/forgot','POST',{email});assert.equal(requested.status,200);assert.equal(requested.code,undefined);assert.equal(mail.length,1);
 assert.equal(mail[0].to,email);const code=()=>mail.at(-1).text.match(/code is: (\d{6})/)[1];
 let pin=code();const row=(await pool.query('SELECT * FROM password_reset_codes')).rows[0];assert.notEqual(row.code_hash,pin);assert.equal(row.code_hash.length,64);
 const unknown=await c.call('/password/forgot','POST',{email:'unknown@example.com'});assert.equal(unknown.message,requested.message);assert.equal(mail.length,1);
 await c.call('/password/forgot','POST',{email});assert.equal(mail.length,1);
 const payload=(p=pin)=>({email,code:p,new_password:'ReplacementPass123!',confirm_password:'ReplacementPass123!'});
 const wrong=pin==='000000'?'000001':'000000';for(let n=0;n<5;n++)assert.equal((await c.call('/password/reset','POST',payload(wrong))).status,400);
 assert.equal((await pool.query('SELECT attempts FROM password_reset_codes')).rows[0].attempts,5);
 assert.equal((await c.call('/password/reset','POST',payload())).status,400);
 await pool.query("UPDATE password_reset_codes SET sent_at=CURRENT_TIMESTAMP-INTERVAL '61 seconds'");await c.call('/password/forgot','POST',{email});assert.equal(mail.length,2);pin=code();
 await pool.query("UPDATE password_reset_codes SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second'");assert.equal((await c.call('/password/reset','POST',payload())).status,400);
 await pool.query("UPDATE password_reset_codes SET sent_at=CURRENT_TIMESTAMP-INTERVAL '61 seconds'");await c.call('/password/forgot','POST',{email});assert.equal(mail.length,3);pin=code();
 assert.equal((await c.call('/password/reset','POST',{...payload(),confirm_password:'different'})).status,400);
 assert.equal((await c.call('/password/reset','POST',payload())).status,200);
 assert.equal((await c.call('/password/reset','POST',payload())).status,400);
 assert.equal((await oldSession.call('/me')).status,401);
 assert.equal((await c.call('/login','POST',{email,password:'OriginalPass123!'})).status,401);
 assert.equal((await c.call('/login','POST',{email,password:'ReplacementPass123!'})).status,200);
 await pool.query("UPDATE password_reset_codes SET sent_at=CURRENT_TIMESTAMP-INTERVAL '61 seconds'");await c.call('/password/forgot','POST',{email});assert.equal(mail.length,3); // three per hour
 deliveryFails=true;const failed=await c.call('/password/forgot','POST',{email:'instructor@example.com'});assert.equal(failed.message,requested.message);
 const expired=(await pool.query('SELECT r.expires_at FROM password_reset_codes r JOIN users u ON u.id=r.user_id WHERE u.email=$1',['instructor@example.com'])).rows[0];assert.ok(new Date(expired.expires_at)<=new Date());
 await pool.exec(fs.readFileSync(path.join(__dirname,'../migrations/008-password-reset.sql'),'utf8'));assert.equal((await c.call('/me')).status,200);
});
