import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor() { }
  private http = inject(HttpClient);
  private baseUrl: string = environment.baseURL;
  private router=inject(Router)
  
  // login(data:any):Observable<any>{
  //   return this.http.post(`${this.baseUrl}user/login`,data)
  // }

  login(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}user/login`, data).pipe(
      catchError((error) => {
        console.error('Error during login:', error);
        return throwError(() => new Error('Login failed. Please try again.'));
      })
    );
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}user/register`, data).pipe(
      catchError((error) => {
        console.error('Error registering user:', error);
        return throwError(() => new Error('Registration failed. Please try again.'));
      })
    );
  }

  verifyOtp(data: { email: string; twoFactorCode: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}user/verify-otp`, data).pipe(
      catchError((error) => {
        console.error('Two Factor Verification Error:', error);
        return throwError(() => new Error('OTP verification failed. Please check your code and try again.'));
      })
    );
  }

  resendCode(payload: { email: string }) {
    return this.http.post(`${this.baseUrl}user/resendCode`, payload).pipe(
      catchError((error) => {
        console.error('Resend code not working', error);
        return throwError(() => new Error('Failed to resend the code. Please try again later.'));
      })
    );
  }

  // logout() {
  //   return  this.http.post(`${this.baseUrl}/user/logout`, {}).pipe(
  //     catchError((error) => {
  //       console.error('Logout not working', error);
  //       return throwError(() => new Error('Failed to log out. Please try again later.'));
  //     }))
  // }

  logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
}

isLoggedIn(): boolean {
  const userId = localStorage.getItem('userId');
  return userId !== null; 
}



  


  // logout(){
  //   localStorage.removeItem("authToken");
  // }

}
