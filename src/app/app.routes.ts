import { Routes } from '@angular/router';
import { SpinnerGameComponent } from './components/spinner-game/spinner-game.component';

export const routes: Routes = [
    { path: '', component: SpinnerGameComponent },
    { path: 'game', component: SpinnerGameComponent }
];
