import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { HighlightCodeDirective } from '../shared/highlight-code.directive';

@Component({
  selector: 'ngx-api',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    HighlightCodeDirective,
  ],
  templateUrl: './api.component.html',
  styles: [':host { display: block; }'],
})
export class ApiComponent {
  readonly apiTab = signal('inputs');
}
