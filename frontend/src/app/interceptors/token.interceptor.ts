import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem("authToken");
  const authService = inject(AuthService);
  const router = inject(Router)

  if(token){
    const clonedReq = req.clone({
      headers: req.headers.set('Authorization',`Bearer ${token}`)
    })

    return next(clonedReq).pipe(
      tap((event: HttpEvent<any>)=>{
        if(event instanceof HttpResponse){
             // Check for a refreshed token in the response
             if (event.body && event.body.newAccessToken) {
              // If the response contains a new access token, store it
              // this.authService.saveAccessToken(event.body.newAccessToken);
            }
        }
      }),
      catchError((error:any)=>{        
        if(error.status === 401 || error.status === 403){
               // Token is invalid or expired, handle logout or token refresh
               authService.logout();
               router.navigate(['login']) 
        }
        throw error;
      })
    )
  }
  return next(req);
};
