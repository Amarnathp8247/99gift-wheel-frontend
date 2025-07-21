import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  Renderer2,
  OnDestroy,
  NgZone,
  ViewEncapsulation,
  ChangeDetectorRef
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
import { AudioService } from '../../services/audio.service';

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
  showVisitorIdPopup = false;
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
   audioEnabled = true;

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
    private audioService: AudioService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.fetchPrizes();
    const savedVisitorId = localStorage.getItem('visitorId');
    if (savedVisitorId) {
      this.visitorId = savedVisitorId;
      this.visitorIdEntered = true;
      this.playAudio('background');
    } else {
      setTimeout(() => {
        this.showVisitorIdPopup = true;
        this.cdr.detectChanges();
      }, 1000);
    }
  }

  toggleAudio(): void {
    this.audioEnabled = !this.audioEnabled;
    if (this.audioEnabled) {
      this.playAudio('background');
    } else {
      this.audioService.stop('background');
    }
  }

  playAudio(sound: 'spinner' | 'win' | 'click' | 'hover' | 'celebration' | 'money' | 'background'): void {
    if (this.audioEnabled) {
      this.audioService.play(sound);
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
    this.playAudio('click');
    if (!this.visitorId.trim()) {
      this.showApiMessagePopup('Error', 'Visitor ID cannot be empty.', 'error');
      this.shakeInput();
      return;
    }

    this.gameService.visiterId(this.visitorId).subscribe({
      next: (result: SpinResult) => {
        this.walletAmount = result.walletAmount || 0;
        this.visitorIdEntered = true;
        localStorage.setItem('visitorId', this.visitorId);
        this.showVisitorIdPopup = false;
        this.spinBtn.nativeElement.disabled = false;
        this.playAudio('background');
        this.showApiMessagePopup('Success', result.message || 'Visitor ID registered successfully.', 'success');
      },
      error: (err) => {
        const apiMessage = err?.result?.message;
        this.showApiMessagePopup('Error', apiMessage, 'error');
      },
    });
  }

  spinWheel() {
    this.playAudio('click');
    if (this.isSpinning || this.prizes.length === 0) return;
  
    if (!this.visitorId || this.visitorId.trim() === '') {
      this.showVisitorIdPopup = true;
      this.shakeInput();
      this.showApiMessagePopup('Oops!', 'Please enter your Visitor ID first!', 'warning');
      return;
    }
  
    this.isSpinning = true;
    this.spinBtn.nativeElement.disabled = true;
    this.playAudio('spinner');
  
    this.gameService.handleSpin(this.visitorId).subscribe({
      next: (result: any) => {
        const spinResult = result?.data?.result;
        const prize = result?.data?.prize;
  
        if (spinResult === 'win' && prize) {
          this.currentPrize = prize;
          this.walletAmount = prize.walletAmount || 0;
  
          // 🎉 Dynamic success message
          // const successMessage = prize.walletAmount > 0
          //   ? `₹${prize.walletAmount} has been added to your wallet!`
          //   : `You won: ${prize.name} worth ${prize.value}!`;
  
          // this.showApiMessagePopup('Congratulations!', successMessage, 'success');
  
          this.animateWheelToPrize(prize);
        } else if (spinResult === 'lose') {
          this.currentPrize = null;
          this.walletAmount = 0;
          this.animateWheelToLose();
        } else {
          this.isSpinning = false;
          this.spinBtn.nativeElement.disabled = false;
          this.audioService.stop('spinner');
          this.showApiMessagePopup(
            result.title || 'Oops!',
            result.message || 'Spin failed.',
            result.status ? 'success' : 'error'
          );
        }
      },
      error: (err) => {
        this.isSpinning = false;
        this.spinBtn.nativeElement.disabled = false;
        this.audioService.stop('spinner');
        const apiMessage = err?.error?.message || 'Something went wrong during the spin.';
        this.showApiMessagePopup('Error', apiMessage, 'error');
      },
    });
  }
  

  animateWheelToPrize(prize: Prize) {
    const index = this.prizes.findIndex((p) => p._id === prize._id);
    if (index === -1) {
      this.isSpinning = false;
      this.spinBtn.nativeElement.disabled = false;
      this.audioService.stop('spinner');
      return;
    }
  
    const anglePerPrize = 360 / this.prizes.length;
    const rotateTo = 360 - index * anglePerPrize - anglePerPrize / 2;
    const totalRotation = this.currentRotation + 360 * 5 + rotateTo;
  
    this.renderer.setStyle(
      this.wheel.nativeElement,
      'transition',
      'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)'
    );
    this.renderer.setStyle(
      this.wheel.nativeElement,
      'transform',
      `rotate(${totalRotation}deg)`
    );
  
    this.currentRotation = totalRotation;
  
    setTimeout(() => {
      this.ngZone.run(() => {
        this.audioService.stop('spinner');
        this.playAudio('win');
        this.playAudio('celebration');
        this.playAudio('money');
  
        this.showPrizeCard = true;
  
        // ✨ Display custom message based on wallet amount
        if (this.walletAmount > 0) {
          this.voucherDisplay.nativeElement.textContent = `You won ₹${this.walletAmount} in your 99Gift Wallet!`;
        } else {
          const valueText = prize.value ? ` worth ${prize.value}` : '';
          this.voucherDisplay.nativeElement.textContent = `You won: ${prize.name}${valueText}`;
        }
  
        this.prizeText.nativeElement.textContent = prize.description || '';
  
        this.showLoseCard = false;
        this.fireworksContainer.nativeElement.classList.add('active');
  
        setTimeout(() => {
          this.fireworksContainer.nativeElement.classList.remove('active');
        }, 3000);
  
        this.isSpinning = false;
        this.spinBtn.nativeElement.disabled = false;
  
        this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'none');
        this.currentRotation %= 360;
        this.renderer.setStyle(
          this.wheel.nativeElement,
          'transform',
          `rotate(${this.currentRotation}deg)`
        );
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
        this.audioService.stop('spinner');
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
    this.playAudio('click');
    this.showPrizeCard = false;
    setTimeout(() => {
      this.showSignupForm = true;
      this.cdr.detectChanges();
    }, 300);
  }

  closePrizeCard() {
    this.playAudio('click');
    this.showPrizeCard = false;
  }

  closeSignupForm() {
    this.playAudio('click');
    this.showSignupForm = false;
    this.cdr.detectChanges();
  }

  onSubmitSignup() {
    this.playAudio('click');
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
          this.playAudio('celebration');
          this.resetSignupForm();
          this.walletAmount = response.data?.walletAmount || 0;
          this.showSuccessModal = true;
          this.showApiMessagePopup('Success', response.message || 'Account created successfully!', 'success');
          
          // Update visitor ID and store in local storage
          this.visitorId = response.userId;
          localStorage.setItem('visitorId', this.visitorId);
          
          // Close all open modals first
          this.showSignupForm = false;
          this.showPrizeCard = false;
          this.showLoseCard = false;
          
          // Then show success modal
          setTimeout(() => {
            this.showSuccessModal = true;
            this.cdr.detectChanges();
          }, 300);
        } else {
          this.showApiMessagePopup('Error', response.message || 'Signup failed. Please try again.', 'error');
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        const errMsg = error?.error?.message || 'Signup failed. Please try again.';
        const errCode = error?.error?.messageCode || 'UNKNOWN_ERROR';
      
        if (errCode === 'DUPLICATE_USER') {
          this.showApiMessagePopup('Account Exists', errMsg, 'warning');
        } else {
          this.showApiMessagePopup('Error', errMsg, 'error');
        }
      
        this.isSubmitting = false;
      }
      
    });
  }

  closeSuccessModal() {
    this.playAudio('click');
    this.showSuccessModal = false;
    this.resetSignupForm();
    this.visitorIdEntered = true;
    this.showVisitorIdPopup = false;
    this.cdr.detectChanges();
  }

  closeLoseCard() {
    this.playAudio('click');
    this.showLoseCard = false;
    localStorage.removeItem('visitorId');
    this.visitorId = '';
    this.visitorIdEntered = false;
    this.showVisitorIdPopup = true;
    this.spinBtn.nativeElement.disabled = false;
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

  resetGame() {
    this.playAudio('click');
    localStorage.clear();
    location.reload();
  }

  ngOnDestroy(): void {
    clearInterval(this.messageTimeout);
    this.audioService.stop('background');
    this.audioService.stop('spinner');
  }
}