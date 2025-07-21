import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  Renderer2,
  OnDestroy,
  NgZone,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GameService,
  Prize,
  SpinResult,
  SignupPayload,
  SignupResponse,
} from '../../services/game.service';

@Component({
  selector: 'app-spinner-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './spinner-game.component.html',
  styleUrls: ['./spinner-game.component.css'],
  encapsulation: ViewEncapsulation.Emulated
})
export class SpinnerGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('wheel') wheel!: ElementRef;
  @ViewChild('spinBtn') spinBtn!: ElementRef;
  @ViewChild('voucherDisplay') voucherDisplay!: ElementRef;
  @ViewChild('prizeText') prizeText!: ElementRef;
  @ViewChild('fireworksContainer') fireworksContainer!: ElementRef;
  @ViewChild('signupForm') signupForm!: ElementRef;
  @ViewChild('apiMessagePopup') apiMessagePopup!: ElementRef;

  visitorId: string = '';
  prizes: Prize[] = [];
  currentRotation = 0;
  isSpinning = false;
  showVisitorIdPopup = true;
  visitorIdEntered = false;
  showSignupForm = false;
  showSuccessModal = false;
  walletAmount = 0;
  isSubmitting = false;
  showApiMessage = false;
  apiMessageTitle = '';
  apiMessageContent = '';
  apiMessageType: 'success' | 'error' | 'warning' | 'info' = 'info';
  messageProgress = 100;
  private messageTimeout: any;

  currentPrize: Prize | null = null;
  showPrizeCard = false;
  showLoseCard = false;

  signupData = {
    name: '',
    email: '',
    phone: '',
    password: '',
    city: '',
    gender: 'male',
  };

  constructor(
    private renderer: Renderer2,
    private gameService: GameService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.fetchPrizes();
    const savedVisitorId = localStorage.getItem('visitorId');
    if (savedVisitorId) {
      this.visitorId = savedVisitorId;
      this.showVisitorIdPopup = false;
      this.visitorIdEntered = true;
    } else {
      setTimeout(() => {
        this.showVisitorIdPopup = true;
      }, 1000);
    }
  }

  fetchPrizes() {
    this.gameService.getPrizes().subscribe({
      next: (data: any) => {
        if (Array.isArray(data)) {
          this.prizes = data;
        } else if (typeof data === 'object' && data !== null) {
          this.prizes = Object.values(data);
        } else {
          this.prizes = [];
          this.showApiMessagePopup('Error', 'Unexpected prize format.', 'error');
        }
      },
      error: () => {
        this.prizes = [];
        this.showApiMessagePopup('Error', 'Failed to load prizes.', 'error');
      },
    });
  }

  submitVisitorId() {
    if (!this.visitorId.trim()) {
      this.showApiMessagePopup('Error', 'Visitor ID cannot be empty.', 'error');
      return;
    }

    this.gameService.visiterId(this.visitorId).subscribe({
      next: (result: SpinResult) => {
        this.walletAmount = result.walletAmount || 0;
        this.visitorIdEntered = true;
        localStorage.setItem('visitorId', this.visitorId);
        this.showVisitorIdPopup = false;
        this.spinBtn.nativeElement.disabled = false;

        if (result.status === 'win' && result.prize) {
          this.showApiMessagePopup('Success!', `You won! ₹${this.walletAmount}`, 'success');
        } else if (result.status === 'lose') {
          this.showApiMessagePopup('Welcome!', 'You can spin again soon!', 'info');
        } else {
          this.showApiMessagePopup('Info', result.message || 'Visitor ID registered successfully.', 'info');
        }
      },
      error: (err) => {
        const apiMessage = err?.error?.message || 'Failed to register visitor ID.';
        this.showApiMessagePopup('Error', apiMessage, 'error');
      },
    });
  }

  spinWheel() {
    if (this.isSpinning || this.prizes.length === 0) return;

    if (!this.visitorId || this.visitorId.trim() === '') {
      this.showVisitorIdPopup = true;
      this.shakeInput();
      this.showApiMessagePopup('Oops!', 'Please enter your Visitor ID first!', 'warning');
      return;
    }

    this.isSpinning = true;
    this.spinBtn.nativeElement.disabled = true;

    this.gameService.handleSpin(this.visitorId).subscribe({
      next: (result: any) => {
        const spinResult = result?.data?.result;
        const prize = result?.data?.prize;

        if (spinResult === 'win' && prize) {
          this.currentPrize = prize;
          this.walletAmount = prize.walletAmount || 0;
          this.animateWheelToPrize(prize);
        } else if (spinResult === 'lose') {
          this.currentPrize = null;
          this.walletAmount = 0;
          this.animateWheelToLose();
        } else if (result.status === 'limit') {
          this.isSpinning = false;
          this.spinBtn.nativeElement.disabled = true;
          this.showApiMessagePopup('Spin Limit Reached', result.message || 'Try again tomorrow.', 'warning');
        } else {
          this.isSpinning = false;
          this.spinBtn.nativeElement.disabled = false;
          this.showApiMessagePopup('Oops!', result.message || 'Spin failed.', 'error');
        }
      },
      error: (err) => {
        this.isSpinning = false;
        this.spinBtn.nativeElement.disabled = false;
        const apiMessage = err?.error?.message || 'Failed to spin the wheel.';
        this.showApiMessagePopup('Error', apiMessage, 'error');
      },
    });
  }

  animateWheelToPrize(prize: Prize) {
    const index = this.prizes.findIndex((p) => p._id === prize._id);
    if (index === -1) {
      this.isSpinning = false;
      this.spinBtn.nativeElement.disabled = false;
      return;
    }

    const anglePerPrize = 360 / this.prizes.length;
    const rotateTo = 360 - index * anglePerPrize - anglePerPrize / 2;
    const totalRotation = this.currentRotation + 360 * 5 + rotateTo;
  
    this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)');
    this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${totalRotation}deg)`);
    this.currentRotation = totalRotation;
  
    setTimeout(() => {
      this.ngZone.run(() => {
        this.voucherDisplay.nativeElement.textContent = `You won ₹${this.walletAmount} in your 99Gift Wallet!`;
        this.prizeText.nativeElement.textContent = this.currentPrize?.description || '';
        this.showPrizeCard = true;
        this.showLoseCard = false;
        this.fireworksContainer.nativeElement.classList.add('active');
        
        setTimeout(() => {
          this.fireworksContainer.nativeElement.classList.remove('active');
        }, 3000);
  
        this.isSpinning = false;
        this.spinBtn.nativeElement.disabled = false;
        this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'none');
        this.currentRotation %= 360;
        this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${this.currentRotation}deg)`);
      });
    }, 4000);
  }
  
  animateWheelToLose() {
    const index = Math.floor(Math.random() * this.prizes.length);
    const anglePerPrize = 360 / this.prizes.length;
    const rotateTo = 360 - index * anglePerPrize - anglePerPrize / 2;
    const totalRotation = this.currentRotation + 360 * 5 + rotateTo;
  
    this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)');
    this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${totalRotation}deg)`);
    this.currentRotation = totalRotation;
  
    setTimeout(() => {
      this.ngZone.run(() => {
        this.showLoseCard = true;
        this.showPrizeCard = false;
        this.isSpinning = false;
        this.spinBtn.nativeElement.disabled = false;
  
        this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'none');
        this.currentRotation %= 360;
        this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${this.currentRotation}deg)`);
      });
    }, 4000);
  }

  showSignup() {
    this.showPrizeCard = false;
    setTimeout(() => {
      this.showSignupForm = true;
    }, 300);
  }

  closePrizeCard() {
    this.showPrizeCard = false;
  }

  closeSignupForm() {
    this.showSignupForm = false;
  }

  onSubmitSignup() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!phoneRegex.test(this.signupData.phone)) {
      this.showApiMessagePopup('Validation Error', 'Invalid Indian mobile number.', 'error');
      this.isSubmitting = false;
      return;
    }

    const payload: SignupPayload = {
      name: this.signupData.name,
      email: this.signupData.email,
      mobile: this.signupData.phone,
      password: this.signupData.password,
      city: this.signupData.city,
      gender: this.signupData.gender,
      visitorId: this.visitorId,
      walletAmount: this.walletAmount,
    };

    this.gameService.signupUser(payload).subscribe({
      next: (response: SignupResponse) => {
        if (response.success && response.userId) {
          this.showSignupForm = false;
          this.visitorId = response.userId;
          localStorage.setItem('visitorId', this.visitorId);
          setTimeout(() => {
            this.showSuccessModal = true;
          }, 300);
          this.showApiMessagePopup('Success!', 'Account created successfully!', 'success');
        } else {
          this.showApiMessagePopup('Signup Failed', response.message || 'Try again.', 'error');
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        this.showApiMessagePopup('Error', error.message || 'Signup failed.', 'error');
        this.isSubmitting = false;
      },
    });
  }

  closeLoseCard() {
    this.showLoseCard = false;
    localStorage.removeItem('visitorId');
    this.visitorId = '';
    this.visitorIdEntered = false;
    this.showVisitorIdPopup = true;
    this.spinBtn.nativeElement.disabled = false;
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
    this.resetSignupForm();
  }

  resetSignupForm() {
    this.signupData = {
      name: '',
      email: '',
      phone: '',
      password: '',
      city: '',
      gender: 'male',
    };
  }

  shakeInput() {
    const inputElement = document.getElementById('visitorId');
    if (inputElement) {
      inputElement.classList.add('shake-animation');
      setTimeout(() => inputElement.classList.remove('shake-animation'), 500);
    }
  }

  showApiMessagePopup(
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration: number = 5000
  ) {
    this.apiMessageTitle = title;
    this.apiMessageContent = message;
    this.apiMessageType = type;
    this.showApiMessage = true;
    this.messageProgress = 100;
    clearInterval(this.messageTimeout);

    const interval = 50;
    const steps = duration / interval;
    const stepValue = 100 / steps;

    this.messageTimeout = setInterval(() => {
      this.messageProgress -= stepValue;
      if (this.messageProgress <= 0) {
        this.hideApiMessage();
      }
    }, interval);
  }

  hideApiMessage() {
    this.showApiMessage = false;
    clearInterval(this.messageTimeout);
  }

  ngOnDestroy(): void {
    clearInterval(this.messageTimeout);
  }

  resetGame() {
    localStorage.clear();
    location.reload();
  }
}