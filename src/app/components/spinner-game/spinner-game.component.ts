import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  Renderer2,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GameService,
  Prize,
  SpinResult,
  SignupPayload,
  SignupResponse
} from '../../services/game.service';

@Component({
  selector: 'app-spinner-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './spinner-game.component.html',
  styleUrls: ['./spinner-game.component.css']
})
export class SpinnerGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('wheel') wheel!: ElementRef;
  @ViewChild('spinBtn') spinBtn!: ElementRef;
  @ViewChild('prizeCard') prizeCard!: ElementRef;
  @ViewChild('prizeText') prizeText!: ElementRef;
  @ViewChild('voucherDisplay') voucherDisplay!: ElementRef;
  @ViewChild('closeBtn') closeBtn!: ElementRef;
  @ViewChild('fireworksContainer') fireworksContainer!: ElementRef;
  @ViewChild('soundIndicator') soundIndicator!: ElementRef;
  @ViewChild('particlesContainer') particlesContainer!: ElementRef;
  @ViewChild('wheelContainer') wheelContainer!: ElementRef;
  @ViewChild('signupForm') signupForm!: ElementRef;
  @ViewChild('successModal') successModal!: ElementRef;
  @ViewChild('apiMessagePopup') apiMessagePopup!: ElementRef;
  @ViewChild('loseCard') loseCard!: ElementRef;

  visitorId: string = '';
  prizes: Prize[] = [];
  currentRotation = 0;
  isSpinning = false;
  showVisitorIdPrompt = true;
  visitorIdEntered = false;
  colorInterval: any;
  ambientSoundInterval: any;
  particleInterval: any;
  showSignupForm = false;
  showSuccessModal = false;
  walletAmount = 0;
  isSubmitting = false;
  showVisitorIdPopup = true;
  showInputHint = false;
  showApiMessage = false;
  apiMessageTitle = '';
  apiMessageContent = '';
  apiMessageType: 'success' | 'error' | 'warning' | 'info' = 'info';
  messageProgress = 100;
  private messageTimeout: any;

  signupData = {
    name: '',
    email: '',
    phone: '',
    password: '',
    city: '',
    gender: 'male'
  };

  constructor(private renderer: Renderer2, private gameService: GameService) {}

  ngAfterViewInit(): void {
    this.fetchPrizes();
    this.createParticles();
    this.createOrbitRings();
    this.regenerateParticles();
    this.simulateAmbientSounds();
    this.startColorCycle();
    this.checkSavedVisitorId();

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

    this.closeBtn.nativeElement.addEventListener('click', () => {
      this.prizeCard.nativeElement.classList.remove('show');
    });
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
      }
    });
  }

  submitVisitorId() {
    if (this.visitorId && this.visitorId.trim()) {
      this.showVisitorIdPopup = false;
      this.visitorIdEntered = true;
      localStorage.setItem('visitorId', this.visitorId.trim());
      this.showApiMessagePopup('Welcome!', 'Get ready to spin the wheel!', 'success');
    } else {
      this.showInputHint = true;
      this.shakeInput();
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
      if (this.messageProgress <= 0) this.hideApiMessage();
    }, interval);
  }

  hideApiMessage() {
    this.showApiMessage = false;
    clearInterval(this.messageTimeout);
  }

  checkSavedVisitorId() {
    const savedVisitorId = localStorage.getItem('visitorId');
    if (savedVisitorId) {
      this.visitorId = savedVisitorId;
      this.showVisitorIdPrompt = false;
      this.onVisitorIdSubmit();
    }
  }

  onVisitorIdSubmit() {
    if (this.visitorId && this.visitorId.trim()) {
      this.visitorIdEntered = true;
      this.showVisitorIdPrompt = false;
      localStorage.setItem('visitorId', this.visitorId.trim());
      setTimeout(() => this.spinBtn.nativeElement.focus(), 1000);
    }
  }

  onVisitorIdFocus(): void {
    this.showVisitorIdPrompt = false;
  }

  onVisitorIdBlur(): void {
    if (!this.visitorId || this.visitorId.trim() === '') {
      this.showVisitorIdPrompt = true;
      this.visitorIdEntered = false;
    }
  }

  spinWheel() {
    if (this.isSpinning || this.prizes.length === 0) return;

    if (!this.visitorId || this.visitorId.trim() === '') {
      this.showVisitorIdPrompt = true;
      this.shakeInput();
      this.showApiMessagePopup('Oops!', 'Please enter your Visitor ID first!', 'warning');
      return;
    }

    const visitorId = this.visitorId.trim();
    this.isSpinning = true;

    this.gameService.handleSpin(visitorId).subscribe({
      next: (result: SpinResult) => {
        if (result.status === 'win' && result.prize) {
          this.walletAmount = this.calculateWalletAmount(result.prize.value);
          this.animateWheelToPrize(result.prize);
          this.showApiMessagePopup('Congratulations!', `You won ${result.prize.value}!`, 'success');
        } else if (result.status === 'lose') {
          this.animateWheelToLose();
          this.showApiMessagePopup('Try Again!', 'Better luck next time!', 'info');
        } else if (result.status === 'limit') {
          this.isSpinning = false;
          this.showApiMessagePopup('Spin Limit Reached', result.message || 'Try again tomorrow.', 'warning');
        } else {
          this.isSpinning = false;
          this.showApiMessagePopup('Oops!', result.message || 'Spin failed.', 'error');
        }
      },
      error: () => {
        this.isSpinning = false;
        this.showApiMessagePopup('Error', 'Spin failed. Try again.', 'error');
      }
    });
  }

  calculateWalletAmount(value: string): number {
    const numericValue = parseInt(value.replace(/\D/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
  }

  shakeInput() {
    const inputElement = document.getElementById('visitorId');
    inputElement?.classList.add('shake-animation');
    setTimeout(() => inputElement?.classList.remove('shake-animation'), 500);
  }

  animateWheelToPrize(prize: Prize) {
    const index = this.prizes.findIndex(p => p._id === prize._id);
    const total = this.prizes.length;
    const anglePerPrize = 360 / total;
    const rotateTo = 360 - (index * anglePerPrize) - anglePerPrize / 2;
    const totalRotation = this.currentRotation + (360 * 5) + rotateTo;

    this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'transform 4s ease-out');
    this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${totalRotation}deg)`);
    this.currentRotation = totalRotation;

    setTimeout(() => {
      this.voucherDisplay.nativeElement.innerText = `You won ₹${this.walletAmount} in your 99Gift Wallet!`;
      this.prizeText.nativeElement.innerText = `Your prize will be added after signup.`;
      this.prizeCard.nativeElement.classList.add('show');
      this.fireworksContainer.nativeElement.classList.add('active');

      setTimeout(() => this.fireworksContainer.nativeElement.classList.remove('active'), 3000);

      this.isSpinning = false;
      this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'none');
      this.currentRotation %= 360;
      this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${this.currentRotation}deg)`);
    }, 4200);
  }

  animateWheelToLose() {
    const index = Math.floor(Math.random() * this.prizes.length);
    const total = this.prizes.length;
    const anglePerPrize = 360 / total;
    const rotateTo = 360 - (index * anglePerPrize) - anglePerPrize / 2;
    const totalRotation = this.currentRotation + (360 * 5) + rotateTo;

    this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'transform 4s ease-out');
    this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${totalRotation}deg)`);
    this.currentRotation = totalRotation;

    setTimeout(() => {
      this.loseCard.nativeElement.classList.add('show');
      this.isSpinning = false;
      this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'none');
      this.currentRotation %= 360;
      this.renderer.setStyle(this.wheel.nativeElement, 'transform', `rotate(${this.currentRotation}deg)`);
    }, 4200);
  }

  showSignup() {
    this.prizeCard.nativeElement.classList.remove('show');
    setTimeout(() => {
      this.showSignupForm = true;
    }, 500);
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
      walletAmount: this.walletAmount
    };

    this.gameService.signupUser(payload).subscribe({
      next: (response: SignupResponse) => {
        if (response.success) {
          this.showSignupForm = false;
          setTimeout(() => (this.showSuccessModal = true), 500);
          this.showApiMessagePopup('Success!', 'Account created successfully!', 'success');
        } else {
          this.showApiMessagePopup('Signup Failed', response.message || 'Try again.', 'error');
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        this.showApiMessagePopup('Error', error.message || 'Signup failed.', 'error');
        this.isSubmitting = false;
      }
    });
  }

  closeLoseCard() {
    this.loseCard.nativeElement.classList.remove('show');
    localStorage.removeItem('visitorId');
    this.visitorId = '';
    this.visitorIdEntered = false;
    this.showVisitorIdPopup = true;
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
      gender: 'male'
    };
  }

  createParticles() {}
  createOrbitRings() {}
  simulateAmbientSounds() {}
  showSoundEffect(text: string) {}
  startColorCycle() {}
  regenerateParticles() {}

  ngOnDestroy(): void {
    clearInterval(this.colorInterval);
    clearInterval(this.ambientSoundInterval);
    clearInterval(this.particleInterval);
    clearInterval(this.messageTimeout);
  }
  resetGame() {
    localStorage.clear(); 
    location.reload();    
  }
}
