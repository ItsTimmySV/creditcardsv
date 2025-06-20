import { getCards, saveCards, formatCurrency, setupModalClose } from './utils.js';
import { renderAppContent, renderSummary, createTransactionRowHtml, createInstallmentItemHtml, setupTransactionActionListeners, setupInstallmentActionListeners, setupInstallmentDeleteActionListeners } from './render.js';
import { setupCardModal, setupTransactionModal } from './modals.js';
import { setupThemeSwitcher, setupDataImportExport } from './theme-import-export.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const body = document.body;
    const cardModal = document.getElementById('card-modal');
    const transactionModal = document.getElementById('transaction-modal');
    const cardForm = document.getElementById('card-form');
    const transactionForm = document.getElementById('transaction-form');
    const cardsContainer = document.getElementById('cards-container'); // Now displays single card
    const sidebarCardList = document.getElementById('sidebar-card-list'); // New: for sidebar card list
    const cardTemplate = document.getElementById('card-template');
    const noCardsMessage = document.getElementById('no-cards-message');
    const selectCardMessage = document.getElementById('select-card-message'); // New: message to select card
    const themeSwitcher = document.getElementById('theme-switcher');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const installmentsGroup = document.getElementById('installments-group');
    const typeSelect = document.getElementById('type');
    const totalDebtEl = document.getElementById('total-debt');
    const totalAvailableEl = document.getElementById('total-available');
    const totalLimitEl = document.getElementById('total-limit');
    const menuToggle = document.getElementById('menu-toggle'); // New: Hamburger menu
    const addCardBtnSidebar = document.getElementById('add-card-btn-sidebar'); // New: Add card button in sidebar

    // NEW Modal elements
    const transactionDetailModal = document.getElementById('transaction-detail-modal');
    const transactionDetailTableBody = document.getElementById('modal-transactions-table-body');
    const transactionDetailCardAlias = document.getElementById('transaction-card-alias');
    const transactionDetailCardIdInput = document.getElementById('transaction-detail-card-id');
    const noTransactionsMessage = document.getElementById('no-transactions-message');

    const installmentDetailModal = document.getElementById('installment-detail-modal');
    const installmentDetailList = document.getElementById('modal-installments-list');
    const installmentDetailCardAlias = document.getElementById('installment-card-alias');
    const installmentDetailCardIdInput = document.getElementById('installment-detail-card-id');
    const noInstallmentsMessageModal = document.getElementById('no-installments-message-modal');

    // State
    let cards = getCards();
    let selectedCardId = cards.length > 0 ? cards[0].id : null; // New: Track selected card for detail view

    // --- RENDER FUNCTION WRAPPER ---
    // This function orchestrates rendering and saving state after any data change.
    const updateUI = () => {
        renderAppContent(
            cards,
            selectedCardId,
            cardsContainer,
            sidebarCardList,
            cardTemplate,
            noCardsMessage,
            selectCardMessage,
            {
                onDeleteCard: handleDeleteCard,
                onAddTransaction: handleAddTransactionClick,
                onPayInstallment: handlePayInstallment,
                onDeleteTransaction: handleDeleteTransaction,
                onDeleteInstallment: handleDeleteInstallment,
                onCardSelect: handleCardSelection,
                onViewTransactions: handleViewTransactionsClick, // NEW
                onViewInstallments: handleViewInstallmentsClick // NEW
            }
        );
        renderSummary(cards, totalDebtEl, totalAvailableEl, totalLimitEl);
        saveCards(cards); // Save after any operation that modifies cards
    };

    // --- DATA MANIPULATION FUNCTIONS (passed as callbacks to modules) ---
    const handleSaveCard = (newCardData, type) => {
        if (type === 'new') {
            const newId = String(Date.now());
            cards.push({ ...newCardData, id: newId, transactions: [] });
            selectedCardId = newId; // Select the newly added card
        } else {
            // Find and update existing card data
            const index = cards.findIndex(c => c.id === newCardData.id);
            if (index !== -1) {
                cards[index] = { ...cards[index], ...newCardData };
                selectedCardId = newCardData.id; // Ensure the edited card remains selected
            }
        }
        updateUI();
        closeSidebar(); // Close sidebar after adding/editing a card
    };

    const handleDeleteCard = (cardId) => {
        cards = cards.filter(c => c.id !== cardId);
        if (selectedCardId === cardId) {
            selectedCardId = cards.length > 0 ? cards[0].id : null; // Select first card or null if no cards left
        }
        updateUI();
        // If the deleted card's modals were open, close them
        if (transactionDetailModal.open && transactionDetailCardIdInput.value === cardId) {
            transactionDetailModal.close();
        }
        if (installmentDetailModal.open && installmentDetailCardIdInput.value === cardId) {
            installmentDetailModal.close();
        }
    };

    const handleSaveTransaction = (cardId, transactionData) => {
        const card = cards.find(c => c.id === cardId);
        if (card) {
            card.transactions.push(transactionData);
        } else {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada. Por favor, intente de nuevo.');
        }
        updateUI();
        // Refresh the detail modal if it's open for this card
        if (transactionDetailModal.open && transactionDetailCardIdInput.value === cardId) {
            refreshTransactionDetailModal(cardId);
        }
        if (installmentDetailModal.open && installmentDetailCardIdInput.value === cardId) {
            refreshInstallmentDetailModal(cardId);
        }
    };

    const handlePayInstallment = (cardId, installmentId) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada.');
            return;
        }

        const installment = card.transactions.find(tx => tx.id === installmentId && tx.type === 'installment_purchase');
        if (!installment) {
            console.error('Installment not found for ID:', installmentId);
            alert('Error: No se pudo encontrar la compra a plazo.');
            return;
        }

        if (installment.paidMonths >= installment.months) {
            alert('Esta compra a plazo ya está pagada en su totalidad.');
            return;
        }

        if (confirm(`¿Confirmar pago de ${formatCurrency(installment.monthlyPayment)} para "${installment.description}" (Mes ${installment.paidMonths + 1}/${installment.months})?`)) {
            installment.paidMonths++;
            installment.remainingAmount -= installment.monthlyPayment;
            if (installment.remainingAmount < 0.01) installment.remainingAmount = 0; // Prevent negative floating point errors

            // Add a new 'payment' transaction to the card's general transaction list
            const paymentTx = {
                id: crypto.randomUUID(), // Unique ID
                type: 'payment',
                date: new Date().toISOString().split('T')[0], // Payment date is today
                description: `Pago MSI: ${installment.description.split(' (Mes')[0]} (${installment.paidMonths}/${installment.months})`,
                amount: installment.monthlyPayment,
                relatedInstallmentId: installment.id // Link to original installment
            };
            card.transactions.push(paymentTx);
            updateUI();
            alert('Pago registrado con éxito!');

            // Refresh the installment detail modal if it's open for this card
            if (installmentDetailModal.open && installmentDetailCardIdInput.value === cardId) {
                refreshInstallmentDetailModal(cardId);
            }
            // Also refresh transaction detail modal if it's open for this card (due to new payment tx)
            if (transactionDetailModal.open && transactionDetailCardIdInput.value === cardId) {
                refreshTransactionDetailModal(cardId);
            }
        }
    };

    const handleDeleteTransaction = (cardId, transactionId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede rehacer.')) {
            return;
        }

        const card = cards.find(c => c.id === cardId);
        if (card) {
            const initialLength = card.transactions.length;
            // Filter out the transaction by its ID
            card.transactions = card.transactions.filter(tx => tx.id !== transactionId);

            if (card.transactions.length < initialLength) {
                alert('Movimiento eliminado con éxito.');
                updateUI(); // Re-render the UI
                // If the transaction detail modal is open for this card, refresh its content
                if (transactionDetailModal.open && transactionDetailCardIdInput.value === cardId) {
                    refreshTransactionDetailModal(cardId);
                }
            } else {
                alert('Error: No se pudo encontrar el movimiento.');
            }
        } else {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada para eliminar el movimiento.');
        }
    };

    const handleDeleteInstallment = (cardId, installmentId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta compra a plazo y todos los pagos asociados a ella? Esta acción no se puede rehacer.')) {
            return;
        }

        const card = cards.find(c => c.id === cardId);
        if (card) {
            const initialLength = card.transactions.length;
            // Filter out the installment purchase itself AND any payments related to it
            card.transactions = card.transactions.filter(tx => 
                tx.id !== installmentId && tx.relatedInstallmentId !== installmentId
            );

            if (card.transactions.length < initialLength) {
                alert('Compra a plazo y movimientos asociados eliminados con éxito.');
                updateUI();
                // If the installment detail modal is open for this card, refresh its content
                if (installmentDetailModal.open && installmentDetailCardIdInput.value === cardId) {
                    refreshInstallmentDetailModal(cardId);
                }
                // Also refresh transaction detail modal if it's open (due to removed payment txs)
                if (transactionDetailModal.open && transactionDetailCardIdInput.value === cardId) {
                    refreshTransactionDetailModal(cardId);
                }
            } else {
                alert('Error: No se pudo encontrar la compra a plazo.');
            }
        } else {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada para eliminar la compra a plazo.');
        }
    };

    const handleImportSuccess = (importedData) => {
        cards = importedData;
        selectedCardId = cards.length > 0 ? cards[0].id : null; // Select first card after import
        updateUI();
    };

    // New: Handle card selection from sidebar
    const handleCardSelection = (cardId) => {
        selectedCardId = cardId;
        updateUI();
        closeSidebar(); // Close sidebar after selecting a card on mobile
    };

    // Callback to pass to render.js for opening transaction modal
    let addTransactionModalCallback = null;
    const handleAddTransactionClick = (cardId) => {
        if (addTransactionModalCallback) {
            addTransactionModalCallback(cardId);
        }
    };

    // New: Callback to store the function that opens the card modal
    let openCardModalCallback = null;

    // NEW: Functions to handle opening and rendering Transaction/Installment Details Modals
    const refreshTransactionDetailModal = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return;

        transactionDetailCardAlias.textContent = card.alias;
        transactionDetailCardIdInput.value = card.id;

        const transactionsForDisplay = [...card.transactions]
            .filter(tx => tx.type !== 'installment_purchase') // Exclude raw installment purchases
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, most recent first

        transactionDetailTableBody.innerHTML = transactionsForDisplay.map(tx => createTransactionRowHtml(tx, card.id)).join('');

        if (transactionsForDisplay.length === 0) {
            noTransactionsMessage.classList.remove('hidden');
        } else {
            noTransactionsMessage.classList.add('hidden');
        }

        // Re-attach listeners for delete buttons within the modal content
        setupTransactionActionListeners(transactionDetailTableBody, handleDeleteTransaction);
    };

    const handleViewTransactionsClick = (cardId) => {
        refreshTransactionDetailModal(cardId);
        transactionDetailModal.showModal();
    };

    const refreshInstallmentDetailModal = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return;

        installmentDetailCardAlias.textContent = card.alias;
        installmentDetailCardIdInput.value = card.id;

        const installmentPurchases = card.transactions.filter(tx => tx.type === 'installment_purchase');

        installmentDetailList.innerHTML = installmentPurchases.map(inst => createInstallmentItemHtml(inst, card.id)).join('');

        if (installmentPurchases.length === 0) {
            noInstallmentsMessageModal.classList.remove('hidden');
        } else {
            noInstallmentsMessageModal.classList.add('hidden');
        }

        // Re-attach listeners for installment action buttons within the modal content
        setupInstallmentActionListeners(installmentDetailList, handlePayInstallment);
        setupInstallmentDeleteActionListeners(installmentDetailList, handleDeleteInstallment);
    };

    const handleViewInstallmentsClick = (cardId) => {
        refreshInstallmentDetailModal(cardId);
        installmentDetailModal.showModal();
    };

    // --- SIDEBAR TOGGLE ---
    const toggleSidebar = () => {
        body.classList.toggle('sidebar-open');
    };

    const closeSidebar = () => {
        body.classList.remove('sidebar-open');
    };

    // Close sidebar if clicking outside (on desktop sizes, this won't happen)
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const menuButton = document.getElementById('menu-toggle');
        // Check if click is outside sidebar AND not on menu toggle, and sidebar is open
        if (body.classList.contains('sidebar-open') && 
            !sidebar.contains(e.target) && 
            !menuButton.contains(e.target) &&
            window.innerWidth < 768) { // Only for mobile view
            closeSidebar();
        }
    });

    // --- INITIALIZE MODULES ---
    setupCardModal(cardModal, cardForm, handleSaveCard, (callback) => {
        openCardModalCallback = callback; // Store the callback from modals.js
    });
    setupTransactionModal(transactionModal, transactionForm, installmentsGroup, typeSelect, handleSaveTransaction, (callback) => {
        addTransactionModalCallback = callback; // Store the callback from modals.js for later use by render.js
    });
    setupThemeSwitcher(themeSwitcher);
    setupDataImportExport(exportBtn, importBtn, importFile, cards, handleImportSuccess);

    // NEW: Setup close listeners for the new detail modals
    setupModalClose(transactionDetailModal);
    setupModalClose(installmentDetailModal);

    // Event listeners for new UI elements
    menuToggle.addEventListener('click', toggleSidebar);
    addCardBtnSidebar.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback(); // Directly call the stored callback to open the modal
        }
        closeSidebar(); // Close sidebar after attempting to add a card
    });

    // Initial Render
    updateUI();
});