import { formatCurrency, formatDate } from './utils.js';
import { calculateCardDetails } from './calculations.js';

// Function to attach event listeners specific to card actions (delete, add transaction, view transactions/installments)
const setupCardActionListeners = (onDeleteCard, onAddTransaction, onCardSelect, onViewTransactions, onViewInstallments) => {
    // Action buttons within the displayed card
    document.querySelectorAll('[data-action="add-transaction"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            onAddTransaction(cardId);
        };
    });
    document.querySelectorAll('[data-action="delete-card"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            if (confirm('¿Estás seguro de que quieres eliminar esta tarjeta y todos sus movimientos?')) {
                onDeleteCard(cardId);
            }
        };
    });
    // NEW: View Transactions button
    document.querySelectorAll('[data-action="view-transactions"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            onViewTransactions(cardId);
        };
    });
    // NEW: View Installments button
    document.querySelectorAll('[data-action="view-installments"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            onViewInstallments(cardId);
        };
    });

    // Event listeners for sidebar card selection (re-attached on each render)
    document.querySelectorAll('.sidebar-card-item').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            onCardSelect(cardId);
        };
    });
};

// Function to attach event listeners specific to installment payments within a given container
export const setupInstallmentActionListeners = (containerEl, onPayInstallment) => {
    containerEl.querySelectorAll('.pay-installment-btn').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            const installmentId = e.currentTarget.dataset.installmentId;
            onPayInstallment(cardId, installmentId);
        };
    });
};

// Function to attach event listeners specific to transaction deletion within a given container
export const setupTransactionActionListeners = (containerEl, onDeleteTransaction) => {
    containerEl.querySelectorAll('[data-action="delete-transaction"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            const transactionId = e.currentTarget.dataset.transactionId;
            onDeleteTransaction(cardId, transactionId);
        };
    });
};

// NEW: Function to attach event listeners for installment deletion within a given container
export const setupInstallmentDeleteActionListeners = (containerEl, onDeleteInstallment) => {
    containerEl.querySelectorAll('[data-action="delete-installment"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            const installmentId = e.currentTarget.dataset.installmentId;
            onDeleteInstallment(cardId, installmentId);
        };
    });
};

// NEW: Function to generate HTML for a single transaction row
export const createTransactionRowHtml = (tx, cardId) => {
    const amountClass = tx.type === 'payment' ? 'payment-text' : '';
    const formattedAmount = tx.type === 'payment' ? `- ${formatCurrency(tx.amount)}` : formatCurrency(tx.amount);
    
    // Filter out installment_purchase from main transaction list in the modal too
    if (tx.type === 'installment_purchase') return '';

    return `
        <tr>
            <td>${formatDate(tx.date)}</td>
            <td>${tx.description}</td>
            <td class="${amountClass}">${formattedAmount}</td>
            <td>
                <button class="outline contrast small transaction-delete-btn" 
                    data-card-id="${cardId}" 
                    data-transaction-id="${tx.id}"
                    data-action="delete-transaction">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        </tr>
    `;
};

// NEW: Function to generate HTML for a single installment item
export const createInstallmentItemHtml = (inst, cardId) => {
    return `
        <article class="installment-item" data-installment-id="${inst.id}">
            <h6>${inst.description}</h6>
            <div class="grid">
                <div>
                    <small>Monto Original</small>
                    <p>${formatCurrency(inst.totalAmount)}</p>
                </div>
                <div>
                    <small>Mensualidad</small>
                    <p>${formatCurrency(inst.monthlyPayment)}</p>
                </div>
                <div>
                    <small>Pagado / Total Meses</small>
                    <p>${inst.paidMonths} / ${inst.months}</p>
                </div>
                <div>
                    <small>Saldo Restante</small>
                    <p>${formatCurrency(inst.remainingAmount)}</p>
                </div>
            </div>
            <progress value="${inst.paidMonths}" max="${inst.months}"></progress>
            <div class="installment-actions">
                <button class="outline primary small pay-installment-btn" 
                    data-card-id="${cardId}" 
                    data-installment-id="${inst.id}"
                    ${inst.paidMonths >= inst.months ? 'disabled' : ''}>
                    Pagar Mes ${inst.paidMonths + 1}
                </button>
                <button class="outline contrast small installment-delete-btn" 
                    data-card-id="${cardId}" 
                    data-installment-id="${inst.id}"
                    data-action="delete-installment">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        </article>
    `;
};

