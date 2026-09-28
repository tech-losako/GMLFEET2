const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');

(async()=>{
 const server=http.createServer((req,res)=>{
  try{
   const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');
   res.end(fs.readFileSync(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[],base='http://127.0.0.1:'+server.address().port;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*supabase.co/**',route=>route.abort());
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   await page.goto(base+'/index.html',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.home-local').count(),0);
   assert.equal(await page.locator('.pub-footer a').count(),0);
   assert.match(await page.locator('.pub-footer').innerText(),/01, Ngongo Lutete/);
   assert.doesNotMatch(await page.locator('.pub-footer').innerText(),/851 686 846|Contact/);
   await page.goto(base+'/apropos.html',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.about-story').count(),1);
   assert.equal(await page.locator('.about-principles article').count(),3);
   assert.equal(await page.locator('.about-disclosure,.pub-explorer details').count(),0);
   assert.equal(await page.locator('.contact-studio').count(),1);
   assert.equal(await page.locator('.pub-links a',{hasText:'À propos'}).count(),1);
   assert.equal(await page.locator('.pub-links a',{hasText:'Contact',exact:true}).getAttribute('href'),'/apropos.html#contact');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(root,'tests/artifacts/about-'+width+'.png'),fullPage:true});
  }
  await page.goto(base+'/apropos.html#contact',{waitUntil:'networkidle'});
  await page.locator('#contact').waitFor();
  assert.equal(await page.locator('#contactForm').count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS simplified footer/home, separate About and Contact navigation, dedicated responsive About page and preserved contact form.');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
