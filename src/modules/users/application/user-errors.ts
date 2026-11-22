export class DuplicateUserEmailError extends Error {
  public constructor() {
    super('A user with this email already exists.');
    this.name = 'DuplicateUserEmailError';
  }
}
