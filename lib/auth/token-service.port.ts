export interface ITokenService {
  getToken(options?: { forceRefresh?: boolean }): Promise<string | null>;
}
