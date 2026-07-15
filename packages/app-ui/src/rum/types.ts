export interface IDatadogRumUser {
  email: string;
  id: string;
  name: string;
}

export interface ICreateDatadogRumOptions {
  service: string;
}

export interface IDatadogRumClient {
  clearUser: () => void;
  init: () => void;
  isEnabled: () => boolean;
  setUser: (user: IDatadogRumUser) => void;
  trackError: (error: unknown, context?: Record<string, unknown>) => void;
  trackView: (name: string) => void;
}
