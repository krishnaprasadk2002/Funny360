import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  imports: [CommonModule,FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  isDropdownOpen = false; 
  private authService=inject(AuthService)

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen; 
  }

  logout(){
   this.authService.logout()
  }
}
