const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const original=fs.readFileSync(path.join(__dirname,'browser.cjs'),'utf8');
const fixture=original.slice(original.indexOf('function fixture()'),original.indexOf('(async()=>'));
function staffFixture(){
 const make=window.supabase.createClient;
 window.supabase.createClient=(...args)=>{
  const db=make(...args),me=window.fixtureTables.staff_members[0];
  me.role=window.testRole||'super_admin';me.email='owner@example.test';me.confirmed=true;me.revision=1;
  db.rpc=async(name,{p}={})=>{
   if(name==='list_staff_accounts')return {data:window.fixtureTables.staff_members.filter(s=>!s.deleted_at),error:null};
   const member=window.fixtureTables.staff_members.find(s=>s.user_id===p.user_id);Object.assign(member,p,{revision:member.revision+1});if(name==='delete_staff'){member.deleted_at=new Date().toISOString();member.active=false;}return {data:member.user_id,error:null};
  };
  db.functions={invoke:async(name,{body})=>{if(name==='staff-email'){const member=window.fixtureTables.staff_members.find(s=>s.user_id===body.user_id);member.email=body.email;member.revision++;return {data:{email:member.email,revision:member.revision},error:null};}const id=crypto.randomUUID();window.fixtureTables.staff_members.push({...body,user_id:id,active:true,confirmed:false,revision:1});return {data:{email:body.email,link:'https://gmfleet.georgemichaellogistics.cd/set-password.html#token_hash=test-only'},error:null};}};
  db.auth.verifyOtp=async p=>{window.verifiedToken=p;return {error:null};};
  db.auth.updateUser=async p=>{window.passwordUpdated=!!p.password;return {error:null};};
  return db;
 };
}
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/supabase-2\.57\.4\.js|supabase-js@/,r=>r.fulfill({contentType:'text/javascript',body:fixture+';fixture();('+staffFixture.toString()+')();'}));
  await page.route('**/*supabase.co/**',r=>r.abort());
  const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url+'/admin.html');await page.locator('#usersNav').click();await page.locator('#addUser').click();
  await page.locator('[name=display_name]').fill('Cashier Test');await page.locator('#userForm [name=email]').fill('cashier@example.test');await page.locator('[name=role]').selectOption('cashier');await page.locator('#userForm [type=submit]').click();
  await page.locator('#invitationLink').waitFor();assert.ok((await page.locator('#invitationLink').inputValue()).includes('#token_hash='));
  await page.locator('[data-close=userDialog]').click();assert.equal(await page.locator('#invitationLink').count(),0);
  await page.locator('[data-edit-user]').last().click();await page.locator('#userForm [name=email]').fill('corrected@example.test');await page.locator('[name=active]').selectOption('false');await page.locator('#userForm [type=submit]').click();await page.locator('#content').getByText('Désactivé',{exact:true}).waitFor();
  await page.getByText('corrected@example.test',{exact:true}).waitFor();await page.locator('[data-delete-user]').click();await page.locator('[data-close=userDialog]').first().click();assert.equal(await page.locator('[data-delete-user]').count(),1);await page.locator('[data-delete-user]').click();await page.locator('[name=confirmation]').fill('SUPPRIMER');await page.locator('#deleteUserForm [type=submit]').click();await page.getByText('1 utilisateur(s)',{exact:true}).waitFor();assert.equal(await page.locator('[data-delete-user]').count(),0);
  await page.locator('[data-edit-user]').first().click();assert.equal(await page.locator('[name=role]').isDisabled(),true);assert.equal(await page.locator('[name=active]').isDisabled(),true);await page.locator('[data-close=userDialog]').click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(__dirname,'staff-mobile.png'),fullPage:true});
  await page.goto(url+'/set-password.html#token_hash=test-only');assert.equal(new URL(page.url()).hash,'');
  await page.locator('[name=password]').fill('Test-only-password');await page.locator('[name=confirm]').fill('Test-only-mismatch');await page.locator('[type=submit]').click();await page.getByText('Les mots de passe ne correspondent pas.').waitFor();assert.equal(await page.evaluate(()=>window.verifiedToken),undefined);
  await page.locator('[name=confirm]').fill('Test-only-password');await page.locator('[type=submit]').click();await page.getByText('Compte activé.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.passwordUpdated),true);
  await page.addInitScript(()=>window.testRole='agent');await page.goto(url+'/admin.html');await page.locator('#workspace').waitFor();assert.equal(await page.locator('#usersNav').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: users view, invitation, disable, self controls, role-hidden navigation, mobile fit, password mismatch and activation flow.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});

