import { formatDate } from './utils.js';

export const calculateCardDetails = (card) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day
    
    let currentBalance = 0;

    card.transactions.forEach(tx => {
         if (tx.type === 'expense') {
             currentBalance += tx.amount;
         } else if (tx.type === 'payment') {
             currentBalance -= tx.amount;
         } else if (tx.type === 'installment_purchase') {
             // For installment purchases, only the remaining amount contributes to the current balance
             currentBalance += tx.remainingAmount;
         }
    });

    // Calculate current statement cycle dates
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth(); // 0-indexed

    // nextCutoffDate: The date of the next upcoming cutoff.
    // currentStatementCutoffDate: The cutoff date for the statement cycle whose payment is currently due.
    // previousStatementCutoffDate: The cutoff date for the statement cycle *before* currentStatementCutoffDate.

    let nextCutoff = new Date(currentYear, currentMonth, card.cutoffDay);
    let currentStatementCutoff = new Date(currentYear, currentMonth, card.cutoffDay);

    if (today > new Date(currentYear, currentMonth, card.cutoffDay)) {
        // If today is past this month's cutoff, the current statement's cutoff was this month.
        // And the next cutoff is next month.
        nextCutoff.setMonth(nextCutoff.getMonth() + 1);
    } else {
        // If today is before or on this month's cutoff, the current statement's cutoff was last month.
        // And the next cutoff is this month.
        currentStatementCutoff.setMonth(currentStatementCutoff.getMonth() - 1);
        nextCutoff = new Date(currentYear, currentMonth, card.cutoffDay); // Next cutoff is this month
    }
    
    const prevStatementCutoff = new Date(currentStatementCutoff.getFullYear(), currentStatementCutoff.getMonth() - 1, card.cutoffDay);

    // Payment Due Date: X days after `currentStatementCutoff`
    let calculatedPaymentDueDate = new Date(currentStatementCutoff.getFullYear(), currentStatementCutoff.getMonth(), card.paymentDay);
    // If payment day is numerically less than cutoff day, it usually means it's in the *next* month.
    if (card.paymentDay < card.cutoffDay) {
        calculatedPaymentDueDate.setMonth(calculatedPaymentDueDate.getMonth() + 1);
    }

    // --- Calculate 'Pago para no generar intereses' (Previous Statement Balance) ---
    // Sum all debits (expenses, monthly installment amounts) and subtract credits (payments)
    // that occurred within the period (previousStatementCutoff, currentStatementCutoff].
    let paymentForPeriodAmount = 0;
    card.transactions.forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        if (txDate > prevStatementCutoff && txDate <= currentStatementCutoff) {
            if (tx.type === 'expense') {
                paymentForPeriodAmount += tx.amount;
            } else if (tx.type === 'installment_purchase') {
                // For 'Pago para no generar intereses', add the monthly payment if the purchase occurred in this cycle.
                // This makes its behavior consistent with 'Próximo Pago (Estimado)' for new installment purchases.
                paymentForPeriodAmount += tx.monthlyPayment; 
            } else if (tx.type === 'payment') {
                paymentForPeriodAmount -= tx.amount;
            }
        }
    });

    // --- Calculate 'Próximo Pago (Estimado)' (Current Statement Estimate) ---
    // Sum all debits and subtract credits that occurred within the period (currentStatementCutoff, nextCutoff].
    // This value represents the total *new charges* that will appear on the next statement.
    let nextPaymentAmount = 0;
    card.transactions.forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        if (txDate > currentStatementCutoff && txDate <= nextCutoff) {
             if (tx.type === 'expense') {
                nextPaymentAmount += tx.amount;
            } else if (tx.type === 'installment_purchase') {
                // For 'Próximo Pago (Estimado)', only the monthly payment contributes if the installment is active.
                if (tx.paidMonths < tx.months) {
                    nextPaymentAmount += tx.monthlyPayment; 
                }
            } else if (tx.type === 'payment') {
                nextPaymentAmount -= tx.amount;
            }
        }
    });


    return {
        currentBalance: Math.max(0, currentBalance),
        availableCredit: Math.max(0, card.limit - currentBalance),
        nextCutoffDate: formatDate(nextCutoff.toISOString().split('T')[0]),
        paymentDueDate: formatDate(calculatedPaymentDueDate.toISOString().split('T')[0]),
        paymentForPeriod: Math.max(0, paymentForPeriodAmount),
        nextPayment: Math.max(0, nextPaymentAmount),
    };
};