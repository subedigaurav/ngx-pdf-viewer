import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ngx-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [':host { display: block; height: 100%; background: var(--mat-sys-background); }'],
})
export class App {}
