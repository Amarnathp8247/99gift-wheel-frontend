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

  visitorId = '';
  prizes: Prize[] = [];
  currentRotation = 0;
  isSpinning = false;
  visitorIdEntered = false;
  showVisitorIdPopup = false;
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
    mobile: '',
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

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    this.audioEnabled ? this.playAudio('background') : this.audioService.stop('background');
  }

  playAudio(type: 'spinner' | 'win' | 'click' | 'hover' | 'celebration' | 'money' | 'background') {
    if (this.audioEnabled) this.audioService.play(type);
  }

  fetchPrizes() {
    this.gameService.getPrizes().subscribe({
      next: (res: any) => {
        const data = res.data;
        this.prizes = Array.isArray(data) ? data : Object.values(data || {});
      },
      error: () => {
        this.showApiMessagePopup('Error', 'Failed to load prizes.', 'error');
      }
    });
  }

  submitVisitorId() {
    if (!this.visitorId.trim()) {
      this.shakeInput();
      this.showApiMessagePopup('Error', 'Visitor ID cannot be empty.', 'error');
      return;
    }

    this.playAudio('click');
    this.gameService.visiterId(this.visitorId).subscribe({
      next: (result: any) => {
        this.visitorIdEntered = true;
        this.walletAmount = result.walletAmount || 0;
        localStorage.setItem('visitorId', this.visitorId);
        this.showVisitorIdPopup = false;
        this.spinBtn.nativeElement.disabled = false;
        this.playAudio('background');
        this.showApiMessagePopup('Success', result.message, 'success');
      },
      error: (err) => {
        this.showApiMessagePopup('Error', err?.result?.message, 'error');
      }
    });
  }

  spinWheel() {
    if (this.isSpinning || !this.visitorIdEntered) {
      this.showVisitorIdPopup = true;
      this.shakeInput();
      return;
    }

    this.isSpinning = true;
    this.spinBtn.nativeElement.disabled = true;
    this.playAudio('click');
    this.playAudio('spinner');

    this.gameService.handleSpin(this.visitorId).subscribe({
      next: (result: any) => {
        let { result: outcome, prize } = result?.data || {};

        // Normalize prize._id
        if (prize && prize.id && !prize._id) {
          prize._id = prize.id;
        }

        if (outcome === 'win' && prize) {
          this.currentPrize = prize;
          this.walletAmount = prize.walletAmount || 0;
          this.animateWheelToPrize(prize);
        } else {
          this.animateWheelToLose();
        }
      },
      error: () => {
        this.isSpinning = false;
        this.spinBtn.nativeElement.disabled = false;
        this.audioService.stop('spinner');
        this.showApiMessagePopup('Error', 'Spin failed.', 'error');
      }
    });
  }

  animateWheelToPrize(prize: Prize) {
    const index = this.prizes.findIndex((p) => p._id === prize._id);

    if (index === -1) {
      console.warn('Prize not found in prize list', prize);
      this.isSpinning = false;
      this.spinBtn.nativeElement.disabled = false;
      this.audioService.stop('spinner');
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
        this.audioService.stop('spinner');
        this.playAudio('win');
        this.playAudio('celebration');
        this.playAudio('money');

        this.showPrizeCard = true;
        this.showLoseCard = false;

        if (this.walletAmount > 0) {
          this.voucherDisplay.nativeElement.textContent = `You won ₹${this.walletAmount} in your 99Gift Wallet!`;
        } else {
          const valueText = prize.value ? ` worth ${prize.value}` : '';
          this.voucherDisplay.nativeElement.textContent = `You won: ${prize.name}${valueText}`;
        }

        this.prizeText.nativeElement.textContent = prize.description || '';
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

    this.renderer.setStyle(this.wheel.nativeElement, 'transition', 'transform 4s ease-out');
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
    this.showSignupForm = true;
  }

  closePrizeCard() {
    this.playAudio('click');
    this.showPrizeCard = false;
  }

  closeSignupForm() {
    this.playAudio('click');
    this.showSignupForm = false;
    this.showSuccessModal = true;
  }

  onSubmitSignup() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.playAudio('click');

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(this.signupData.mobile)) {
      this.showApiMessagePopup('Validation Error', 'Invalid Indian mobile number.', 'error');
      this.isSubmitting = false;
      return;
    }

    const payload: SignupPayload = {
      ...this.signupData,
      mobile: this.signupData.mobile,
      visitorId: this.visitorId,
      walletAmount: this.walletAmount
    };

    this.gameService.signupUser(payload).subscribe({
      next: (res: any) => {
        this.closeSignupForm();
        this.playAudio('click');
        this.playAudio('celebration');
        if (res.success && res.userId) {
          this.visitorId = res.userId;
          localStorage.setItem('visitorId', this.visitorId);
          this.walletAmount = res.data?.walletAmount || 0;
          this.resetSignupForm();
          this.showSuccessModal = true;
          this.showSignupForm = false;
          this.showApiMessagePopup('Success', res.message, 'success');
          this.playAudio('celebration');
        } else {
          this.showApiMessagePopup('Signup Failed', res.message, 'error');
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        const err = error?.error;
        this.showApiMessagePopup('Error', err?.message || 'Signup failed.', 'error');
        this.isSubmitting = false;
      }
    });
  }

  closeSuccessModal() {
    this.playAudio('click');
    this.showSuccessModal = false;
    this.resetSignupForm();
  }

  closeLoseCard() {
    this.playAudio('click');
    this.showLoseCard = false;
    localStorage.removeItem('visitorId');
    this.visitorId = '';
    this.visitorIdEntered = false;
    this.showVisitorIdPopup = true;
  }

  resetSignupForm() {
    this.signupData = {
      name: '',
      email: '',
      mobile: '',
      password: '',
      city: '',
      gender: 'male',
    };
  }

  shakeInput() {
    const input = document.getElementById('visitorId');
    if (input) {
      input.classList.add('shake-animation');
      setTimeout(() => input.classList.remove('shake-animation'), 500);
    }
  }

  showApiMessagePopup(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info', duration = 5000) {
    this.apiMessageTitle = title;
    this.apiMessageContent = message;
    this.apiMessageType = type;
    this.showApiMessage = true;
    this.messageProgress = 100;
    clearInterval(this.messageTimeout);

    const interval = 50;
    const stepValue = 100 / (duration / interval);
    this.messageTimeout = setInterval(() => {
      this.messageProgress -= stepValue;
      if (this.messageProgress <= 0) this.hideApiMessage();
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

  ngOnDestroy() {
    clearInterval(this.messageTimeout);
    this.audioService.stop('background');
    this.audioService.stop('spinner');
  }
}