// Main render function for all content
export const renderAppContent = (cards, selectedCardId, cardsContainer, sidebarCardListEl, cardTemplate, noCardsMessageEl, selectCardMessageEl, callbacks) => {
    // 1. Render Sidebar Card List
    sidebarCardListEl.innerHTML = '';
    cards.forEach(card => {
        const listItem = document.createElement('li');
        const button = document.createElement('button'); // Use button for better a11y
        button.className = `sidebar-card-item ${card.id === selectedCardId ? 'active' : ''}`;
        button.dataset.cardId = card.id;
        button.textContent = card.alias;
        listItem.appendChild(button);
        sidebarCardListEl.appendChild(listItem);
    });

    // 2. Render Selected Card Details or appropriate message
    cardsContainer.innerHTML = ''; // Clear previous card display
    const selectedCard = cards.find(c => c.id === selectedCardId);

    if (cards.length === 0) {
        noCardsMessageEl.classList.remove('hidden');
        selectCardMessageEl.classList.add('hidden');
    } else {
        noCardsMessageEl.classList.add('hidden');
        if (selectedCard) {
            selectCardMessageEl.classList.add('hidden');
            const cardElement = document.importNode(cardTemplate.content, true);
            const details = calculateCardDetails(selectedCard);
            
            cardElement.querySelector('.card').dataset.cardId = selectedCard.id;
            cardElement.querySelector('[data-id="alias"]').textContent = selectedCard.alias;
            cardElement.querySelector('[data-id="bank-last4"]').textContent = `${selectedCard.bank} - **** ${selectedCard.last4}`;
            cardElement.querySelector('[data-id="currentBalance"]').textContent = formatCurrency(details.currentBalance);
            cardElement.querySelector('[data-id="availableCredit"]').textContent = formatCurrency(details.availableCredit);
            cardElement.querySelector('[data-id="limit"]').textContent = formatCurrency(selectedCard.limit);
            cardElement.querySelector('[data-id="credit-progress"]').value = (details.currentBalance / selectedCard.limit) * 100;
            cardElement.querySelector('[data-id="paymentForPeriod"]').textContent = formatCurrency(details.paymentForPeriod);
            cardElement.querySelector('[data-id="nextPayment"]').textContent = formatCurrency(details.nextPayment);
            cardElement.querySelector('[data-id="nextCutoffDate"]').textContent = details.nextCutoffDate;
            cardElement.querySelector('[data-id="paymentDueDate"]').textContent = details.paymentDueDate;

            cardsContainer.appendChild(cardElement);
        } else {
            // No card selected or selected card was deleted
            selectCardMessageEl.classList.remove('hidden');
        }
    }
    // Attach event listeners after rendering all (sidebar items AND current card)
    setupCardActionListeners(
        callbacks.onDeleteCard, 
        callbacks.onAddTransaction, 
        callbacks.onCardSelect,
        callbacks.onViewTransactions, // NEW
        callbacks.onViewInstallments  // NEW
    );
};

// Render summary totals
export const renderSummary = (cards, totalDebtEl, totalAvailableEl, totalLimitEl) => {
    const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
    const totalDebt = cards.reduce((sum, card) => sum + calculateCardDetails(card).currentBalance, 0);
    const totalAvailable = totalLimit - totalDebt;

    totalDebtEl.textContent = formatCurrency(totalDebt);
    totalAvailableEl.textContent = formatCurrency(totalAvailable);
    totalLimitEl.textContent = formatCurrency(totalLimit);
};