import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  

  const cloned = req.clone({
    headers: req.headers.set('Content-Type', 'application/json'),
    withCredentials:true,
  });
  return next(cloned);
};