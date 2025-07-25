import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
export interface Prize {
  _id: string;
  name: string;
  cardClass?: string;
  brand?: string;
  value: string;
  codePrefix?: string;
  walletAmount?: number;  // <-- Add this line
  description?: string;
}

export interface SpinResult {
  status: 'win' | 'lose' | 'limit' | 'error';
  prize?: Prize;
  walletAmount?: number;
  message?: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  mobile: string;
  gender: string;
  password: string;
  city: string;
  visitorId: string;
  walletAmount: number;
}
export interface SignupResponse {
  success: boolean;
  message?: string;
  userId?: string;
  data?: {
    id: string;
    name: string;
    email: string;
    mobile: string;
    walletAmount: number;
    totalWins: number;
    totalLoses: number;
  };
}
@Injectable({
  providedIn: 'root'
})
export class GameService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}


  visiterId(visitorId: string): Observable<SpinResult> {
    return this.http.post<SpinResult>(`${this.baseUrl}/user/anonymous-user`, { visitorId });
  }
  getPrizes(): Observable<Prize[]> {
    return this.http.get<Prize[]>(`${this.baseUrl}/admin/spin/prizes`);
  }

  handleSpin(visitorId: string): Observable<SpinResult> {
    return this.http.post<SpinResult>(`${this.baseUrl}/admin/spin/handle/wheel`, { visitorId });
  }

  signupUser(payload: SignupPayload): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.baseUrl}/auth/register`, payload);
  }
}
