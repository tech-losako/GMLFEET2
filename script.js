// GMFLEET Logic

const modal = document.getElementById('vehicleModal');
const modalPanel = document.getElementById('modalPanel');
const modalBackdrop = document.getElementById('modalBackdrop');
const appForm = document.getElementById('applicationForm');
const successMessage = document.getElementById('successMessage');
const modalInfoPart = document.getElementById('modalInfoPart');
const modalFormPart = document.getElementById('modalFormPart');
const showFormBtn = document.getElementById('showFormBtn');

const carsData = {
    'IST': {
        name: 'Toyota IST',
        img: './img/ist-official.png',
        daily: '32,5 $',
        pricing: {
            "12": { total: "10 536 $", avance: "1 300 $", week: "203 $" },
            "15": { total: "11 784 $", avance: "1 300 $", week: "181 $" },
            "18": { total: "12 560 $", avance: "1 300 $", week: "161 $" }
        }
    },
    'Blade': {
        name: 'Toyota Blade',
        img: './img/blade-official-v2.png',
        daily: '38,5 $',
        pricing: {
            "12": { total: "11 160 $", avance: "1 400 $", week: "215 $" },
            "15": { total: "12 174 $", avance: "1 400 $", week: "187 $" },
            "18": { total: "13 500 $", avance: "1 400 $", week: "173 $" }
        }
    },
    'Swift': {
        name: 'Suzuki Swift',
        img: './img/swift-official-v2.png',
        daily: '29,5 $',
        pricing: {
            "12": { total: "9 288 $", avance: "1 100 $", week: "179 $" },
            "15": { total: "10 224 $", avance: "1 100 $", week: "157 $" },
            "18": { total: "11 160 $", avance: "1 100 $", week: "143 $" }
        }
    },
    'Vitz': {
        name: 'Toyota Vitz',
        img: './img/vitz-official-v2.png',
        daily: '29,5 $',
        pricing: {
            "12": { total: "9 288 $", avance: "1 100 $", week: "179 $" },
            "15": { total: "10 224 $", avance: "1 100 $", week: "157 $" },
            "18": { total: "11 160 $", avance: "1 100 $", week: "143 $" }
        }
    }
};

