export interface ISignUpVerifyLocationState {
  email: string;
  name: string;
  password: string;
  returnTo?: string;
}

export interface IResetPasswordLocationState {
  email: string;
}
