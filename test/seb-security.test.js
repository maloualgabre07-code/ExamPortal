const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configHash,isValidConfigKey,requireSeb}=require('../seb-security');
const key='a'.repeat(64);
const settings={SEB_REQUIRED:'true',SEB_CONFIG_KEY:key,SEB_BASE_URL:'https://exams.example.edu'};
const mk=(url,hash)=>({originalUrl:url,get:(name)=>name.toLowerCase()==='x-safeexambrowser-configkeyhash'?hash:undefined});
test('SEB disabled does not interfere with current project',()=>assert.equal(isValidConfigKey(mk('/api/exams/1/start'),{}),true));
test('valid URL-bound config hash passes',()=>{
  const hash=configHash('https://exams.example.edu/api/exams/1/start',key);
  assert.equal(isValidConfigKey(mk('/api/exams/1/start',hash),settings),true);
});
test('normal browser/no header denied',()=>assert.equal(isValidConfigKey(mk('/api/exams/1/start'),settings),false));
test('header copied from another endpoint denied',()=>{
  const hash=configHash('https://exams.example.edu/api/exams/1/start',key);
  assert.equal(isValidConfigKey(mk('/api/attempts/1',hash),settings),false);
});
test('malformed server configuration fails closed',()=>assert.equal(isValidConfigKey(mk('/x','a'.repeat(64)),{SEB_REQUIRED:'true',SEB_CONFIG_KEY:'incorrect',SEB_BASE_URL:'https://exams.example.edu'}),false));
test('untrusted host cannot alter canonical origin',()=>{
 const req={...mk('/api/exams/1/start',configHash('https://evil.example/api/exams/1/start',key)),headers:{host:'evil.example'}};
 assert.equal(isValidConfigKey(req,settings),false);
});
