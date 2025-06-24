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
                // For 'Pago para no generar intereses', we look at actual payments made in the period
                // This will be handled by the related 'payment' transactions.
            } else if (tx.type === 'payment') {
                paymentForPeriodAmount -= tx.amount;
            }
        }
    });
     // Add installment monthly payments due in the *previous* cycle
    card.transactions.filter(tx => tx.type === 'installment_purchase' && tx.paidMonths < tx.months).forEach(inst => {
        const purchaseDate = new Date(inst.date + 'T00:00:00');
        // Only add the monthly payment if the purchase was active during the previous cycle
        if (currentStatementCutoff > purchaseDate) {
             // And crucially, only if a payment for it was *not* already made and accounted for in the loop above.
             // We check if a 'payment' transaction related to this installment exists within the statement period.
             const wasPaidInPeriod = card.transactions.some(p => 
                p.relatedInstallmentId === inst.id &&
                new Date(p.date + 'T00:00:00') > prevStatementCutoff &&
                new Date(p.date + 'T00:00:00') <= currentStatementCutoff
             );
             // If it wasn't paid via the installment system, it's considered part of the "new" balance for that statement.
             if (!wasPaidInPeriod) {
                paymentForPeriodAmount += inst.monthlyPayment;
             }
        }
    });

    // --- Calculate 'Próximo Pago (Estimado)' (Current Statement Estimate) ---
    // Sum all debits and subtract credits that occurred within the period (currentStatementCutoff, nextCutoff].
    // This value represents the total *new charges* that will appear on the next statement.
    let nextPaymentAmount = 0;
    // 1. Sum regular expenses and payments within the current cycle
    card.transactions.forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        if (txDate > currentStatementCutoff && txDate <= nextCutoff) {
             if (tx.type === 'expense') {
                nextPaymentAmount += tx.amount;
            } else if (tx.type === 'payment' && !tx.relatedInstallmentId) { 
                // Subtract general payments, but not installment-specific ones
                nextPaymentAmount -= tx.amount;
            }
        }
    });

    // 2. Add monthly payments for active installments due in this cycle
    const activeInstallments = card.transactions.filter(tx => tx.type === 'installment_purchase' && tx.paidMonths < tx.months);
    activeInstallments.forEach(inst => {
        const purchaseDate = new Date(inst.date + 'T00:00:00');

        // An installment payment is due in this cycle if the purchase was made before the next cutoff
        if (nextCutoff > purchaseDate) {
            // Check if a payment for this installment has already been made within this cycle
            const hasBeenPaidThisCycle = card.transactions.some(p => 
                p.relatedInstallmentId === inst.id &&
                new Date(p.date + 'T00:00:00') > currentStatementCutoff &&
                new Date(p.date + 'T00:00:00') <= nextCutoff
            );

            if (!hasBeenPaidThisCycle) {
                nextPaymentAmount += inst.monthlyPayment;
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