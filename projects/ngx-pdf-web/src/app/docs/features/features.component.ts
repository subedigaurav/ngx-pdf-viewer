import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HighlightCodeDirective } from '../shared/highlight-code.directive';

@Component({
  selector: 'ngx-features',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, HighlightCodeDirective],
  templateUrl: './features.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: block; }'],
})
export class FeaturesComponent {}
