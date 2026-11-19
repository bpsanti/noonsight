#!/usr/bin/env python3
"""Runs one command under a pseudo-terminal. Commands arrive on stdin as JSON lines:
{"send": "text"} types text into the terminal, {"kill": true} ends the command.
Everything the command prints goes to the log file given as the first argument.
Exits with the command's status."""
import fcntl, json, os, pty, select, signal, struct, sys, termios


def main():
    log = open(sys.argv[1], "ab")
    argv = sys.argv[2:]
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(argv[0], argv)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 160, 0, 0))
    buf = b""
    stdin_open = True
    while True:
        r, _, _ = select.select([fd] + ([0] if stdin_open else []), [], [], 1.0)
        if fd in r:
            try:
                data = os.read(fd, 65536)
            except OSError:
                data = b""
            if not data:
                break
            log.write(data)
            log.flush()
        if 0 in r:
            chunk = os.read(0, 65536)
            if not chunk:
                stdin_open = False
                try:
                    os.kill(pid, signal.SIGHUP)
                except ProcessLookupError:
                    pass
                continue
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                if not line.strip():
                    continue
                cmd = json.loads(line)
                if "send" in cmd:
                    os.write(fd, cmd["send"].encode())
                if cmd.get("kill"):
                    try:
                        os.kill(pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
    _, status = os.waitpid(pid, 0)
    sys.exit(os.waitstatus_to_exitcode(status) if os.waitstatus_to_exitcode(status) >= 0 else 128)


main()
