import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  PaymentAccount,
  PaymentCreationState,
  PaymentMethodType,
  PaymentRequest,
  PaymentResponse,
  PaymentStep1Data,
  PaymentStep2Data,
  PaymentStep3Data,
  PaymentValidationResult
} from './payment.models';
import { Router } from '@angular/router';

/**
 * Service to manage payment stepper state and orchestrate payment creation flow
 */
@Injectable({
  providedIn: 'root'
})
export class PaymentStepperService {
  private httpClient = inject(HttpClient);
  private router = inject(Router);

  // Signals for reactive state management
  private currentStepSignal = signal<1 | 2 | 3>(1);
  private paymentStateSignal = signal<PaymentCreationState>(this.getInitialState());

  // Public computed signals
  public currentStep = this.currentStepSignal.asReadonly();
  public paymentState = this.paymentStateSignal.asReadonly();
  public isStep1Valid = computed(() => this.validateStep(1));
  public isStep2Valid = computed(() => this.validateStep(2));
  public isStep3Valid = computed(() => this.validateStep(3));

  // Observables for async operations
  private paymentStateSubject$ = new BehaviorSubject<PaymentCreationState>(this.getInitialState());
  public paymentState$ = this.paymentStateSubject$.asObservable();

  // Mock available accounts (replace with API call later)
  private mockAccounts: PaymentAccount[] = [
    {
      id: 'ACC001',
      accountNumber: 'xxxx-1234',
      accountHolderName: 'John Doe',
      balance: 50000,
      bankCode: 'VCBB',
      bankName: 'VCB Bank',
      accountType: 'SAVING'
    },
    {
      id: 'ACC002',
      accountNumber: 'xxxx-5678',
      accountHolderName: 'John Doe',
      balance: 100000,
      bankCode: 'VCBB',
      bankName: 'VCB Bank',
      accountType: 'CHECKING'
    }
  ];

  constructor() {
    this.initializeState();
  }

