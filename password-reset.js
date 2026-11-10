const crypto=require('crypto');
const bcrypt=require('bcryptjs');
const nodemailer=require('nodemailer');
const MESSAGE='If an active account matches that email, a reset code will be sent. Check your inbox and spam folder. You can request another code after 60 seconds.';
function attachPasswordReset(app,{pool,transaction,limit,fail,secret},config={}){
 const gmail=config.gmail??process.env.GMAIL_USER??'';
 const appPassword=(config.appPassword??process.env.GMAIL_APP_PASSWORD??'').replace(/\s/g,'');
 const configured=!!config.sendMail||(/^[^\s@]+@gmail\.com$/i.test(gmail)&&appPassword.length===16);
 const transport=config.sendMail?null:configured?nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:gmail,pass:appPassword},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,logger:false,debug:false}):null;
 const send=config.sendMail||((mail)=>transport.sendMail(mail));
 const emailInput=b=>{const email=typeof b?.email==='string'?b.email.trim().toLowerCase():'';if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter the email address used for your account.');return email;};
 const digest=(uid,nonce,code)=>crypto.createHmac('sha256',secret).update(`${uid}:${nonce}:${code}`).digest('hex');
 app.post('/api/password/forgot',limit,async(req,res)=>{
  const email=emailInput(req.body);if(!configured)fail(503,'Password reset email is not configured. Contact your administrator.');
  const issue=await transaction(async db=>{
   const user=(await db.query('SELECT id,active FROM users WHERE email=$1 FOR UPDATE',[email])).rows[0];
   if(!user?.active)return null;
   const now=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now;
   const old=(await db.query('SELECT * FROM password_reset_codes WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];
   if(old&&now-new Date(old.sent_at)<60000)return null;
   const sameHour=old&&now-new Date(old.window_start)<3600000;
   if(sameHour&&old.sent_count>=3)return null;
   const code=String(crypto.randomInt(0,1000000)).padStart(6,'0'),nonce=crypto.randomBytes(16).toString('hex');
   await db.query(`INSERT INTO password_reset_codes(user_id,code_hash,nonce,expires_at,attempts,sent_at,window_start,sent_count)
    VALUES($1,$2,$3,$4,0,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,nonce=EXCLUDED.nonce,expires_at=EXCLUDED.expires_at,attempts=0,sent_at=EXCLUDED.sent_at,window_start=EXCLUDED.window_start,sent_count=EXCLUDED.sent_count`,
    [user.id,digest(user.id,nonce,code),nonce,new Date(now.getTime()+600000),now,sameHour?old.window_start:now,sameHour?old.sent_count+1:1]);
   return{userId:user.id,code,nonce};
  });
  if(issue){try{await send({from:{name:'ExamPortal',address:gmail||'test@example.invalid'},to:email,subject:'Your ExamPortal password reset code',text:`Your ExamPortal password reset code is: ${issue.code}\n\nThis code expires in 10 minutes and works only once. A new code replaces the previous one.\nIf you did not request this, ignore this email. Never share this code.\nThis resets your ExamPortal password, not your Google password.`});}catch{
   // Keep resend limits after delivery failure, but invalidate the unusable code.
   await pool.query('UPDATE password_reset_codes SET expires_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND nonce=$2',[issue.userId,issue.nonce]);
   console.error('Password reset email delivery failed. Check Gmail configuration and connectivity.');
  }}
  res.json({message:MESSAGE});
 });
 app.post('/api/password/reset',limit,async(req,res)=>{
  const email=emailInput(req.body),b=req.body||{},code=typeof b.code==='string'?b.code.trim():'';
  if(!/^\d{6}$/.test(code))fail(400,'Enter the 6-digit code from your email.');
  const password=b.new_password;
  if(typeof password!=='string'||password.length<8||Buffer.byteLength(password,'utf8')>72)fail(400,'New password must contain at least 8 characters and at most 72 bytes.');
  if(b.confirm_password!==password)fail(400,'Passwords do not match.');
  const success=await transaction(async db=>{
   const user=(await db.query('SELECT id,active FROM users WHERE email=$1 FOR UPDATE',[email])).rows[0];if(!user?.active)return false;
   const row=(await db.query('SELECT * FROM password_reset_codes WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];
   const now=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now;
   if(!row||row.attempts>=5||new Date(row.expires_at)<=now)return false;
   const matches=crypto.timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(digest(user.id,row.nonce,code),'hex'));
   if(!matches){await db.query('UPDATE password_reset_codes SET attempts=attempts+1 WHERE user_id=$1',[user.id]);return false;}
   await db.query('UPDATE users SET password_hash=$2,auth_version=auth_version+1 WHERE id=$1',[user.id,await bcrypt.hash(password,12)]);
   await db.query('UPDATE password_reset_codes SET expires_at=$2,attempts=5 WHERE user_id=$1',[user.id,now]);
   await db.query("INSERT INTO exam_audit(user_id,action,details) VALUES($1,'password.reset','Password reset completed; previous sessions revoked.')",[user.id]);return true;
  });
  if(!success)fail(400,'Invalid or expired code. Request a new code if needed.');
  res.json({message:'Password updated. Sign in with your new password.'});
 });
}
module.exports={attachPasswordReset};
