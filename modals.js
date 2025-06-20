// This module contains logic for handling card and transaction modals and forms.

export const setupCardModal = (cardModal, cardForm, onSaveCard, setAddCardModalCallback) => {
    // Function to open the card modal and reset the form
    const openCardModal = (cardData = null) => {
        cardForm.reset();
        document.getElementById('card-modal-title').textContent = 'Agregar Nueva Tarjeta';
        document.getElementById('card-id').value = ''; // Clear for new card

        if (cardData) {
            // Populate form for editing
            document.getElementById('card-modal-title').textContent = 'Editar Tarjeta';
            document.getElementById('card-id').value = cardData.id;
            document.getElementById('alias').value = cardData.alias;
            document.getElementById('bank').value = cardData.bank;
            document.getElementById('last4').value = cardData.last4;
            document.getElementById('limit').value = cardData.limit;
            document.getElementById('cutoffDay').value = cardData.cutoffDay;
            document.getElementById('paymentDay').value = cardData.paymentDay;
        }
        cardModal.showModal();
    };

    // Provide the openCardModal function to the main script
    setAddCardModalCallback(openCardModal);

    // Card modal close listener
    cardModal.addEventListener('click', (e) => {
        if (e.target.matches('.close') || e.target === cardModal) {
            cardModal.close();
        }
    });

    // Card form submission
    cardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(cardForm);
        const cardId = formData.get('card-id'); // This will be empty for new cards

        const cardData = {
            id: cardId, // Will be empty for new cards, main script will assign
            alias: formData.get('alias'),
            bank: formData.get('bank'),
            last4: formData.get('last4'),
            limit: parseFloat(formData.get('limit')),
            cutoffDay: parseInt(formData.get('cutoffDay')),
            paymentDay: parseInt(formData.get('paymentDay')),
            // Transactions array is initialized in main script
        };

        onSaveCard(cardData, cardId ? 'edit' : 'new'); // Pass type to main script
        cardModal.close();
        cardForm.reset();
    });
};

export const setupTransactionModal = (transactionModal, transactionForm, installmentsGroup, typeSelect, onSaveTransaction, setAddTransactionCallback) => {
    // Transaction modal close listener
    transactionModal.addEventListener('click', (e) => {
        if (e.target.matches('.close') || e.target === transactionModal) {
            transactionModal.close();
        }
    });

    // This function is provided by the main script to allow render.js to trigger the modal open
    setAddTransactionCallback((cardId) => {
        transactionForm.reset();
        document.getElementById('transaction-card-id').value = cardId;
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        document.getElementById('type').value = 'expense'; // Reset type selection
        installmentsGroup.classList.add('hidden');
        transactionModal.showModal();
    });


    // Toggle installment fields visibility
    typeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'installment') {
            installmentsGroup.classList.remove('hidden');
        } else {
            installmentsGroup.classList.add('hidden');
        }
    });

    // Transaction form submission
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(transactionForm);
        const cardId = formData.get('transaction-card-id');
        const type = formData.get('type');
        const amount = parseFloat(formData.get('amount'));
        const date = formData.get('date');
        const description = formData.get('description');

        let transactionData;
        if (type === 'installment') {
            const months = parseInt(formData.get('months'));
            const monthlyPayment = amount / months;
            
            transactionData = {
                id: crypto.randomUUID(), // Use crypto.randomUUID() for robust unique IDs
                type: 'installment_purchase', // New type for the original purchase
                date: date,
                description: description,
                totalAmount: amount, // Total amount of the purchase
                months: months, // Total months for the installment
                monthlyPayment: monthlyPayment,
                paidMonths: 0,
                remainingAmount: amount
            };
        } else {
             transactionData = {
                id: crypto.randomUUID(), // Use crypto.randomUUID() for robust unique IDs
                type: type,
                date: date,
                description: description,
                amount: amount
            };
        }
        onSaveTransaction(cardId, transactionData);
        transactionModal.close();
        transactionForm.reset();
    });
};