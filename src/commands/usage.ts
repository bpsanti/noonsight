/** A command line that cannot be run as written. The CLI prints the message and the usage, and exits with 2. */
export class UsageError extends Error {
  constructor(
    message: string,
    readonly usage: string,
  ) {
    super(message);
    this.name = 'UsageError';
  }
}
