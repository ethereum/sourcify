export class SourcifyLibError extends Error {
  public code: number;
  constructor(message: string, code: number = 1000) {
    super(message);
    this.code = code;
    this.name = 'SourcifyLibError';
  }
}
