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
    'IST': { name: 'Toyota IST', img: './img/ist.jpeg', prix: '6 500 $', acompte: '1 300 $' },
    'Blade': { name: 'Toyota Blade', img: 'https://www.toyota.bj/media/gamme/modeles/images/e24b1bcb758803114be811d3f2d02bd3.png', prix: '7 000 $', acompte: '1 400 $' },
    'Swift': { name: 'Suzuki Swift', img: 'https://stimg.cardekho.com/images/carexteriorimages/630x420/Maruti/Swift/9226/1755777061785/front-left-side-47.jpg', prix: '5 500 $', acompte: '1 100 $' },
    'Vitz': { name: 'Toyota Vitz', img: './img/vitz.jpeg', prix: '5 500 $', acompte: '1 100 $' }
};

function openModal(carKey) {
    window.location.href = `detail-vehicule.html?car=${carKey}`;
}

function openGeneralModal() {
    window.location.href = `detail-vehicule.html`;
}

function handleGeneralVehicleSelect(val) {
    if(!val) {
        showFormBtn.classList.add('hidden');
        document.getElementById('modalCarFeatures').classList.add('hidden');
        document.getElementById('modalCarImg').src = "./img/fleet_white_bg.png";
        document.getElementById('modalCarTitle').textContent = "Sélectionnez un véhicule";
        return;
    }
    const data = carsData[val];
    document.getElementById('modalCarTitle').textContent = data.name;
    document.getElementById('modalCarImg').src = data.img;
    document.getElementById('selectedVehicle').value = data.name;
    document.getElementById('modalValPrix').textContent = data.prix;
    document.getElementById('modalValAcompte').textContent = data.acompte;
    document.getElementById('modalCarFeatures').classList.remove('hidden');
    
    // Auto show form
    showForm();
}

function showForm() {
    // Adjust layout for side-by-side or stacked in detail view
    const appWrapper = document.getElementById('applicationWrapper');
    const noCarWarn = document.getElementById('noCarSelectedWarning');
    const actualForm = document.getElementById('applicationForm');

    if (noCarWarn) noCarWarn.classList.add('hidden');
    if (actualForm) actualForm.classList.remove('hidden');

    // On mobile, scroll to form
    if(window.innerWidth < 1024 && actualForm) {
        setTimeout(() => {
            actualForm.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

function closeModal() {
    // Deprecated
}

function submitForm(e) {
    e.preventDefault();
    
    const carName = document.getElementById('selectedVehicle').value;
    document.getElementById('successCarName').textContent = carName;
    
    // Hide form, show success
    const actualForm = document.getElementById('applicationForm');
    if (actualForm) actualForm.classList.add('hidden');
    if (successMessage) successMessage.classList.remove('hidden');
    
    // Save new application data structure
    const newApp = {
        name: document.getElementById('clientName') ? document.getElementById('clientName').value : 'Client', 
        phone: document.getElementById('clientPhone') ? document.getElementById('clientPhone').value : '',
        address: document.getElementById('clientAddress') ? document.getElementById('clientAddress').value : '',
        experience: document.getElementById('clientExperience') ? document.getElementById('clientExperience').value : '',
        coBorrowerName: document.getElementById('coBorrowerName') ? document.getElementById('coBorrowerName').value : '',
        coBorrowerPhone: document.getElementById('coBorrowerPhone') ? document.getElementById('coBorrowerPhone').value : '',
        coBorrowerAddress: document.getElementById('coBorrowerAddress') ? document.getElementById('coBorrowerAddress').value : '',
        vehicle: carName,
        date: new Date().toLocaleDateString('fr-FR'),
        status: 'En attente'
    };
    
    let applications = JSON.parse(localStorage.getItem('gmfleet_apps') || '[]');
    applications.push(newApp);
    localStorage.setItem('gmfleet_apps', JSON.stringify(applications));
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if(menu) {
        menu.classList.toggle('hidden');
    }
}

// Add smooth scrolling for anchor links manually to ensure reliability across browsers
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if(targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // If mobile menu is open, close it when clicking a link
            const menu = document.getElementById('mobileMenu');
            if(menu && !menu.classList.contains('hidden')) {
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
            if(selOptions) selOptions.value = carKey;
            
            // Populate the specific data and auto-show the form
            handleGeneralVehicleSelect(carKey);
        }
    }
});
