/* PDF slips use server-confirmed receipt data. jsPDF is pinned and served locally. */
window.GMFleetReceipt = (() => {
 function create(receipt){
  if(receipt.status!=='confirmed')throw new Error('Paiement non confirmé.');
  if(!window.jspdf?.jsPDF)throw new Error('Téléchargement indisponible. Actualisez la page.');
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a5'});
  const clean=value=>String(value??'').normalize('NFC').replace(/[\u0000-\u001f]/g,' ').replace(/\u202f/g,' ');
  const cash=value=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)).replace(/[\u202f\u00a0]/g,' ')+' '+receipt.currency;
  let y=48;
  doc.setFillColor(18,38,56);doc.rect(0,0,148,34,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('GM FLEET',12,16);doc.setFontSize(10);doc.text('REÇU DE VERSEMENT CONFIRMÉ',12,25);
  doc.setTextColor(25,48,70);
  function row(label,value){
   doc.setFont('helvetica','normal');doc.setFontSize(9);const lines=doc.splitTextToSize(clean(value),76);const height=Math.max(7,lines.length*4.5+3);
   if(y+height>183){doc.addPage();y=18;}
   doc.setTextColor(104,122,139);doc.text(label,12,y);doc.setTextColor(25,48,70);doc.text(lines,59,y);y+=height;
  }
  row('Numéro du reçu','#'+receipt.id);row('Référence',receipt.reference);row('Chauffeur',receipt.driver_name);row('Véhicule',receipt.vehicle?.model);row('Plaque',receipt.vehicle?.plate);row('Contrat',receipt.contract_reference);
  row('Date du paiement',receipt.paid_on);row('Confirmé le',new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Africa/Kinshasa'}).format(new Date(receipt.confirmed_at))+' (Kinshasa)');row('Méthode',receipt.method);
  doc.setDrawColor(226,232,238);doc.line(12,y,136,y);y+=9;
  row('Versement au contrat',cash(receipt.amount));row('Frais de transaction',cash(receipt.transaction_fee));
  if(y+22>183){doc.addPage();y=18;}
  doc.setFillColor(225,243,236);doc.rect(12,y-2,124,15,'F');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(19,118,92);doc.text('TOTAL REÇU',16,y+7);doc.text(cash(receipt.total_charged),132,y+7,{align:'right'});
  const pages=doc.getNumberOfPages();for(let n=1;n<=pages;n++){doc.setPage(n);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(104,122,139);doc.text('gmfleet.georgemichaellogistics.cd',12,198);doc.text('Page '+n+' / '+pages,136,198,{align:'right'});}
  doc.setProperties({title:'GM Fleet - Reçu '+receipt.id,author:'GM Fleet',subject:'Versement confirmé'});return doc;
 }
 return {create,download:receipt=>create(receipt).save('GMFleet-recu-'+String(receipt.id).replace(/[^0-9]/g,'')+'.pdf')};
})();