  /**
   * Initialize payment state from localStorage or create new
   */
  private initializeState(): void {
    const savedState = localStorage.getItem('payment_creation_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        this.paymentStateSignal.set(state);
        this.paymentStateSubject$.next(state);
      } catch {
        this.resetStepper();
      }
    }
  }

  /**
   * Get initial empty payment creation state
   */
  private getInitialState(): PaymentCreationState {
    return {
      step1: null,
      step2: null,
      step3: null,
      currentStep: 1,
      totalFees: 0,
      totalDebitAmount: 0,
      status: 'draft'
    };
  }

  /**
   * Get available accounts for payment
   */
  getAvailableAccounts(): Observable<PaymentAccount[]> {
    // Replace this with actual API call
    return new Observable(observer => {
      setTimeout(() => {
        observer.next(this.mockAccounts);
        observer.complete();
      }, 500);
    });
  }

  /**
   * Navigate to specific step
   */
  goToStep(step: 1 | 2 | 3): boolean {
    if (step < this.currentStepSignal() && this.canGoBackToStep(step)) {
      this.currentStepSignal.set(step);
      this.updateState();
      return true;
    }

    if (step > this.currentStepSignal() && this.canGoToNextStep()) {
      this.currentStepSignal.set(step);
      this.updateState();
      return true;
    }

    return false;
  }

  /**
   * Move to next step (with validation)
   */
  goToNextStep(): boolean {
    const currentStep = this.currentStepSignal();
    if (currentStep < 3 && this.validateStep(currentStep)) {
      const nextStep = (currentStep + 1) as 1 | 2 | 3;
      this.currentStepSignal.set(nextStep);
      this.updateState();
      const paymentMethod = this.paymentStateSignal().step1?.selectedPaymentMethod;
      if (nextStep === 2 && paymentMethod) {
        this.router.navigate([`/payments/create-payment/step/${nextStep}/${paymentMethod.toLowerCase()}`], { state: { reset: false } });
      } else {
        this.router.navigate([`/payments/create-payment/step/${nextStep}`], { state: { reset: false } });
      }
      return true;
    }
    return false;
  }

  /**
   * Move to previous step
   */
  goToPreviousStep(): boolean {
    const currentStep = this.currentStepSignal();
    if (currentStep > 1) {
      const nextStep = (currentStep - 1) as 1 | 2 | 3;
      this.currentStepSignal.set(nextStep);
      this.updateState();
      const paymentMethod = this.paymentStateSignal().step1?.selectedPaymentMethod?.toLowerCase();
      if (nextStep === 2 && paymentMethod) {
        this.router.navigate([`/payments/create-payment/step/${nextStep}/${paymentMethod.toLowerCase()}`], { state: { reset: false } });
      } else {
        this.router.navigate([`/payments/create-payment/step/${nextStep}`], { state: { reset: false } });
      }
      return true;
    }
    return false;
  }

  /**
   * Check if can go to next step (current step must be valid)
   */
  canGoToNextStep(): boolean {
    return this.validateStep(this.currentStepSignal());
  }

  /**
   * Check if can go back to previous step
   */
  canGoBackToStep(step: 1 | 2 | 3): boolean {
    return step < this.currentStepSignal();
  }

  /**
   * Update Step 1 data (account and payment method selection)
   */
  updateStep1(step1Data: PaymentStep1Data): void {
    const currentState = this.paymentStateSignal();
    const newState: PaymentCreationState = {
      ...currentState,
      step1: step1Data
    };
    this.paymentStateSignal.set(newState);
    this.updateState();
  }

  /**
   * Update Step 2 data (payment method specific details)
   */
  updateStep2(step2Data: PaymentStep2Data): void {
    const currentState = this.paymentStateSignal();
    const newState: PaymentCreationState = {
      ...currentState,
      step2: step2Data
    };
    this.paymentStateSignal.set(newState);
    this.updateState();
  }

  /**
   * Update Step 3 data (confirmation)
   */
  updateStep3(step3Data: PaymentStep3Data): void {
    const currentState = this.paymentStateSignal();
    const newState: PaymentCreationState = {
      ...currentState,
      step3: step3Data
    };
    this.paymentStateSignal.set(newState);
    this.updateState();
  }

  /**
   * Validate specific step
   */
  private validateStep(step: 1 | 2 | 3): boolean {
    const state = this.paymentStateSignal();

    switch (step) {
      case 1:
        return !!(state.step1?.selectedAccountId && state.step1?.selectedPaymentMethod);

      case 2:
        if (!state.step2) return false;
        const step2 = state.step2 as any;
        return !!(step2.amount && step2.amount > 0);

      case 3:
        return !!(state.step3?.confirmationAccepted && state.step3?.termsAccepted);

      default:
        return false;
    }
  }

  /**
   * Get validation errors for a step
   */
  getStepValidationErrors(step: 1 | 2 | 3): PaymentValidationResult {
    const state = this.paymentStateSignal();
    const errors: string[] = [];

    switch (step) {
      case 1:
        if (!state.step1?.selectedAccountId) {
          errors.push('Please select a debit account');
        }
        if (!state.step1?.selectedPaymentMethod) {
          errors.push('Please select a payment method');
        }
        break;

      case 2:
        if (!state.step2) {
          errors.push('Payment details are required');
        } else {
          const step2 = state.step2 as any;
          if (!step2.amount || step2.amount <= 0) {
            errors.push('Amount must be greater than 0');
          }
        }
        break;

      case 3:
        if (!state.step3?.confirmationAccepted) {
          errors.push('Please confirm the payment details');
        }
        if (!state.step3?.termsAccepted) {
          errors.push('Please accept the terms and conditions');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate fees based on amount and payment method
   */
  calculateFees(amount: number, method: PaymentMethodType): number {
    // Mock fee calculation
    const baseFee = 5;
    const percentageFee = amount * 0.01; // 1% fee

    switch (method) {
      case PaymentMethodType.BKT:
        return baseFee + percentageFee;
      case PaymentMethodType.DFT:
        return baseFee + percentageFee * 0.5; // 0.5% for DFT
      case PaymentMethodType.OPS:
        return baseFee + percentageFee * 0.2; // 0.2% for OPS
      default:
        return baseFee;
    }
  }

  /**
   * Submit payment
   */
  submitPayment(): Observable<PaymentResponse> {
    const state = this.paymentStateSignal();

    if (!state.step1 || !state.step2) {
      throw new Error('Payment creation state is incomplete');
    }

    const request: PaymentRequest = {
      debitAccountId: state.step1.selectedAccountId,
      paymentMethod: state.step1.selectedPaymentMethod,
      amount: (state.step2 as any).amount,
      details: state.step2
    };

    // Mock API call - replace with actual endpoint
    return new Observable(observer => {
      setTimeout(() => {
        const response: PaymentResponse = {
          paymentId: 'PAY-' + Date.now(),
          status: 'success',
          message: 'Payment submitted successfully',
          transactionReference: 'TXN-' + Math.random().toString(36).substr(2, 9),
          timestamp: new Date(),
          fees: this.calculateFees((request.details as any).amount, request.paymentMethod)
        };

        const newState: PaymentCreationState = {
          ...state,
          status: 'success',
          paymentId: response.paymentId
        };

        this.paymentStateSignal.set(newState);
        this.updateState();

        observer.next(response);
        observer.complete();
      }, 1000);
    });
  }

  /**
   * Reset stepper to initial state
   */
  resetStepper(): void {
    this.currentStepSignal.set(1);
    this.paymentStateSignal.set(this.getInitialState());
    this.updateState();
    localStorage.removeItem('payment_creation_state');
  }

  /**
   * Update local storage with current state
   */
  private updateState(): void {
    const state = this.paymentStateSignal();
    this.paymentStateSubject$.next(state);
    localStorage.setItem('payment_creation_state', JSON.stringify(state));
  }

  /**
   * Get current payment state
   */
  getPaymentState(): PaymentCreationState {
    return this.paymentStateSignal();
  }

  /**
   * Get current step
   */
  getCurrentStep(): 1 | 2 | 3 {
    return this.currentStepSignal();
  }
}
