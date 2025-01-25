import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment.development';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {

  constructor() { }

  private http = inject(HttpClient);
  private baseUrl: string = environment.baseURL;

  submitCompanyInfo(payload: any) {
    return this.http.post<{ message: string ,companyId:string}>(`${this.baseUrl}company/submitCompanyInfo`, payload).pipe(
      catchError((error) => {
        console.error("Error occurred:", error);
        return throwError(() => new Error(error.error?.error || "Failed to submit the company information."));
      })
    );
  }

  shareCreation(data: any) {
    return this.http.post<{ message: string }>(`${this.baseUrl}company/creationOfShare`, data).pipe(
        catchError((error) => {
            console.error("Share creation error:", error);
            const errorMessage = error.error?.message || "Failed to create shares.";
            return throwError(() => new Error(errorMessage));
        })
    );
}


shareHoldersCreation(data: any): Observable<{ message: string }> {
  return this.http.post<{ message: string }>(`${this.baseUrl}company/shareHoldersInfo`, data).pipe(
    catchError((error) => {
      console.error("Share creation error:", error);
      const errorMessage = error.error?.message || "Failed to create shares.";
      return throwError(() => new Error(errorMessage));
    })
  );
}

getShareCapitalList(companyId: string, userId: string): Observable<{ message: string; data: any }> {
  const params = new HttpParams()
    .set('companyId', companyId)
    .set('userId', userId);
  
  return this.http.get<{ message: string; data: any }>(`${this.baseUrl}company/getShareCapitalList`, { params })
    .pipe(
      catchError((error) => {
        console.error("Shares capital list getting has an error", error);
        const errorMessage = error.error?.message || "Failed to get shares.";
        return throwError(() => new Error(errorMessage));
      })
    );
}

getShareHoldersList(companyId: string, userId: string): Observable<{ message: string; data: any }> {
  const params = new HttpParams()
    .set('companyId', companyId)
    .set('userId', userId);
  
  return this.http.get<{ message: string; data: any }>(`${this.baseUrl}company/getShareHoldersList`, { params })
    .pipe(
      catchError((error) => {
        console.error("Shares Holders list getting has an error", error);
        const errorMessage = error.error?.message || "Failed to get shares holders.";
        return throwError(() => new Error(errorMessage));
      })
    );
}

  
}
