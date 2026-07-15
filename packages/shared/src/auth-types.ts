import type { ITenantUser } from "./tenant-portal-types";
import type { IUser } from "./user";

export interface IPlatformAuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface IAuthRefreshResponse<TUser> {
  accessToken: string;
  user: TUser;
}

export type IPlatformAuthRefreshResponse = IAuthRefreshResponse<IUser>;
export type ITenantAuthRefreshResponse = IAuthRefreshResponse<ITenantUser>;
