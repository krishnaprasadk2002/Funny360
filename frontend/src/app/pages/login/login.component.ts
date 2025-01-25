import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../core/services/auth.service';
import { errorMessages } from '../../constant';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  private fb = inject(FormBuilder);
  private cdrf = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage: string = '';
  emailError: string = '';
  passwordError: string = '';
  show2FA: boolean = false;
  loginEmail: string = '';
  showResend: boolean = false; 
  timer: number = 0; 
  interval: any;

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required]),
      otp: new FormControl({ value: '', disabled: true }, [Validators.required]),
    });
  }

  onlogin() {
    if (this.show2FA) {
      this.verify2FA();
      return;
    }
  
    if (this.loginForm.valid) {
      this.resetErrors();
      this.loginEmail = this.loginForm.value.email;
  
      this.authService.login(this.loginForm.value).subscribe({
        next: (res) => {
          console.log('login response ', res);
          if (res.requiresOtp) {
            this.show2FA = true;
            this.loginForm.get('otp')?.enable();
            this.cdrf.detectChanges();
            this.startTimer(); 
          } else {
            localStorage.setItem('token', res.token); 
            localStorage.setItem('userId', res.user.id); 
            Swal.fire({
              icon: 'success',
              title: 'Login Successful',
              text: 'Welcome back!',
            });
            this.router.navigate(['/user-dashboard']);
          }
        },
        error: (err) => {
          if (err.error.status === 400) {
            console.log(err.error);
            if (err.error.message === errorMessages.INVALID_EMAIL) {
              this.emailError = err.error.message;
            } else if (err.error.message === errorMessages.INVALID_PASSWORD) {
              this.passwordError = err.error.message;
            }
          }
        },
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
  
  verify2FA() {
    const otpValue = this.loginForm.value.otp;
    const emailValue = this.loginEmail;

    if (this.loginForm.get('otp')?.valid) {
      this.authService.verifyOtp({ email: emailValue, twoFactorCode: otpValue }).subscribe({
        next: (res) => {
          console.log('OTP verification successful:', res);
          Swal.fire({
            icon: 'success',
            title: 'Verification Successful',
            text: 'Your OTP has been verified successfully!',
          });
          this.router.navigate(['/user-dashboard']);
        },
        error: (err) => {
          console.error('OTP verification failed:', err);
          Swal.fire({
            icon: 'error',
            title: 'Verification Failed',
            text: err.error.message || 'Please check your OTP and try again.',
          });
        },
      });
    } else {
      this.loginForm.get('otp')?.markAsTouched();
    }
  }

  resetErrors() {
    this.emailError = '';
    this.passwordError = '';
  }

  startTimer() {
    this.showResend = false;
    this.timer = 60; 
    this.interval = setInterval(() => {
      this.timer--;
      if (this.timer <= 0) {
        clearInterval(this.interval);
        this.showResend = true; 
      }
    }, 1000); 
  }

  resendCode() {
    this.authService.resendCode({ email: this.loginEmail }).subscribe({
      next: (res) => {
        console.log('OTP resent:', res);
        Swal.fire({
          icon: 'success',
          title: 'Code Resent',
          text: 'A new OTP has been sent to your email.',
        });
        this.startTimer(); 
      },
      error: (err) => {
        console.error('Resend failed:', err);
        Swal.fire({
          icon: 'error',
          title: 'Resend Failed',
          text: err.error.message || 'Unable to resend OTP. Please try again later.',
        });
      },
    });
  }
}

