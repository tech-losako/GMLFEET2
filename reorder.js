const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');

    // Desktop nav
    // Looking for the block inside <div class="hidden md:flex space-x-8 items-center">
    let desktopRegex = /(<div class="hidden md:flex space-x-8 items-center">\s*)(<a href="index\.html"[^>]*>Accueil<\/a>\s*)(<a href="services\.html"[^>]*>Nos Services<\/a>\s*)(<a href="vehicules\.html"[^>]*>Véhicules<\/a>\s*)(<a href="apropos\.html"[^>]*>À\s*Propos<\/a>\s*)(<a href="apropos\.html#contact"[^>]*>Contact<\/a>\s*)/g;
    
    content = content.replace(desktopRegex, (match, p1, p2, p3, p4, p5, p6) => {
        return p1 + p2 + p5 + p3 + p4 + p6;
    });

    // Desktop nav (variation where class attributes might differ slightly)
    // Actually the above is fairly strict on the outer div but very loose on the a tags, which is good.
    // Let's make it even looser for the wrapper if needed, but in my previous edits I used exactly that wrapper.

    // Mobile nav
    // Looking for the block inside <div class="px-4 pt-4 pb-6 space-y-4">
    let mobileRegex = /(<div class="px-4 pt-4 pb-6 space-y-4">\s*)(<a href="index\.html"[^>]*>Accueil<\/a>\s*)(<a href="services\.html"[^>]*>Nos Services<\/a>\s*)(<a href="vehicules\.html"[^>]*>Véhicules<\/a>\s*)(<a href="apropos\.html"[^>]*>À\s*Propos<\/a>\s*)(<a href="apropos\.html#contact"[^>]*>Contact<\/a>\s*)/g;

    content = content.replace(mobileRegex, (match, p1, p2, p3, p4, p5, p6) => {
        return p1 + p2 + p5 + p3 + p4 + p6;
    });

    // Also some files might have slightly different spaces in the wrapper class
    // Let's do a more general replace just in case:
    let generalDesktopRegex = /(<div class="hidden md:flex space-x-8 items-center">\s*)(<a href="index\.html"[^>]*>Accueil<\/a>\s*)<a href="services\.html"([^>]*)>Nos Services<\/a>(\s*)<a href="vehicules\.html"([^>]*)>Véhicules<\/a>(\s*)<a href="apropos\.html"([^>]*)>À\s*Propos<\/a>(\s*)<a href="apropos\.html#contact"([^>]*)>Contact<\/a>(\s*)/g;

    let updated = false;
    if (content.match(desktopRegex) || content.match(mobileRegex)) {
        updated = true;
    }

    if (updated) {
        fs.writeFileSync(path.join(dir, file), content, 'utf8');
        console.log(`Updated ${file}`);
    } else {
        // Fallback for files that didn't match perfectly.
        // Let's use an even simpler replacement that doesn't care about the wrapper.
        // We look for the sequence of 5 links.
        let sequenceRegex = /(<a href="index\.html"[^>]*>Accueil<\/a>\s*)(<a href="services\.html"[^>]*>Nos Services<\/a>\s*)(<a href="vehicules\.html"[^>]*>Véhicules<\/a>\s*)(<a href="apropos\.html"[^>]*>À\s*Propos<\/a>\s*)(<a href="apropos\.html#contact"[^>]*>Contact<\/a>\s*)/g;
        
        if (content.match(sequenceRegex)) {
            content = content.replace(sequenceRegex, (match, p1, p2, p3, p4, p5) => {
                return p1 + p4 + p2 + p3 + p5;
            });
            fs.writeFileSync(path.join(dir, file), content, 'utf8');
            console.log(`Updated ${file} (via sequence regex)`);
        } else {
            console.log(`No match in ${file}`);
        }
    }
});
