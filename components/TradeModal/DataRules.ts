
import { Trade, TradeDirection, TradeStatus } from '../../types';
import { isAfter, addDays, isValid as isValidDate, getDaysInMonth } from 'date-fns';

export interface ValidationErrors {
    entryDate?: string;
    entryTime?: string;
    exitDate?: string;
    exitTime?: string;
    symbol?: string;
    quantity?: string;
    entryPrice?: string;
    exitPrice?: string;
    initialStopLoss?: string; // Added
    highestPriceReached?: string; // MFE
    lowestPriceReached?: string; // MAE
    general?: string;
    [key: string]: string | undefined; // Allow indexing
}

export const validateTrade = (trade: Trade): { isValid: boolean; errors: ValidationErrors } => {
    const errors: ValidationErrors = {};
    const now = new Date();
    const limitDate = addDays(now, 2); // Max allowed is Today + 2 days

    // 0. Validate Required Selections
    if (!trade.direction) {
        errors.general = "Required";
    }
    if (!trade.status) {
        errors.general = "Required";
    }
    if (!trade.symbol) {
        errors.symbol = "Required";
    }
    if (!trade.quantity || trade.quantity <= 0) {
        errors.quantity = "Required";
    }
    
    // Numeric Fields Required Check
    if (trade.entryPrice === undefined || isNaN(trade.entryPrice)) {
        errors.entryPrice = "Required";
    }
    
    if (trade.exitPrice === undefined || isNaN(trade.exitPrice)) {
        errors.exitPrice = "Required";
    } else if (trade.exitPrice < 0) {
        errors.exitPrice = "Price cannot be negative";
    }

    if (trade.initialStopLoss === undefined || isNaN(trade.initialStopLoss)) {
        errors.initialStopLoss = "Required";
    }
    
    if (trade.highestPriceReached === undefined || isNaN(trade.highestPriceReached)) {
        errors.highestPriceReached = "Required";
    }
    if (trade.lowestPriceReached === undefined || isNaN(trade.lowestPriceReached)) {
        errors.lowestPriceReached = "Required";
    }

    // --- PRICE LOGIC VALIDATION (Partial Checks Allowed) ---
    const entry = trade.entryPrice;
    const exit = trade.exitPrice;
    const sl = trade.initialStopLoss;
    const high = trade.highestPriceReached; // MFE for Long, MAE for Short
    const low = trade.lowestPriceReached;   // MAE for Long, MFE for Short
    const status = trade.status;

    // Status vs Price Logic
    if (entry !== undefined && exit !== undefined && status) {
        const isWinStatus = status === TradeStatus.WIN || status === TradeStatus.SMALL_WIN;
        const isLossStatus = status === TradeStatus.LOSS || status === TradeStatus.SMALL_LOSS;

        if (trade.direction === TradeDirection.LONG) {
            // Long Win: Exit > Entry
            if (isWinStatus && exit <= entry) {
                errors.exitPrice = "Win: Exit > Entry";
            }
            // Long Loss: Exit < Entry
            if (isLossStatus && exit >= entry) {
                errors.exitPrice = "Loss: Exit < Entry";
            }
        } else if (trade.direction === TradeDirection.SHORT) {
            // Short Win: Exit < Entry
            if (isWinStatus && exit >= entry) {
                errors.exitPrice = "Win: Exit < Entry";
            }
            // Short Loss: Exit > Entry
            if (isLossStatus && exit <= entry) {
                errors.exitPrice = "Loss: Exit > Entry";
            }
        }
    }

    if (trade.direction === TradeDirection.LONG) {
        // LONG Rules
        
        // 1. SL < Entry
        if (entry !== undefined && sl !== undefined) {
             if (sl >= entry) errors.initialStopLoss = "< Entry";
        }
        
        // 2. SL <= Exit
        if (sl !== undefined && exit !== undefined) {
             if (sl > exit) errors.initialStopLoss = "<= Exit";
        }

        // 3. MFE (High) >= Entry AND MFE >= Exit
        if (high !== undefined) {
            if (entry !== undefined && high < entry) errors.highestPriceReached = "Must be >= Entry";
            else if (exit !== undefined && high < exit) errors.highestPriceReached = "Must be >= Exit";
        }

        // 4. MAE (Low) <= Entry AND MAE <= Exit
        if (low !== undefined) {
            if (entry !== undefined && low > entry) errors.lowestPriceReached = "Must be <= Entry";
            else if (exit !== undefined && low > exit) errors.lowestPriceReached = "Must be <= Exit";
        }

        // 5. MAE vs SL Logic
        if (low !== undefined && sl !== undefined) {
            if (exit !== undefined && exit === sl) {
                if (low !== sl) errors.lowestPriceReached = "Must = SL";
            } else {
                if (low <= sl) errors.lowestPriceReached = "Cannot be <= SL";
            }
        }

    } else if (trade.direction === TradeDirection.SHORT) {
        // SHORT Rules

        // 1. SL > Entry
        if (entry !== undefined && sl !== undefined) {
            if (sl <= entry) errors.initialStopLoss = "> Entry";
        }

        // 2. SL >= Exit
        if (sl !== undefined && exit !== undefined) {
            if (sl < exit) errors.initialStopLoss = ">= Exit";
        }

        // 3. MFE (Low) <= Entry AND MFE <= Exit (For Short, Low is MFE/Profit)
        // MFE (Lowest Price Reached) logic for Short
        if (low !== undefined) {
             if (entry !== undefined && low > entry) errors.lowestPriceReached = "Must be <= Entry"; // Price shouldn't be higher than entry for Profit metric
             else if (exit !== undefined && low > exit) errors.lowestPriceReached = "Must be <= Exit";
        }

        // 4. MAE (High) >= Entry AND MAE >= Exit (For Short, High is MAE/Loss)
        // MAE (Highest Price Reached) logic for Short
        if (high !== undefined) {
             if (entry !== undefined && high < entry) errors.highestPriceReached = "Must be >= Entry"; // Price shouldn't be lower than entry for Loss metric
             else if (exit !== undefined && high < exit) errors.highestPriceReached = "Must be >= Exit";
        }

        // 5. MAE vs SL Logic
        if (high !== undefined && sl !== undefined) {
            if (exit !== undefined && exit === sl) {
                if (high !== sl) errors.highestPriceReached = "Must = SL";
            } else {
                if (high >= sl) errors.highestPriceReached = "Cannot be >= SL";
            }
        }
    }

    // 1. Validate Entry Date
    if (!trade.entryDate) {
        errors.entryDate = "Required";
    } else {
        const iso = trade.entryDate;
        const dateObj = new Date(iso);
        if (isNaN(dateObj.getTime())) {
             errors.entryDate = "Invalid Date";
        } else {
            const [datePart, timePart] = iso.split('T');
            
            if (!datePart) {
                errors.entryDate = "Invalid date format";
            } else {
                const [yStr, mStr, dStr] = datePart.split('-');
                const year = parseInt(yStr);
                const month = parseInt(mStr);
                const day = parseInt(dStr);

                if (month < 1 || month > 12) {
                    errors.entryDate = "Month 1-12";
                } else if (day < 1) {
                    errors.entryDate = "Invalid day";
                } else {
                    const testDate = new Date(year, month - 1, 1);
                    const daysInMonth = getDaysInMonth(testDate);
                    if (day > daysInMonth) {
                        errors.entryDate = `Max day ${daysInMonth}`;
                    } else {
                        if (isValidDate(dateObj)) {
                            const entryDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
                            const limitDay = new Date(limitDate.getFullYear(), limitDate.getMonth(), limitDate.getDate());
                            if (isAfter(entryDay, limitDay)) {
                                errors.entryDate = "> Today+2";
                            }
                        }
                    }
                }
            }

            // 2. Validate Entry Time
            if (timePart) {
                const [hStr, mStr] = timePart.split(':');
                const h = parseInt(hStr);
                const m = parseInt(mStr);
                if (isNaN(h) || h > 23 || isNaN(m) || m > 59) errors.entryTime = "Invalid Time";
            } else {
                errors.entryTime = "Required"; 
            }
        }
    }

    // 3. Validate Exit Date & Time
    if (!trade.exitDate) {
        errors.exitDate = "Required";
    } else {
        const exitDateObj = new Date(trade.exitDate);
        if (isNaN(exitDateObj.getTime())) {
             errors.exitDate = "Invalid Date";
             errors.exitTime = "Invalid Time";
        } else {
            const [exitDatePart, exitTimePart] = trade.exitDate.split('T');
            
            // Basic Time Check
            if (exitTimePart) {
                const [hStr, mStr] = exitTimePart.split(':');
                const h = parseInt(hStr);
                const m = parseInt(mStr);
                if (isNaN(h) || h > 23 || isNaN(m) || m > 59) errors.exitTime = "Invalid Time";
            } else {
                errors.exitTime = "Required";
            }
        }
    }

    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
};
