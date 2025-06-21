// This module handles theme switching and data import/export functionality.

export const setupThemeSwitcher = (themeSwitcher) => {
    // NEW: Icons are now defined as SVGs within the button's innerHTML
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    const updateTheme = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (themeSwitcher) {
             themeSwitcher.innerHTML = currentTheme === 'dark' ? sunIcon : moonIcon;
        }
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', currentTheme === 'dark' ? '#111827' : '#ffffff');
        }
    };
    
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            // We need to update all theme switchers on the page
            document.dispatchEvent(new CustomEvent('themechange'));
        });
    }

    // Listen for a custom event to sync all theme switchers
    document.addEventListener('themechange', updateTheme);
    
    // Set initial icon
    updateTheme();
};

export const setupDataImportExport = (exportBtn, importBtn, importFile, getCardsRef, onImportSuccess) => {
    exportBtn.addEventListener('click', () => {
        const cards = getCardsRef();
        if (cards.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }
        const dataStr = JSON.stringify(cards, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `credit-card-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                     if(confirm('Esto reemplazará todos tus datos actuales. ¿Estás seguro?')){
                        onImportSuccess(importedData); // Callback to update and re-render main state
                        alert('¡Datos importados con éxito!');
                    }
                } else {
                    throw new Error('Formato de archivo no válido.');
                }
            } catch (error) {
                alert('Error al importar el archivo. Asegúrate de que es un archivo de respaldo válido.');
                console.error("Import error:", error);
            }
        };
        reader.readAsText(file);
        importFile.value = ''; // Reset for next import
    });
};