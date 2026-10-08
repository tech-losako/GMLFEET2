const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {PDFDocument,StandardFonts,rgb}=require(process.env.PDF_LIB_MODULE||'pdf-lib');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const original=fs.readFileSync(path.join(__dirname,'browser.cjs'),'utf8');
const fixture=original.slice(original.indexOf('function fixture()'),original.indexOf('(async()=>'));
function documentFixture(){
 const make=window.supabase.createClient,uploaded=new Map();window.documentUploads=[];window.documentCleanup=[];
 window.supabase.createClient=(...args)=>{
  const db=make(...args),tables=window.fixtureTables,staff=tables.staff_members[0];
  staff.role='super_admin';tables.applications[0].assigned_to=staff.user_id;
  tables.applications[0].case_reference='YNG-2026-000001';
  const base={application_id:1,size_bytes:2048,created_at:'2026-10-08T08:00:00Z',created_by:null,review_status:'pending',revision:1};
  tables.documents=[
   {...base,id:'pdf-1',name:'permis.pdf',category:'license',storage_path:'1/permis.pdf',mime_type:'application/pdf'},
   {...base,id:'image-1',name:'identite.png',category:'identity',storage_path:'1/identite.png',mime_type:'image/png'},
   {...base,id:'broken-1',name:'illisible.pdf',category:'other',storage_path:'1/broken.pdf',mime_type:'application/pdf'}
  ];
  const from=db.from;
  db.from=table=>{
   const query=from(table);if(table!=='documents')return query;
   const then=query.then;
   query.then=function(resolve,reject){
    if(this.mode==='insert'&&window.documentInsertFail)return Promise.resolve({data:null,error:{message:'Enregistrement temporairement indisponible'}}).then(resolve,reject);
    if(this.mode==='update'&&window.documentStale)return Promise.resolve({data:[],error:null}).then(resolve,reject);
    return then.call(this,result=>{
     const records=Array.isArray(result.data)?result.data:[result.data];
     if(this.mode==='insert')records.filter(Boolean).forEach(doc=>Object.assign(doc,{review_status:'pending',reviewed_by:null,reviewed_at:null,revision:1}));
     if(this.mode==='update')records.filter(Boolean).forEach(doc=>Object.assign(doc,{reviewed_by:doc.review_status==='pending'?null:staff.user_id,reviewed_at:doc.review_status==='pending'?null:new Date().toISOString()}));
     return resolve(result);
    },reject);
   };return query;
  };
  db.storage.from=()=>({
   upload:async(storagePath,file)=>{uploaded.set(storagePath,file);window.documentUploads.push(storagePath);return {data:{},error:null};},
   remove:async(paths)=>{paths.forEach(p=>{uploaded.delete(p);window.documentCleanup.push(p);});return {data:{},error:null};},
   createSignedUrl:async(storagePath)=>({data:{signedUrl:uploaded.has(storagePath)?URL.createObjectURL(uploaded.get(storagePath)):storagePath.endsWith('identite.png')?'/img/logogml-Photoroom.png':storagePath.endsWith('broken.pdf')?'/fixture/broken.pdf':'/fixture/permis.pdf'},error:null})
  });
  return db;
 };
}
(async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=1;i<=2;i++){
  const page=pdf.addPage([595,842]);
  page.drawRectangle({x:0,y:750,width:595,height:92,color:rgb(0.08,0.24,0.34)});
  page.drawText('DOCUMENT DE DEMONSTRATION',{x:40,y:796,size:20,font,color:rgb(1,1,1)});
  page.drawText('Permis de conduire - specimen',{x:40,y:710,size:19,font,color:rgb(0.08,0.24,0.34)});
  page.drawText('Candidat de test / verification des pieces',{x:40,y:654,size:13,font});
  page.drawText('Page '+i+' - aucun document personnel reel',{x:40,y:600,size:13,font});
  page.drawRectangle({x:40,y:480,width:515,height:62,color:rgb(0.9,0.95,0.92)});
  page.drawText('Exemple reserve aux tests de l interface',{x:54,y:504,size:13,font});
 }
 const pdfBytes=Buffer.from(await pdf.save());
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/fixture/permis.pdf'){res.setHeader('Content-Type','application/pdf');return res.end(pdfBytes);}
  if(url.pathname==='/fixture/broken.pdf'){res.setHeader('Content-Type','application/pdf');return res.end('Not a PDF');}
  const file=path.join(root,url.pathname),mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html'};
  try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/vendor/supabase-2.57.4.js',route=>route.fulfill({contentType:'text/javascript',body:fixture+';fixture();('+documentFixture.toString()+')();'}));
  await page.route('**/*supabase.co/**',route=>route.abort());
  await page.route('**/fixture/permis.pdf',route=>route.fulfill({contentType:'application/pdf',body:pdfBytes}));
  await page.route('**/fixture/broken.pdf',route=>route.fulfill({contentType:'application/pdf',body:'Not a PDF'}));
  await page.goto((process.env.DOCUMENT_REVIEW_BASE_URL||'http://127.0.0.1:'+server.address().port)+'/admin.html');
  await page.locator('nav [data-view=applications]').click();await page.locator('[data-case="1"]').click();
  assert.equal(await page.locator('#case-tab-summary').textContent(),'Informations du candidat');
  await page.locator('#case-tab-documents').click();assert.equal(await page.locator('.document-item').count(),3);
  await page.locator('#caseDialog').screenshot({path:path.join(__dirname,'documents-list-desktop.png')});
  await page.locator('[data-open-document="pdf-1"]').click();
  await page.waitForFunction(()=>document.querySelector('.document-surface canvas')?.width>0);
  await page.locator('[data-preview=next-page]').click();await page.waitForFunction(()=>document.querySelector('[data-page-counter]').textContent==='2 / 2');
  await page.locator('[data-preview=zoom-in]').click();await page.getByText('125 %',{exact:true}).waitFor();
  await page.locator('[data-preview=fit]').click();await page.getByText('100 %',{exact:true}).waitFor();
  await page.waitForFunction(()=>{const canvas=document.querySelector('.document-surface canvas');if(!canvas)return false;const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;return pixels.some((value,index)=>index%4===0&&value>0&&value<245);});
  await page.locator('#documentViewer').screenshot({path:path.join(__dirname,'documents-viewer-desktop.png')});
  await page.locator('[data-review-document=approved]').click();
  await page.waitForFunction(()=>window.fixtureTables.documents[0].review_status==='approved');
  await page.locator('.document-inspector [data-status=approved]').waitFor();
  await page.locator('[data-document-nav="1"]').click();await page.waitForFunction(()=>document.querySelector('.document-surface canvas')?.width>0);
  await page.locator('[data-reject-document]').click();
  await page.locator('#documentRejectForm textarea').fill('Image floue, photo lisible requise.');
  await page.locator('#documentRejectForm [type=submit]').click();
  await page.waitForFunction(()=>window.fixtureTables.documents[1].review_status==='rejected');
  await page.locator('.document-inspector .document-status[data-status=rejected]').waitFor();
  assert.equal(await page.evaluate(()=>window.fixtureTables.documents[0].review_status),'approved');
  await page.locator('.document-replacement summary').click();
  await page.locator('#documentReplacementForm [name=file]').setInputFiles({name:'identite-corrigee.pdf',mimeType:'application/pdf',buffer:pdfBytes});
  await page.locator('#documentReplacementForm [name=replacement_note]').fill('Version lisible fournie au bureau.');
  await page.locator('#documentReplacementForm [type=submit]').click();
  await page.waitForFunction(()=>window.fixtureTables.documents.length===4);
  await page.locator('#documentViewerTitle').getByText('Pièce d’identité',{exact:true}).waitFor();
  await page.locator('.document-inspector [data-status=pending]').waitFor();
  assert.equal(await page.evaluate(()=>window.fixtureTables.documents[3].replaces_document_id),'image-1');
  assert.equal(await page.evaluate(()=>window.fixtureTables.documents[1].storage_path),'1/identite.png');
  await page.locator('.document-version-history summary').click();
  await page.locator('[data-open-version="image-1"]').click();await page.getByText('Version remplacée',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-review-document]').count(),0);
  await page.locator('[data-current-version]').click();await page.locator('.document-inspector [data-status=pending]').waitFor();
  await page.evaluate(()=>window.documentStale=true);
  await page.locator('[data-review-document=approved]').click();await page.getByText('Cette pièce a changé.',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>window.fixtureTables.documents[3].review_status),'pending');
  await page.evaluate(()=>window.documentStale=false);
  await page.locator('[data-viewer-close]').click();
  await page.locator('[data-document-filter=rejected]').click();assert.equal(await page.locator('.document-item').count(),0);
  await page.locator('[data-document-filter=all]').click();await page.locator('[data-open-document="broken-1"]').click();await page.getByText('Aperçu indisponible',{exact:true}).waitFor();
  await page.locator('[data-viewer-close]').click();
  await page.locator('[data-add-document]').click();
  await page.locator('#documentForm [name=file]').setInputFiles({name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('<html>Fake</html>')});
  await page.locator('#documentForm [type=submit]').click();await page.getByText('Le contenu du fichier ne correspond pas au format annoncé.').waitFor();
  const uploadsBefore=await page.evaluate(()=>window.documentUploads.length);
  await page.evaluate(()=>window.documentInsertFail=true);
  await page.locator('#documentForm [name=file]').setInputFiles({name:'cv.pdf',mimeType:'application/pdf',buffer:pdfBytes});
  await page.locator('#documentForm [type=submit]').click();await page.getByText('Enregistrement temporairement indisponible').waitFor();
  assert.equal(await page.evaluate(()=>window.documentCleanup.length),1);
  assert.equal(await page.evaluate(()=>window.documentUploads.length),uploadsBefore+1);
  await page.evaluate(()=>window.documentInsertFail=false);
  await page.locator('#documentForm [name=category]').selectOption('cv');
  await page.locator('#documentForm [type=submit]').click();await page.waitForFunction(()=>window.fixtureTables.documents.length===5);
  await page.locator('#documentViewerTitle').getByText('CV',{exact:true}).waitFor();
  await page.locator('[data-viewer-close]').click();await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-open-document="pdf-1"]').click();await page.waitForFunction(()=>document.querySelector('.document-surface canvas')?.width>0);
  assert.equal(await page.locator('#documentViewer').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth),true);
  await page.locator('#documentViewer').screenshot({path:path.join(__dirname,'documents-viewer-mobile.png')});
  await page.locator('[data-reject-document]').scrollIntoViewIfNeeded();await page.locator('[data-reject-document]').click();
  const rejectionBox=await page.locator('#documentRejectForm textarea').boundingBox();assert.ok(rejectionBox.width<=390);
  await page.locator('#documentViewer').screenshot({path:path.join(__dirname,'documents-review-mobile.png')});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#documentViewer').evaluate(dialog=>dialog.open),false);
  await page.locator('[data-close=caseDialog]').click();
  assert.equal(await page.locator('#documentViewer').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: candidate tab, real PDF and image previews, PDF pages, zoom, independent decisions, refusal reason, replacement history, stale update warning, unreadable files, upload validation and cleanup, new uploads, mobile review and keyboard dismissal.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
