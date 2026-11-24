/** A command line that cannot be run as written. The CLI prints the message and the usage, and exits with 2. */
export class UsageError extends Error {
    usage;
    constructor(message, usage) {
        super(message);
        this.usage = usage;
        this.name = 'UsageError';
    }
}
//# sourceMappingURL=usage.js.map