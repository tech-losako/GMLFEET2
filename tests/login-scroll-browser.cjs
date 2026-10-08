const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};

(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const cases=[
   {name:'desktop',width:1440,height:1000},
   {name:'mobile',width:390,height:844,expired:true},
   {name:'small-screen',width:320,height:480,expired:true},
   {name:'landscape',width:844,height:390,expired:true},
   {name:'zoomed',width:1280,height:720,expired:true,zoom:2}
  ];
  for(const scenario of cases){
   const page=await browser.newPage({viewport:{width:scenario.width,height:scenario.height}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/supabaseClient.js',route=>route.fulfill({contentType:'text/javascript',body:`window.GMFleetBackend={isConfigured:()=>true,getSession:async()=>({data:{session:null}}),signIn:async()=>{window.loginAttempted=true;return {error:new Error('Test sign-in response')};}};`}));
   await page.route('**/*supabase.co/**',route=>route.abort());
   await page.goto('http://127.0.0.1:'+server.address().port+'/login.html'+(scenario.expired?'?reason=inactivity':''));
   await page.waitForFunction(()=>getComputedStyle(document.getElementById('loginBtn')).backgroundColor==='rgb(220, 38, 38)');
   if(scenario.expired)await page.locator('#loginError').waitFor({state:'visible'});
   if(scenario.zoom)await page.evaluate(zoom=>document.documentElement.style.zoom=zoom,scenario.zoom);
   await page.locator('#loginCard').evaluate(card=>Promise.all(card.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
   const layout=await page.evaluate(()=>({
    top:document.getElementById('loginCard').getBoundingClientRect().top,
    scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.scrollingElement.scrollHeight,
    width:innerWidth,height:innerHeight
   }));
   assert.ok(layout.top>=0,scenario.name+': the top of the form must remain reachable');
   assert.ok(layout.scrollWidth<=layout.width,scenario.name+': no horizontal overflow');
   if(layout.scrollHeight>layout.height){
    await page.mouse.move(scenario.width/2,scenario.height/2);
    await page.mouse.wheel(0,layout.scrollHeight);
    await page.waitForFunction(()=>scrollY>0);
   }
   const button=page.locator('#loginBtn');
   await button.scrollIntoViewIfNeeded();
   const buttonBox=await button.boundingBox();
   assert.ok(buttonBox.y>=0&&buttonBox.y+buttonBox.height<=scenario.height,scenario.name+': the whole connection button must be visible');
   const footerClear=await page.evaluate(()=>document.querySelector('body > div:last-of-type').getBoundingClientRect().top>=document.getElementById('loginCard').getBoundingClientRect().bottom);
   assert.equal(footerClear,true,scenario.name+': the copyright must not overlap the form');
   await page.screenshot({path:path.join(__dirname,'login-scroll-'+scenario.name+'.png'),fullPage:false});
   await page.locator('#loginEmail').fill('scroll-test@example.test');
   await page.locator('#loginPassword').fill('test-only-password');
   await button.click();
   assert.equal(await page.evaluate(()=>window.loginAttempted),true,scenario.name+': the connection button must remain clickable');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: login scrolling, full connection button visibility, footer separation and sign-in click across desktop, mobile, short landscape and 200% zoom.');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
