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
        img: './img/ist 1.jpg',
        pricing: {
            "12": { total: "10 536 $", avance: "1 300 $", week: "203 $" },
            "15": { total: "11 784 $", avance: "1 300 $", week: "181 $" },
            "18": { total: "12 560 $", avance: "1 300 $", week: "161 $" }
        }
    },
    'Blade': {
        name: 'Toyota Blade',
        img: './img/blade 1.jpg',
        pricing: {
            "12": { total: "11 160 $", avance: "1 400 $", week: "215 $" },
            "15": { total: "12 174 $", avance: "1 400 $", week: "187 $" },
            "18": { total: "13 500 $", avance: "1 400 $", week: "173 $" }
        }
    },
    'Swift': {
        name: 'Suzuki Swift',
        img: './img/swift 1.jpg',
        pricing: {
            "12": { total: "9 288 $", avance: "1 100 $", week: "179 $" },
            "15": { total: "10 224 $", avance: "1 100 $", week: "157 $" },
            "18": { total: "11 160 $", avance: "1 100 $", week: "143 $" }
        }
    },
    'Vitz': {
        name: 'Toyota Vitz',
        img: './img/vitz 1.jpg',
        pricing: {
            "12": { total: "9 288 $", avance: "1 100 $", week: "179 $" },
            "15": { total: "10 224 $", avance: "1 100 $", week: "157 $" },
            "18": { total: "11 160 $", avance: "1 100 $", week: "143 $" }
        }
    }
};

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
        document.getElementById('yangoPermis')?.setAttribute('required', 'true');
    } else if (val === 'Gestion de flotte') {
        if (fFlotte) fFlotte.classList.remove('hidden');
        document.getElementById('flotteCarModel')?.setAttribute('required', 'true');
        document.getElementById('flotteCarState')?.setAttribute('required', 'true');
    } else if (val === 'Recrutement') {
        if (fRecrutement) fRecrutement.classList.remove('hidden');
        document.getElementById('recrutementExperience')?.setAttribute('required', 'true');
        document.getElementById('recrutementPermis')?.setAttribute('required', 'true');
    }

    if (noServiceWarn) noServiceWarn.classList.add('hidden');
    if (form) {
        form.classList.remove('hidden');
        if (window.innerWidth < 1024) {
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

    const data = carsData[val];
    if (!data) return;

    // Default to 12 if no duration specifically selected yet
    const durContainer = document.getElementById('planDuration');
    const selectedDuration = durContainer && durContainer.value ? durContainer.value : "12";

    const pricing = data.pricing[selectedDuration];
    if (pricing) {
        const totalEl = document.getElementById('modalValPrix');
        const advanceEl = document.getElementById('modalValAcompte');
        const semaineEl = document.getElementById('modalValSemaine');

        if (totalEl) totalEl.textContent = pricing.total;
        if (advanceEl) advanceEl.textContent = pricing.avance;
        if (semaineEl) semaineEl.textContent = pricing.week;
    }
}

function showForm() {
    // Adjust layout for side-by-side or stacked in detail view
    const noCarWarn = document.getElementById('noCarSelectedWarning');
    const actualForm = document.getElementById('applicationForm');

    if (noCarWarn) noCarWarn.classList.add('hidden');
    if (actualForm) actualForm.classList.remove('hidden');

    // On mobile, scroll to form
    if (window.innerWidth < 1024 && actualForm) {
        setTimeout(() => {
            actualForm.scrollIntoView({ behavior: 'smooth' });
        }, 100);
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
    const licenseInput = document.getElementById('clientPermisUpload');

    const newApp = {
        name: document.getElementById('clientName') ? document.getElementById('clientName').value.trim() : 'Client',
        phone: document.getElementById('clientPhone') ? document.getElementById('clientPhone').value.trim() : '',
        address: document.getElementById('clientAddress') ? document.getElementById('clientAddress').value.trim() : '',
        experience: document.getElementById('clientExperience') ? document.getElementById('clientExperience').value : '',
        coBorrowerName: document.getElementById('coBorrowerName') ? document.getElementById('coBorrowerName').value.trim() : '',
        coBorrowerPhone: document.getElementById('coBorrowerPhone') ? document.getElementById('coBorrowerPhone').value.trim() : '',
        coBorrowerAddress: document.getElementById('coBorrowerAddress') ? document.getElementById('coBorrowerAddress').value.trim() : '',
        duration: document.getElementById('planDuration') ? document.getElementById('planDuration').value : '',
        vehicle: carName,
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'En attente',
        licenseFileName: licenseInput && licenseInput.files.length ? licenseInput.files[0].name : ''
    };

    try {
        if (window.GMFleetBackend?.isConfigured()) {
            await window.GMFleetBackend.createApplication(newApp);
        } else {
            let applications = JSON.parse(localStorage.getItem('gmfleet_apps') || '[]');
            applications.push({ id: Date.now(), ...newApp });
            localStorage.setItem('gmfleet_apps', JSON.stringify(applications));
        }

        const successCarName = document.getElementById('successCarName');
        if (successCarName) successCarName.textContent = carName;

        const successModal = document.getElementById('successModalOverlay');
        if (successModal) {
            successModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else if (successMessage) {
            successMessage.classList.remove('hidden');
        }

        if (actualForm) actualForm.reset();
    } catch (error) {
        console.error('Erreur Supabase:', error);
        alert("Impossible d'envoyer la candidature pour le moment. Vérifiez la configuration Supabase ou réessayez.");
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
        specificData.permisFileName = document.getElementById('yangoPermis')?.files[0]?.name || '';
        specificData.carteRoseFileName = document.getElementById('yangoCarteRose')?.files[0]?.name || '';
    } else if (serviceName === 'Gestion de flotte') {
        specificData.carModel = document.getElementById('flotteCarModel')?.value || '';
        specificData.carState = document.getElementById('flotteCarState')?.value || '';
        specificData.carteRoseFileName = document.getElementById('flotteCarteRose')?.files[0]?.name || '';
        specificData.photosCount = document.getElementById('flottePhotos')?.files?.length || 0;
    } else if (serviceName === 'Recrutement') {
        specificData.experience = document.getElementById('recrutementExperience')?.value || '';
        specificData.permisFileName = document.getElementById('recrutementPermis')?.files[0]?.name || '';
        specificData.cvFileName = document.getElementById('recrutementCV')?.files[0]?.name || '';
    }

    const newApp = {
        name: document.getElementById('applicantName') ? document.getElementById('applicantName').value.trim() : 'Client',
        phone: document.getElementById('applicantPhone') ? document.getElementById('applicantPhone').value.trim() : '',
        address: document.getElementById('applicantAddress') ? document.getElementById('applicantAddress').value.trim() : '',
        service: serviceName,
        ...specificData,
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'En attente',
        type: 'service'
    };

    try {
        if (window.GMFleetBackend?.isConfigured()) {
            await window.GMFleetBackend.createApplication(newApp); // Or a specific createServiceApplication function if needed
        } else {
            let applications = JSON.parse(localStorage.getItem('gmfleet_service_apps') || '[]');
            applications.push({ id: Date.now(), ...newApp });
            localStorage.setItem('gmfleet_service_apps', JSON.stringify(applications));
        }

        const successServiceName = document.getElementById('successServiceName');
        if (successServiceName) successServiceName.textContent = serviceName;

        const successModal = document.getElementById('serviceSuccessModalOverlay');
        if (successModal) {
            successModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        if (actualForm) actualForm.reset();
        
        // Reset state
        const selOptions = document.getElementById('generalServiceSelect');
        if (selOptions) selOptions.value = "";
        handleServiceSelect("");
    } catch (error) {
        console.error('Erreur Supabase:', error);
        alert("Impossible d'envoyer la candidature pour le moment. Réessayez.");
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
});