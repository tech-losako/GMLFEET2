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
    const data = carsData[carKey];
    if(!data) return;

    // Set the data
    document.getElementById('modalCarTitle').textContent = data.name;
    document.getElementById('modalCarImg').src = data.img;
    document.getElementById('selectedVehicle').value = data.name;
    document.getElementById('modalValPrix').textContent = data.prix;
    document.getElementById('modalValAcompte').textContent = data.acompte;
    
    // Hide general select if it was open
    const generalSelectContainer = document.getElementById('generalVehicleSelectContainer');
    if(generalSelectContainer) generalSelectContainer.classList.add('hidden');
    const featuresContainer = document.getElementById('modalCarFeatures');
    if(featuresContainer) featuresContainer.classList.remove('hidden');
    
    // Reset form states and visibility
    appForm.reset();
    appForm.classList.remove('hidden');
    successMessage.classList.add('hidden');

    // Make modal info full width initially, hide form
    modalInfoPart.className = "w-full bg-gray-50 p-8 flex flex-col items-center justify-center border-r border-gray-100 transition-all duration-300";
    modalFormPart.classList.add('hidden');
    modalFormPart.classList.remove('w-full', 'md:w-7/12');
    showFormBtn.classList.remove('hidden');
    
    // Show modal container
    modal.classList.remove('hidden');
    
    // Trigger animations (slight delay to allow display:block to apply)
    setTimeout(() => {
        modalBackdrop.classList.remove('opacity-0');
        modalBackdrop.classList.add('opacity-100');
        
        modalPanel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modalPanel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
}

function openGeneralModal() {
    // Reset form states and visibility
    appForm.reset();
    appForm.classList.remove('hidden');
    successMessage.classList.add('hidden');

    // General state
    document.getElementById('modalCarTitle').textContent = "Sélectionnez un véhicule";
    document.getElementById('modalCarImg').src = "./img/fleet_white_bg.png"; 
    document.getElementById('selectedVehicle').value = "";
    
    document.getElementById('generalVehicleSelectContainer').classList.remove('hidden');
    document.getElementById('generalVehicleSelect').value = "";
    
    document.getElementById('modalCarFeatures').classList.add('hidden');
    showFormBtn.classList.add('hidden');
    
    // Make modal info full width initially, hide form
    modalInfoPart.className = "w-full bg-gray-50 p-8 flex flex-col items-center justify-center border-r border-gray-100 transition-all duration-300";
    modalFormPart.classList.add('hidden');
    modalFormPart.classList.remove('w-full', 'md:w-7/12');
    
    // Show modal container
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modalBackdrop.classList.remove('opacity-0');
        modalBackdrop.classList.add('opacity-100');
        
        modalPanel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modalPanel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);
    
    document.body.style.overflow = 'hidden';
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
    // Adjust layout for side-by-side or stacked
    modalInfoPart.className = "w-full md:w-5/12 bg-gray-50 p-4 md:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 transition-all duration-300";
    modalFormPart.classList.remove('hidden');
    modalFormPart.classList.add('w-full', 'md:w-7/12');
    showFormBtn.classList.add('hidden');

    // On mobile, scroll to form
    if(window.innerWidth < 768) {
        setTimeout(() => {
            modalFormPart.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

function closeModal() {
    // Animate out
    modalBackdrop.classList.remove('opacity-100');
    modalBackdrop.classList.add('opacity-0');
    
    modalPanel.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    modalPanel.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    
    // Hide modal container after animation
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Restore scroll
    }, 300);
}

function submitForm(e) {
    e.preventDefault();
    
    const carName = document.getElementById('selectedVehicle').value;
    document.getElementById('successCarName').textContent = carName;
    
    // Hide form, show success
    appForm.classList.add('hidden');
    successMessage.classList.remove('hidden');
    
    // Optional fake "save to local storage" for the admin panel to read
    const newApp = {
        name: document.getElementById('clientName') ? document.getElementById('clientName').value : 'Client', 
        phone: appForm.querySelectorAll('input[type="tel"]')[0]?.value || '',
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
    if(window.location.search.includes('apply=true') && document.getElementById('vehicleModal')) {
        openGeneralModal();
    }
});
