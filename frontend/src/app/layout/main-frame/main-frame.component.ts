import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-main-frame',
  imports: [RouterOutlet,HeaderComponent,FooterComponent],
  templateUrl: './main-frame.component.html',
  styleUrl: './main-frame.component.css'
})
export class MainFrameComponent {

}
