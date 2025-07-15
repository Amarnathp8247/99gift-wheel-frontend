import { Injectable } from '@angular/core';

type AudioKey = 'spinner' | 'win' | 'click' | 'hover' | 'celebration' | 'money' | 'background';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioElements: Record<AudioKey, HTMLAudioElement> = {} as Record<AudioKey, HTMLAudioElement>;

  constructor() {
    this.initializeAudio();
  }

  private initializeAudio(): void {
    this.audioElements = {
      'spinner': new Audio('assets/audio/bike-back-wheel-coasting-74816.mp3'),
      'win': new Audio('assets/audio/goodresult-82807.mp3'),
      'click': new Audio('assets/audio/computer-mouse-click-351398.mp3'),
      'hover': new Audio('assets/audio/hover-button-287656.mp3'),
      'celebration': new Audio('assets/audio/celebration-sound.mp3'),
      'money': new Audio('assets/audio/money-sound.mp3'),
      'background': new Audio('assets/audio/background-music-224633.mp3')
    };
    
    this.audioElements['background'].loop = true;
  }

  play(sound: AudioKey): void {
    if (this.audioElements[sound]) {
      this.audioElements[sound].currentTime = 0;
      this.audioElements[sound].play();
    }
  }

  stop(sound: AudioKey): void {
    if (this.audioElements[sound]) {
      this.audioElements[sound].pause();
      this.audioElements[sound].currentTime = 0;
    }
  }

  setVolume(sound: AudioKey, volume: number): void {
    if (this.audioElements[sound]) {
      this.audioElements[sound].volume = volume;
    }
  }

  toggleBackgroundMusic(): void {
    if (this.audioElements['background'].paused) {
      this.setVolume('background', 0.3);
      this.play('background');
    } else {
      this.stop('background');
    }
  }

  getPlaybackRate(sound: AudioKey): number {
    return this.audioElements[sound]?.playbackRate || 1;
  }
  
  setPlaybackRate(sound: AudioKey, rate: number): void {
    if (this.audioElements[sound]) {
      this.audioElements[sound].playbackRate = rate;
    }
  }
}