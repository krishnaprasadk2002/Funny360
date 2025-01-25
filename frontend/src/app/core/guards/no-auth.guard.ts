import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const noAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router); 

  if (!authService.isLoggedIn()) {
    return true; 
  } else {
    router.navigate(['/user-dashboard']); 
    return false; 
  }
};
