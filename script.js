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
    const cardListItemTemplate = document.getElementById('card-list-item-template');
    const noCardsMessage = document.getElementById('no-cards-message');
    const addCardFromEmptyStateBtn = document.getElementById('add-card-from-empty-state');
    const selectCardMessage = document.getElementById('select-card-message'); // New: message to select card
    const themeSwitcher = document.getElementById('theme-switcher');
    const mobileThemeSwitcher = document.getElementById('mobile-theme-switcher');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const installmentsGroup = document.getElementById('installments-group');
    const typeSelect = document.getElementById('type');
    const totalDebtEl = document.getElementById('total-debt');
    const totalAvailableEl = document.getElementById('total-available');
    const totalLimitEl = document.getElementById('total-limit');
    const addCardBtnSidebar = document.getElementById('add-card-btn-sidebar'); // New: Add card button in sidebar
    
    // NEW Mobile Nav Elements
    const mobileNav = document.getElementById('mobile-nav');
    const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
    const mobileAddCardBtn = document.getElementById('mobile-add-card-btn');

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

    // Layout Elements
    const appLayout = document.getElementById('app-layout');
    const mainContentPanel = document.getElementById('main-content-panel');
    const cardListPanel = document.getElementById('card-list-panel');
    const mobileHeaderTitle = document.getElementById('mobile-header-title');

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
            cardListItemTemplate,
            noCardsMessage,
            selectCardMessage,
            {
                onDeleteCard: handleDeleteCard,
                onAddTransaction: handleAddTransactionClick,
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
        // On mobile, switch back to the card list view after adding/editing a card
        if (window.innerWidth < 992) {
            switchMobileView('cards');
        }
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
        
        // NEW: Prompt for payment date
        const todayStr = new Date().toISOString().split('T')[0];
        const paymentDateStr = prompt(`¿En qué fecha se realizó el pago de ${formatCurrency(installment.monthlyPayment)}?\n(Mes ${installment.paidMonths + 1}/${installment.months})`, todayStr);

        if (!paymentDateStr) return; // User cancelled prompt

        // Basic validation for the date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDateStr)) {
            alert("Formato de fecha inválido. Por favor usa AAAA-MM-DD.");
            return;
        }

        if (confirm(`¿Confirmar pago con fecha ${paymentDateStr}?`)) {
            installment.paidMonths++;
            installment.remainingAmount -= installment.monthlyPayment;
            if (installment.remainingAmount < 0.01) installment.remainingAmount = 0; // Prevent negative floating point errors

            // Add a new 'payment' transaction to the card's general transaction list
            const paymentTx = {
                id: crypto.randomUUID(), // Unique ID
                type: 'payment',
                date: paymentDateStr, // Use user-provided date
                description: `Pago MSI: ${installment.description} (${installment.paidMonths}/${installment.months})`,
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
            const transactionToDelete = card.transactions.find(tx => tx.id === transactionId);
            if (!transactionToDelete) {
                alert('Error: No se pudo encontrar el movimiento.');
                return;
            }

            // If this is an installment payment, reverse the changes on the parent installment object.
            if (transactionToDelete.type === 'payment' && transactionToDelete.relatedInstallmentId) {
                const parentInstallment = card.transactions.find(tx => tx.id === transactionToDelete.relatedInstallmentId);
                if (parentInstallment) {
                    parentInstallment.paidMonths--;
                    parentInstallment.remainingAmount += parentInstallment.monthlyPayment;
                     // Clamp the value to the total amount to prevent floating point inaccuracies from making it larger
                    if (parentInstallment.remainingAmount > parentInstallment.totalAmount) {
                        parentInstallment.remainingAmount = parentInstallment.totalAmount;
                    }
                }
            }

            // Filter out the transaction by its ID
            card.transactions = card.transactions.filter(tx => tx.id !== transactionId);

            alert('Movimiento eliminado con éxito.');
            updateUI(); // Re-render the UI and save state

            // If the transaction detail modal is open for this card, refresh its content
            if (transactionDetailModal.open && transactionDetailCardIdInput.value === cardId) {
                refreshTransactionDetailModal(cardId);
            }
            // Also refresh the installment detail modal as its state has changed
            if (installmentDetailModal.open && installmentDetailCardIdInput.value === cardId) {
                refreshInstallmentDetailModal(cardId);
            }
            
        } else {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada para eliminar el movimiento.');
        }
    };

    const handleDeleteInstallment = (cardId, installmentId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta compra a plazo y todos los pagos asociados?')) {
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
                alert('Compra a plazo y movimientos asociados eliminados.');
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
        if (window.innerWidth < 992) {
            switchMobileView('home');
        }
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

    // --- Mobile Navigation Logic ---
    const switchMobileView = (view) => {
        appLayout.dataset.view = view;
        mobileNavBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        mobileHeaderTitle.textContent = view === 'home' ? 'Resumen' : 'Mis Tarjetas';
        window.scrollTo(0, 0); // Scroll to top on view change
    };

    mobileNavBtns.forEach(btn => {
        btn.addEventListener('click', () => switchMobileView(btn.dataset.view));
    });
    
    addCardFromEmptyStateBtn.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback(); // Open 'add card' modal
        }
    });

    mobileAddCardBtn.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback(); // Open 'add card' modal
        }
    });

    // NEW: Setup close listeners for the new detail modals
    setupModalClose(transactionDetailModal);
    setupModalClose(installmentDetailModal);

    // Event listeners for new UI elements
    addCardBtnSidebar.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback(); // Directly call the stored callback to open the modal
        }
    });

    // NEW: Add event listener for modal close buttons
    document.querySelectorAll('dialog').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.close') || e.target.hasAttribute('data-close-modal')) {
                modal.close();
            }
        });
    });

    // --- INITIALIZE MODULES ---
    setupCardModal(cardModal, cardForm, handleSaveCard, (callback) => {
        openCardModalCallback = callback; // Store the callback from modals.js
    });
    setupTransactionModal(transactionModal, transactionForm, installmentsGroup, typeSelect, handleSaveTransaction, (callback) => {
        addTransactionModalCallback = callback; // Store the callback from modals.js for later use by render.js
    });
    setupThemeSwitcher(themeSwitcher);
    setupThemeSwitcher(mobileThemeSwitcher);
    setupDataImportExport(exportBtn, importBtn, importFile, () => cards, handleImportSuccess);

    // Initial Render
    switchMobileView('home'); // Set initial view for mobile
    updateUI();
});