function moneyValue(value) {
    return Number(String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

function formatUsd(value, decimals = 2) {
    return `${new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(Number(value) || 0).replace(/[\u202f\u00a0]/g, ' ')} USD`;
}

function getPlanQuote(carKey, duration) {
    const months = Number(duration);
    const offer = carsData[carKey]?.pricing?.[String(months)];
    if (!offer || !months) return null;
    const total = moneyValue(offer.total);
    const initialDeposit = moneyValue(offer.avance);
    const paymentWeeks = months * 52 / 12;
    const weeklyPayment = total / paymentWeeks;
    const dailyPayment = weeklyPayment / 6;
    return { months, total, initialDeposit, paymentWeeks, weeklyPayment, dailyPayment };
}

function getStartingQuote(carKey) {
    return Object.keys(carsData[carKey]?.pricing || {})
        .map(duration => getPlanQuote(carKey, duration))
        .filter(Boolean)
        .sort((a, b) => a.dailyPayment - b.dailyPayment)[0] || null;
}

function congolesePhone(value) {
    const digits = String(value || '').replace(/\D/g, '').replace(/^243/, '').replace(/^0/, '').slice(0, 9);
    return digits.length === 9 ? `+243${digits}` : '';
}

const receiptLabels = {
    name: 'Nom complet', phone: 'Téléphone', address: 'Adresse', service: 'Type de demande', vehicle: 'Véhicule choisi',
    duration: 'Durée du plan', dailyPayment: 'Versement journalier', weeklyPayment: 'Versement hebdomadaire',
    planTotal: 'Total du plan', initialDeposit: 'Acompte initial', experience: 'Expérience de conduite',
    coBorrowerName: 'Co-emprunteur', coBorrowerPhone: 'Téléphone du co-emprunteur', coBorrowerAddress: 'Adresse du co-emprunteur',
    licenseRectoFileName: 'Permis de conduire - recto', licenseVersoFileName: 'Permis de conduire - verso',
    email: 'E-mail', idNumber: "Numéro de pièce d'identité", carBrand: 'Marque', carModel: 'Modèle', carPlate: 'Plaque',
    carYear: 'Année du véhicule', carChassis: 'Châssis / VIN', permisRectoFileName: 'Permis de conduire - recto',
    permisVersoFileName: 'Permis de conduire - verso', carteRoseFileName: 'Carte rose',
    transportAuthorizationFileName: 'Autorisation de transport', vignetteFileName: 'Vignette', insuranceFileName: 'Assurance',
    technicalInspectionFileName: 'Contrôle technique', frontPhotoFileName: 'Photo avant', rearPhotoFileName: 'Photo arrière',
    leftPhotoFileName: 'Photo côté gauche', rightPhotoFileName: 'Photo côté droit', interiorPhotoFileName: 'Photo intérieure',
    cvFileName: 'CV'
};

function receiptFields(app) {
    return Object.entries(receiptLabels).flatMap(([key, label]) => {
        const value = app[key];
        if (value === undefined || value === null || value === '') return [];
        const display = key === 'duration' ? `${value} mois` : value;
        return [{ label, value: display }];
    });
}

function openModal(carKey) {
    window.location.href = `detail-vehicule.html?car=${carKey}`;
}

function openGeneralModal() {
    window.location.href = `detail-vehicule.html`;
}

function handleGeneralVehicleSelect(val) {
    if (!val) {
        if (showFormBtn) showFormBtn.classList.add('hidden');
        const features = document.getElementById('modalCarFeatures');
        const img = document.getElementById('modalCarImg');
        const title = document.getElementById('modalCarTitle');

        if (features) features.classList.add('hidden');
        if (img) img.src = "./img/fleet_white_bg.png";
        if (title) title.textContent = "Sélectionnez un véhicule";
        return;
    }

    const data = carsData[val];
    if (!data) return;

    const title = document.getElementById('modalCarTitle');
    const img = document.getElementById('modalCarImg');
    const selectedVehicle = document.getElementById('selectedVehicle');
    const features = document.getElementById('modalCarFeatures');

    if (title) title.textContent = data.name;
    if (img) img.src = data.img;
    if (selectedVehicle) selectedVehicle.value = data.name;

    updatePricingDisplay();

    if (features) features.classList.remove('hidden');

    // Auto show form
    showForm();
}

const servicesData = {
    'Chauffeur Yango': {
        icon: 'fas fa-taxi',
        title: 'Chauffeur Yango',
        desc: 'Rejoignez notre réseau de chauffeurs et maximisez vos revenus avec Yango sous notre encadrement.'
    },
    'Gestion de flotte': {
        icon: 'fas fa-tasks',
        title: 'Gestion de flotte',
        desc: 'Confiez-nous la gestion de votre véhicule. Nous nous occupons de tout : de la recherche de chauffeur à l\'entretien.'
    },
    'Recrutement': {
        icon: 'fas fa-users',
        title: 'Recrutement',
        desc: 'Nous sélectionnons et formons des chauffeurs fiables pour votre véhicule.'
    }
};

function handleServiceSelect(val) {
    const icon = document.getElementById('serviceIcon');
    const title = document.getElementById('modalServiceTitle');
    const desc = document.getElementById('serviceDescription');
    const features = document.getElementById('modalServiceFeatures');
    const selectedService = document.getElementById('selectedService');
    const noServiceWarn = document.getElementById('noServiceSelectedWarning');
    const form = document.getElementById('serviceApplicationForm');

    if (!val) {
        if (icon) icon.className = "fas fa-briefcase fa-3x";
        if (title) title.textContent = "Sélectionnez un service";
        if (features) features.classList.add('hidden');
        if (noServiceWarn) noServiceWarn.classList.remove('hidden');
        if (form) form.classList.add('hidden');
        return;
    }

    const data = servicesData[val];
    if (!data) return;

    if (icon) icon.className = data.icon + " fa-3x";
    if (title) title.textContent = data.title;
    if (desc) desc.textContent = data.desc;
    if (selectedService) selectedService.value = val;
    
    if (features) features.classList.remove('hidden');
    
    // Handle dynamic fields
    const dynContainer = document.getElementById('dynamicFieldsContainer');
    const fYango = document.getElementById('fieldsYango');
    const fFlotte = document.getElementById('fieldsFlotte');
    const fRecrutement = document.getElementById('fieldsRecrutement');
    
    if (dynContainer) dynContainer.classList.remove('hidden');
    if (fYango) fYango.classList.add('hidden');
    if (fFlotte) fFlotte.classList.add('hidden');
    if (fRecrutement) fRecrutement.classList.add('hidden');
    
    // Add required attributes dynamically (removing from all first)
    document.querySelectorAll('#dynamicFieldsContainer input, #dynamicFieldsContainer select').forEach(el => el.removeAttribute('required'));

    if (val === 'Chauffeur Yango') {
        if (fYango) fYango.classList.remove('hidden');
        document.getElementById('yangoCarModel')?.setAttribute('required', 'true');
        document.getElementById('yangoPermisRecto')?.setAttribute('required', 'true');
        document.getElementById('yangoPermisVerso')?.setAttribute('required', 'true');
    } else if (val === 'Gestion de flotte') {
        if (fFlotte) fFlotte.classList.remove('hidden');
        document.getElementById('flotteCarModel')?.setAttribute('required', 'true');
        document.getElementById('flotteCarPlate')?.setAttribute('required', 'true');
    } else if (val === 'Recrutement') {
        if (fRecrutement) fRecrutement.classList.remove('hidden');
        document.getElementById('recrutementExperience')?.setAttribute('required', 'true');
        document.getElementById('recrutementPermisRecto')?.setAttribute('required', 'true');
        document.getElementById('recrutementPermisVerso')?.setAttribute('required', 'true');
    }

    if (noServiceWarn) noServiceWarn.classList.add('hidden');
    if (form) {
        form.classList.remove('hidden');
        if (window.innerWidth < 1024 && !document.querySelector('link[href*="public-ui"]')) {
            setTimeout(() => {
                form.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }
}


function updatePricingDisplay() {
    const select = document.getElementById('generalVehicleSelect');
    const val = select ? select.value : null;
    if (!val) return;

    const durContainer = document.getElementById('planDuration');
    const selectedDuration = durContainer?.value || '';
    const quote = getPlanQuote(val, selectedDuration);
    const displayQuote = quote || getStartingQuote(val);
    const dailyEl = document.getElementById('modalValJour');
    const summary = document.getElementById('planDailySummary');
    if (dailyEl) dailyEl.textContent = displayQuote ? formatUsd(displayQuote.dailyPayment) : '-';
    if (summary) summary.textContent = quote
        ? `${quote.months} mois · ${Math.round(quote.paymentWeeks * 6)} jours de versement · ${formatUsd(quote.dailyPayment)} par jour, 6 jours par semaine.`
        : 'Choisissez une durée pour calculer votre versement journalier.';

    const data = carsData[val];
    const pricing = data?.pricing?.[selectedDuration];
    if (pricing && quote) {
        const totalEl = document.getElementById('modalValPrix');
        const advanceEl = document.getElementById('modalValAcompte');
        const semaineEl = document.getElementById('modalValSemaine');

        if (totalEl) totalEl.textContent = formatUsd(quote.total, 0);
        if (advanceEl) advanceEl.textContent = formatUsd(quote.initialDeposit, 0);
        if (semaineEl) semaineEl.textContent = formatUsd(quote.weeklyPayment);
    }
}

function showForm() {
    // Adjust layout for side-by-side or stacked in detail view
    const noCarWarn = document.getElementById('noCarSelectedWarning');
    const actualForm = document.getElementById('applicationForm');

    if (noCarWarn) noCarWarn.classList.add('hidden');
    if (actualForm) actualForm.classList.remove('hidden');

    // On mobile, scroll to form
    if (window.innerWidth < 1024 && actualForm && !document.querySelector('link[href*="public-ui"]')) {
        setTimeout(() => {
            actualForm.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

function openDriverModal() {
    let modal = document.getElementById('driverOffersModal');
    if (!modal) {
        const modalHTML = `
        <div id="driverOffersModal" class="fixed inset-0 z-[100] hidden flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-gray-900/80 backdrop-blur-sm transition-opacity" onclick="closeDriverModal()"></div>
            <div class="relative bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-3xl w-full mx-auto transform transition-all animate-fadeIn z-10 border border-gray-100 max-h-[90vh] overflow-y-auto no-scrollbar">
                <button onclick="closeDriverModal()" class="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <i class="fas fa-times text-xl"></i>
                </button>
                
                <div class="text-center mb-8">
                    <span class="text-xs font-bold text-gmfRed uppercase tracking-widest bg-red-50 px-3 py-1.5 rounded-full border border-red-100">Écosystème GM Fleet</span>
                    <h3 class="text-2xl md:text-3xl font-black text-gmfBlue mt-3">Vous êtes dans quelle situation ?</h3>
                    <p class="text-gray-600 text-sm mt-1">Choisissez l'offre GM Fleet adaptée à votre projet</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Situation 1: Car na ngai -->
                    <div class="bg-gray-50 hover:bg-red-50/60 p-5 rounded-2xl border border-gray-200 hover:border-gmfRed transition-all flex flex-col justify-between group">
                        <div>
                            <div class="w-10 h-10 rounded-xl bg-red-100 text-gmfRed flex items-center justify-center text-lg font-bold mb-3 group-hover:scale-110 transition-transform">
                                <i class="fas fa-car"></i>
                            </div>
                            <h4 class="text-lg font-bold text-gray-900 mb-1">Je veux un véhicule</h4>
                            <span class="inline-block text-xs font-bold text-gmfRed mb-2">Car na ngai</span>
                            <p class="text-gray-600 text-xs mb-3 leading-relaxed">
                                Conduisez aujourd'hui et devenez propriétaire à 100% au terme du financement.
                            </p>
                        </div>
                        <a href="vehicule-credit.html" onclick="closeDriverModal()" class="block w-full bg-gmfRed hover:bg-red-700 text-white text-center font-bold py-2.5 text-sm rounded-xl transition-all shadow-sm">
                            En savoir plus <i class="fas fa-arrow-right ml-1 text-xs"></i>
                        </a>
                    </div>

                    <!-- Situation 2: Agrégateur Yango -->
                    <div class="bg-gray-50 hover:bg-blue-50/60 p-5 rounded-2xl border border-gray-200 hover:border-gmfBlue transition-all flex flex-col justify-between group">
                        <div>
                            <div class="w-10 h-10 rounded-xl bg-blue-100 text-gmfBlue flex items-center justify-center text-lg font-bold mb-3 group-hover:scale-110 transition-transform">
                                <i class="fas fa-taxi"></i>
                            </div>
                            <h4 class="text-lg font-bold text-gray-900 mb-1">Je conduis déjà sur Yango</h4>
                            <span class="inline-block text-xs font-bold text-gmfBlue mb-2">Agrégateur Yango</span>
                            <p class="text-gray-600 text-xs mb-3 leading-relaxed">
                                Conservez votre voiture et passez chez GM Fleet pour des retraits et un support avantageux.
                            </p>
                        </div>
                        <a href="agregateur-yango.html" onclick="closeDriverModal()" class="block w-full bg-gmfBlue hover:bg-blue-900 text-white text-center font-bold py-2.5 text-sm rounded-xl transition-all shadow-sm">
                            Découvrir les avantages <i class="fas fa-arrow-right ml-1 text-xs"></i>
                        </a>
                    </div>

                    <!-- Situation 3: Gestion de flotte -->
                    <div class="bg-gray-50 hover:bg-green-50/60 p-5 rounded-2xl border border-gray-200 hover:border-green-500 transition-all flex flex-col justify-between group">
                        <div>
                            <div class="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-lg font-bold mb-3 group-hover:scale-110 transition-transform">
                                <i class="fas fa-tasks"></i>
                            </div>
                            <h4 class="text-lg font-bold text-gray-900 mb-1">Je veux confier ma voiture</h4>
                            <span class="inline-block text-xs font-bold text-green-600 mb-2">Gestion de flotte</span>
                            <p class="text-gray-600 text-xs mb-3 leading-relaxed">
                                Confiez la gestion opérationnelle de votre véhicule à GM Fleet et suivez vos revenus sur mobile.
                            </p>
                        </div>
                        <a href="gestion-flotte.html" onclick="closeDriverModal()" class="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-bold py-2.5 text-sm rounded-xl transition-all shadow-sm">
                            Faire travailler ma voiture <i class="fas fa-arrow-right ml-1 text-xs"></i>
                        </a>
                    </div>

                    <!-- Situation 4: Chauffeur Partenaire -->
                    <div class="bg-gray-50 hover:bg-purple-50/60 p-5 rounded-2xl border border-gray-200 hover:border-purple-600 transition-all flex flex-col justify-between group">
                        <div>
                            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg font-bold mb-3 group-hover:scale-110 transition-transform">
                                <i class="fas fa-users"></i>
                            </div>
                            <h4 class="text-lg font-bold text-gray-900 mb-1">Je suis chauffeur sans voiture</h4>
                            <span class="inline-block text-xs font-bold text-purple-600 mb-2">Chauffeur Partenaire</span>
                            <p class="text-gray-600 text-xs mb-3 leading-relaxed">
                                Conduisez nos véhicules en gestion et préparez votre accès au crédit après 12 mois.
                            </p>
                        </div>
                        <a href="recrutement-chauffeurs.html" onclick="closeDriverModal()" class="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center font-bold py-2.5 text-sm rounded-xl transition-all shadow-sm">
                            Découvrir le programme <i class="fas fa-arrow-right ml-1 text-xs"></i>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('driverOffersModal');
    }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDriverModal() {
    const modal = document.getElementById('driverOffersModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

function closeSuccessModal() {
    const successModal = document.getElementById('successModalOverlay');
    if (successModal) {
        successModal.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Restore scroll
    }
}

function closeServiceSuccessModal() {
    const successModal = document.getElementById('serviceSuccessModalOverlay');
    if (successModal) {
        successModal.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Restore scroll
    }
}

function submitContactForm(e) {
    e.preventDefault();
    
    const name = document.getElementById('contactName')?.value || '';
    const phone = document.getElementById('contactPhone')?.value || '';
    const subject = document.getElementById('contactSujet')?.value || 'Contact depuis le site GMFLEET';
    const message = document.getElementById('contactMessage')?.value || '';
    
    const bodyText = `Nom: ${name}\nTéléphone: ${phone}\n\nMessage:\n${message}`;
    
    // Create mailto link
    const mailtoLink = `mailto:info@georgemichaellogistics.cd?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    
    // Open email client
    window.location.href = mailtoLink;
    
    // Show success modal
    showContactSuccessModal();
    
    // Reset form
    document.getElementById('contactForm')?.reset();
}

function showContactSuccessModal() {
    const contactModal = document.getElementById('contactSuccessModal');
    if (contactModal) {
        contactModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeContactModal() {
    const contactModal = document.getElementById('contactSuccessModal');
    if (contactModal) {
        contactModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

// Retain the same submission ID on retry; editing the form starts a new submission.
document.addEventListener('input',event=>{if(event.target.form)delete event.target.form.dataset.submissionId;});
document.addEventListener('change',event=>{if(event.target.form)delete event.target.form.dataset.submissionId;});
function applicationFiles(service){
 if(service==='Gestion de flotte'){
  const ordered=[['flotteCarteRose','01-carte-rose'],['flotteAutorisationTransport','02-autorisation-transport'],['flotteVignette','03-vignette'],['flotteAssurance','04-assurance'],['flotteControleTechnique','05-controle-technique'],['flottePhotoAvant','06-photo-avant'],['flottePhotoArriere','07-photo-arriere'],['flottePhotoGauche','08-photo-gauche'],['flottePhotoDroite','09-photo-droite'],['flottePhotoInterieur','10-photo-interieur']];
  return ordered.flatMap(([id,prefix])=>Array.from(document.getElementById(id)?.files||[]).map(file=>new File([file],prefix+'-'+file.name.replace(/[^a-zA-Z0-9._-]+/g,'-'),{type:file.type,lastModified:file.lastModified})));
 }
 const ordered=service==='Chauffeur Yango'
  ?[['yangoPermisRecto','01-permis-recto'],['yangoPermisVerso','02-permis-verso'],['yangoCarteRose','03-carte-rose']]
  :service?[['recrutementPermisRecto','01-permis-recto'],['recrutementPermisVerso','02-permis-verso'],['recrutementCV','03-cv'],['applicantDocument','03-document']]
  :[['clientPermisRecto','01-permis-recto'],['clientPermisVerso','02-permis-verso']];
 return ordered.flatMap(([id,prefix])=>Array.from(document.getElementById(id)?.files||[]).map(file=>new File([file],prefix+'-'+file.name.replace(/[^a-zA-Z0-9._-]+/g,'-'),{type:file.type,lastModified:file.lastModified})));
}
async function sendPublicApplication(app,form){
 if(!window.GMFleetBackend?.isConfigured())throw new Error('Le service est indisponible. Réessayez plus tard.');
 const id=form.dataset.submissionId||(form.dataset.submissionId=crypto.randomUUID());
 const confirmation=await window.GMFleetBackend.createApplication(app,applicationFiles(app.service),id);
 delete form.dataset.submissionId;
 return confirmation;
}

async function submitForm(e) {
    e.preventDefault();

    const actualForm = document.getElementById('applicationForm');
    const submitBtn = actualForm ? actualForm.querySelector('button[type="submit"]') : null;
    const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Envoi en cours...';
    }

    const carName = document.getElementById('selectedVehicle') ? document.getElementById('selectedVehicle').value : '';
    const carKey = document.getElementById('generalVehicleSelect')?.value || '';
    const duration = document.getElementById('planDuration')?.value || '';
    const quote = getPlanQuote(carKey, duration);
    const licenseRecto = document.getElementById('clientPermisRecto');
    const licenseVerso = document.getElementById('clientPermisVerso');

    const newApp = {
        name: document.getElementById('clientName') ? document.getElementById('clientName').value.trim() : 'Client',
        phone: congolesePhone(document.getElementById('clientPhone')?.value),
        address: document.getElementById('clientAddress') ? document.getElementById('clientAddress').value.trim() : '',
        experience: document.getElementById('clientExperience') ? document.getElementById('clientExperience').value : '',
        coBorrowerName: document.getElementById('coBorrowerName') ? document.getElementById('coBorrowerName').value.trim() : '',
        coBorrowerPhone: congolesePhone(document.getElementById('coBorrowerPhone')?.value),
        coBorrowerAddress: document.getElementById('coBorrowerAddress') ? document.getElementById('coBorrowerAddress').value.trim() : '',
        duration,
        vehicle: carName,
        dailyPayment: quote ? formatUsd(quote.dailyPayment) : '',
        weeklyPayment: quote ? formatUsd(quote.weeklyPayment) : '',
        planTotal: quote ? formatUsd(quote.total, 0) : '',
        initialDeposit: quote ? formatUsd(quote.initialDeposit, 0) : '',
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'En attente',
        licenseRectoFileName: licenseRecto?.files[0]?.name || '',
        licenseVersoFileName: licenseVerso?.files[0]?.name || '',
        licenseFileName: licenseRecto?.files[0]?.name || ''
    };

    try {
        const confirmation = await sendPublicApplication(newApp,actualForm);

        const successCarName = document.getElementById('successCarName');
        if (successCarName) successCarName.textContent = carName;

        const successModal = document.getElementById('successModalOverlay');
        if (successModal) {
            successModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            window.GMFleetRequestReceipt?.present(successModal, {
                reference: confirmation.reference,
                title: 'Récépissé de candidature Car na ngai',
                category: 'Candidature véhicule',
                submittedAt: confirmation.submitted_at,
                fields: receiptFields(newApp),
                smsStatus: confirmation.sms_status
            });
        } else if (successMessage) {
            successMessage.classList.remove('hidden');
        }

        if (actualForm) actualForm.reset();
    } catch (error) {
        console.error('Erreur Supabase:', error);
        if(actualForm?.classList.contains('pub-wizard'))actualForm.dispatchEvent(new CustomEvent('gmfleet-error',{detail:error.message||'Envoi interrompu. Vos informations sont conservées. Réessayez.'}));else alert(error.message || 'Envoi interrompu. Réessayez.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    }
}

async function submitServiceForm(e) {
    e.preventDefault();

    const actualForm = document.getElementById('serviceApplicationForm');
    const submitBtn = actualForm ? actualForm.querySelector('button[type="submit"]') : null;
    const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Envoi en cours...';
    }

    const serviceName = document.getElementById('selectedService') ? document.getElementById('selectedService').value : '';
    
    // Extract specific data based on service
    let specificData = {};
    if (serviceName === 'Chauffeur Yango') {
        specificData.carModel = document.getElementById('yangoCarModel')?.value || '';
        specificData.carYear = document.getElementById('yangoCarYear')?.value || '';
        specificData.permisRectoFileName = document.getElementById('yangoPermisRecto')?.files[0]?.name || '';
        specificData.permisVersoFileName = document.getElementById('yangoPermisVerso')?.files[0]?.name || '';
        specificData.permisFileName = specificData.permisRectoFileName;
        specificData.carteRoseFileName = document.getElementById('yangoCarteRose')?.files[0]?.name || '';
    } else if (serviceName === 'Gestion de flotte') {
        specificData.email = document.getElementById('flotteEmail')?.value || '';
        specificData.idNumber = document.getElementById('flotteID')?.value || '';
        specificData.carBrand = document.getElementById('flotteCarBrand')?.value || '';
        specificData.carModel = document.getElementById('flotteCarModel')?.value || '';
        specificData.carPlate = document.getElementById('flotteCarPlate')?.value || '';
        specificData.carYear = document.getElementById('flotteCarYear')?.value || '';
        specificData.carChassis = document.getElementById('flotteCarChassis')?.value || '';
        const fleetFileName = id => document.getElementById(id)?.files[0]?.name || '';
        specificData.carteRoseFileName = fleetFileName('flotteCarteRose');
        specificData.transportAuthorizationFileName = fleetFileName('flotteAutorisationTransport');
        specificData.vignetteFileName = fleetFileName('flotteVignette');
        specificData.insuranceFileName = fleetFileName('flotteAssurance');
        specificData.technicalInspectionFileName = fleetFileName('flotteControleTechnique');
        specificData.frontPhotoFileName = fleetFileName('flottePhotoAvant');
        specificData.rearPhotoFileName = fleetFileName('flottePhotoArriere');
        specificData.leftPhotoFileName = fleetFileName('flottePhotoGauche');
        specificData.rightPhotoFileName = fleetFileName('flottePhotoDroite');
        specificData.interiorPhotoFileName = fleetFileName('flottePhotoInterieur');
        specificData.photosCount = ['flottePhotoAvant','flottePhotoArriere','flottePhotoGauche','flottePhotoDroite','flottePhotoInterieur'].filter(id=>fleetFileName(id)).length;
    } else if (serviceName === 'Recrutement' || serviceName === 'Recrutement Chauffeur') {
        specificData.experience = document.getElementById('recrutementExperience')?.value || document.getElementById('applicantExperience')?.value || '';
        specificData.permisRectoFileName = document.getElementById('recrutementPermisRecto')?.files[0]?.name || '';
        specificData.permisVersoFileName = document.getElementById('recrutementPermisVerso')?.files[0]?.name || '';
        specificData.permisFileName = specificData.permisRectoFileName || document.getElementById('applicantDocument')?.files[0]?.name || '';
        specificData.cvFileName = document.getElementById('recrutementCV')?.files[0]?.name || '';
    }

    const newApp = {
        name: document.getElementById('applicantName')?.value.trim() || [document.getElementById('applicantFirstName')?.value.trim(), document.getElementById('applicantLastName')?.value.trim()].filter(Boolean).join(' '),
        phone: congolesePhone(document.getElementById('applicantPhone')?.value),
        address: document.getElementById('applicantAddress')?.value.trim() || document.getElementById('applicantCommune')?.value.trim() || '',
        service: serviceName,
        ...specificData,
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'En attente',
        type: 'service'
    };

    try {
        const confirmation = await sendPublicApplication(newApp,actualForm);

        const successServiceName = document.getElementById('successServiceName');
        if (successServiceName) successServiceName.textContent = serviceName;

        const successModal = document.getElementById('serviceSuccessModalOverlay') || document.getElementById('successModalOverlay');
        if (successModal) {
            successModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            window.GMFleetRequestReceipt?.present(successModal, {
                reference: confirmation.reference,
                title: `Récépissé - ${serviceName}`,
                category: serviceName,
                submittedAt: confirmation.submitted_at,
                fields: receiptFields(newApp),
                smsStatus: confirmation.sms_status
            });
        }

        if (actualForm) actualForm.reset();
        
        // Reset state
        const selOptions = document.getElementById('generalServiceSelect');
        if (selOptions) selOptions.value = "";
        if (selOptions) handleServiceSelect("");
    } catch (error) {
        console.error('Erreur Supabase:', error);
        if(actualForm?.classList.contains('pub-wizard'))actualForm.dispatchEvent(new CustomEvent('gmfleet-error',{detail:error.message||'Envoi interrompu. Vos informations sont conservées. Réessayez.'}));else alert(error.message || 'Envoi interrompu. Réessayez.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Add smooth scrolling for anchor links manually to ensure reliability across browsers
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            // If mobile menu is open, close it when clicking a link
            const menu = document.getElementById('mobileMenu');
            if (menu && !menu.classList.contains('hidden')) {
                menu.classList.add('hidden');
            }
        }
    });
});

window.addEventListener('DOMContentLoaded', () => {
    // Gestion de l'état actif (couleur rouge) pour les onglets de navigation au clic
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Ignorer le bouton "Devenir Chauffeur" qui est déjà rouge avec texte blanc
            if (this.classList.contains('bg-gmfRed') && this.classList.contains('text-white')) return;

            // Retirer l'état actif de tous les onglets
            navLinks.forEach(l => {
                if (l.classList.contains('bg-gmfRed') && l.classList.contains('text-white')) return;
                l.classList.remove('text-gmfRed');
                
                // Rétablir les classes inactives (text-gray-800 pour mobile, text-gray-600 pour desktop)
                if (l.classList.contains('block')) {
                    l.classList.add('text-gray-800', 'hover:text-gmfRed');
                } else {
                    l.classList.add('text-gray-600', 'hover:text-gmfRed');
                }
            });

            // Appliquer l'état actif (rouge) à l'onglet cliqué
            this.classList.remove('text-gray-600', 'text-gray-800', 'hover:text-gmfRed');
            this.classList.add('text-gmfRed');
        });
    });

    // Handle Detail Page Population
    if (window.location.pathname.includes('detail-vehicule.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const carKey = urlParams.get('car');

        if (carKey && carsData[carKey]) {
            // Set the general select so the user sees it reflected
            const selOptions = document.getElementById('generalVehicleSelect');
            if (selOptions) selOptions.value = carKey;

            // Populate the specific data and auto-show the form
            handleGeneralVehicleSelect(carKey);
        }
    }

    if (window.location.pathname.includes('detail-service.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const serviceKey = urlParams.get('service');

        if (serviceKey) {
            if (serviceKey.toLowerCase().includes('recrutement')) {
                window.location.href = 'recrutement-chauffeurs.html';
                return;
            } else if (serviceKey.toLowerCase().includes('flotte')) {
                window.location.href = 'gestion-flotte.html';
                return;
            } else if (serviceKey.toLowerCase().includes('yango') || serviceKey.toLowerCase().includes('agrégateur')) {
                window.location.href = 'agregateur-yango.html';
                return;
            }
        }

        if (serviceKey && servicesData[serviceKey]) {
            const selOptions = document.getElementById('generalServiceSelect');
            if (selOptions) selOptions.value = serviceKey;

            handleServiceSelect(serviceKey);
        }
    }

    // Pré-remplir le formulaire de contact si un service est sélectionné
    if (window.location.pathname.includes('apropos.html') || window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const service = urlParams.get('service');
        
        if (service) {
            const sujetInput = document.getElementById('contactSujet');
            if (sujetInput) {
                sujetInput.value = "Demande d'information - " + service;
            }
        }
    }
});// A public entry point; individual contracts are accessed only through private payment links.
document.addEventListener('DOMContentLoaded',()=>{if(/login|admin|set-password|payer/.test(location.pathname)||document.querySelector('link[href*="public-ui"]'))return;const a=document.createElement('a');a.href='/payer.html';a.textContent='Payer mon versement';a.style.cssText='position:fixed;right:20px;bottom:22px;background:#d83d3a;color:white;padding:14px 20px;border-radius:30px;box-shadow:0 4px 18px #0003;z-index:45;text-decoration:none;font:600 14px sans-serif';document.body.append(a);});
