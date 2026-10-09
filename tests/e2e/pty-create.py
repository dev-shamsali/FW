"""Drives `rhea create` through a real pseudo-terminal: waits for each prompt, sends keys.
Usage: pty-create.py <cwd> <bin.js> <name> <key-spec>...   where key-spec is  "<prompt text>=<keys>"
Keys: D = arrow down, U = arrow up, E = Enter, C = Ctrl+C.   Prints the full terminal output, then EXIT=<code>."""
import os, pty, select, sys, time

cwd, binjs, name, *steps = sys.argv[1:]
KEYS = {"D": b"\x1b[B", "U": b"\x1b[A", "E": b"\r", "C": b"\x03"}
pid, fd = pty.fork()
if pid == 0:
    os.chdir(cwd)
    os.environ["TERM"] = "xterm"
    os.environ.pop("NO_COLOR", None)
    os.execvp("node", ["node", binjs, "create", name] if name != "-" else ["node", binjs, "create"])
buf = b""
deadline = time.time() + 60
queue = [s.split("=", 1) for s in steps]
status = None
while time.time() < deadline:
    r, _, _ = select.select([fd], [], [], 0.2)
    if r:
        try:
            data = os.read(fd, 4096)
        except OSError:
            break
        if not data:
            break
        buf += data
    if queue and queue[0][0].encode() in buf:
        _, keys = queue.pop(0)
        time.sleep(0.15)
        for k in keys:
            os.write(fd, KEYS[k])
            time.sleep(0.05)
        buf += b"\n<<sent %s>>\n" % keys.encode()
    done, st = os.waitpid(pid, os.WNOHANG)
    if done:
        status = st
        # drain
        try:
            while True:
                data = os.read(fd, 4096)
                if not data:
                    break
                buf += data
        except OSError:
            pass
        break
if status is None:
    os.kill(pid, 9)
    _, status = os.waitpid(pid, 0)
sys.stdout.write(buf.decode("utf8", "replace"))
code = os.waitstatus_to_exitcode(status)
sys.stdout.write("\nEXIT=%d\n" % code)
