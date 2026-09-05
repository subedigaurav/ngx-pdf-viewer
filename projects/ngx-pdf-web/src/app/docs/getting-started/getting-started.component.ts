import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AccordionContent, AccordionGroup, AccordionPanel, AccordionTrigger } from '@angular/aria/accordion';
import { HighlightCodeDirective } from '../shared/highlight-code.directive';

@Component({
  selector: 'ngx-getting-started',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIcon,
    AccordionContent,
    AccordionGroup,
    AccordionPanel,
    AccordionTrigger,
    HighlightCodeDirective,
  ],
  templateUrl: './getting-started.component.html',
  styles: [':host { display: block; }'],
})
export class GettingStartedComponent {}
