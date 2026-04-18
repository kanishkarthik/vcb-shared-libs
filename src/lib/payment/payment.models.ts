/**
 * Payment domain models and interfaces
 */

/**
 * Payment method types
 */
export enum PaymentMethodType {
  BKT = 'BKT',           // Bank Transfer
  DFT = 'DFT',           // Direct Fund Transfer
  OPS = 'OPS'            // Operations/Bulk Payment
}

/**
 * User's bank account for payments
 */
export interface PaymentAccount {
  id: string;
  accountNumber: string;
  accountHolderName: string;
  balance: number;
  bankCode: string;
  bankName: string;
  accountType: 'SAVING' | 'CHECKING' | 'BUSINESS';
}

/**
 * Step 1: Account and payment method selection
 */
export interface PaymentStep1Data {
  selectedAccountId: string;
  selectedAccount?: PaymentAccount;
  selectedPaymentMethod: PaymentMethodType;
}

/**
 * Step 2: Payment method specific details (BKT)
 */
export interface PaymentStep2DataBKT {
  beneficiaryBankCode: string;
  beneficiaryAccountNumber: string;
  beneficiaryName: string;
  beneficiaryBankName?: string;
  amount: number;
  narration?: string;
}

/**
 * Step 2: Payment method specific details (DFT)
 */
export interface PaymentStep2DataDFT {
  beneficiaryPhoneOrEmail: string;
  beneficiaryId?: string;
  beneficiaryName: string;
  amount: number;
  narration?: string;
}

/**
 * Step 2: Payment method specific details (OPS)
 */
export interface PaymentStep2DataOPS {
  batchReference: string;
  fileContent: string;  // CSV content or file path
  totalAmount: number;
  recipientCount: number;
  narration?: string;
}

/**
 * Step 2: Union type for payment method specific data
 */
export type PaymentStep2Data = PaymentStep2DataBKT | PaymentStep2DataDFT | PaymentStep2DataOPS;

/**
 * Step 3: Review and confirmation
 */
export interface PaymentStep3Data {
  confirmationAccepted: boolean;
  termsAccepted: boolean;
}

/**
 * Complete payment creation state
 */
export interface PaymentCreationState {
  step1: PaymentStep1Data | null;
  step2: PaymentStep2Data | null;
  step3: PaymentStep3Data | null;
  currentStep: 1 | 2 | 3;
  totalFees: number;
  totalDebitAmount: number;
  paymentId?: string;
  status: 'draft' | 'submitted' | 'success' | 'error';
  errorMessage?: string;
}

/**
 * Payment submission request
 */
export interface PaymentRequest {
  debitAccountId: string;
  paymentMethod: PaymentMethodType;
  amount: number;
  details: PaymentStep2Data;
  narration?: string;
}

/**
 * Payment submission response
 */
export interface PaymentResponse {
  paymentId: string;
  status: 'success' | 'error';
  message: string;
  transactionReference?: string;
  timestamp: Date;
  fees: number;
}

/**
 * Payment validation result
 */
export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
}
