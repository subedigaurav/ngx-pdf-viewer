import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';
import Prism from 'prismjs';

Prism.manual = true;

import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';

@Directive({
  selector: '[ngxHighlightCode]',
  standalone: true,
})
export class HighlightCodeDirective implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    Prism.highlightAllUnder(this.host.nativeElement);
  }
}
