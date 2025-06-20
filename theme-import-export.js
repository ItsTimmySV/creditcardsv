// This module handles theme switching and data import/export functionality.

export const setupThemeSwitcher = (themeSwitcher) => {
    themeSwitcher.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeSwitcher.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
};

export const setupDataImportExport = (exportBtn, importBtn, importFile, cardsRef, onImportSuccess) => {
    exportBtn.addEventListener('click', () => {
        if (cardsRef.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }
        const dataStr = JSON.stringify(cardsRef, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `credit-card-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
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
            }
        };
        reader.readAsText(file);
        importFile.value = ''; // Reset for next import
    });
};