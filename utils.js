export const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00'); // Ensure date is parsed as local time
    return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const saveCards = (cards) => localStorage.setItem('cards', JSON.stringify(cards));

export const getCards = () => JSON.parse(localStorage.getItem('cards')) || [];

// NEW: Utility to set up modal close listeners
export const setupModalClose = (modalElement) => {
    modalElement.addEventListener('click', (e) => {
        if (e.target.matches('.close') || e.target === modalElement) {
            modalElement.close();
        }
    });
};

