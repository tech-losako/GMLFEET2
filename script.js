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
        img: './img/ist.jpeg',
        pricing: {
            "12": { total: "10 536 $", avance: "1 300 $", week: "203 $" },
            "15": { total: "11 784 $", avance: "1 300 $", week: "181 $" },
            "18": { total: "12 560 $", avance: "1 300 $", week: "161 $" }
        }
    },
    'Blade': {
        name: 'Toyota Blade',
        img: 'https://www.toyota.bj/media/gamme/modeles/images/e24b1bcb758803114be811d3f2d02bd3.png',
        pricing: {
            "12": { total: "11 160 $", avance: "1 400 $", week: "215 $" },
            "15": { total: "12 174 $", avance: "1 400 $", week: "187 $" },
            "18": { total: "13 500 $", avance: "1 400 $", week: "173 $" }
        }
    },
    'Swift': {
        name: 'Suzuki Swift',
        img: 'https://stimg.cardekho.com/images/carexteriorimages/630x420/Maruti/Swift/9226/1755777061785/front-left-side-47.jpg',
        pricing: {
            "12": { total: "9 288 $", avance: "1 100 $", week: "179 $" },
            "15": { total: "10 224 $", avance: "1 100 $", week: "157 $" },
            "18": { total: "11 160 $", avance: "1 100 $", week: "143 $" }
        }
    },
    'Vitz': {
        name: 'Toyota Vitz',
        img: './img/vitz.jpeg',
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
});