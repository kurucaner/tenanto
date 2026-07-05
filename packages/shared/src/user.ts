export enum UserType {
  ADMIN = "admin",
  USER = "user",
}

export interface IUser {
  appleId: string | null;
  createdAt: string;
  email: string;
  googleId: string | null;
  hasPassword?: boolean;
  id: string;
  name: string;
  onboardingCompletedAt: string | null;
  updatedAt: string;
  userType: UserType;
}
