"""Exercise the real ASP.NET Core API without an OpenAI credential."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


def main():
    solution = Path(__file__).resolve().parents[1]
    project = solution / "GaGionEcommerce"
    parser = argparse.ArgumentParser()
    parser.add_argument("--dotnet", default="dotnet")
    parser.add_argument("--assembly", type=Path,
                        default=project / "bin/Debug/net8.0/GaGionEcommerce.dll")
    args = parser.parse_args()
    if not args.assembly.is_file():
        raise SystemExit("Build GaGionEcommerce first or supply --assembly.")

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    for key in tuple(env):
        if key.upper() in {"OPENAI_API_KEY", "OPENAI__APIKEY"}:
            del env[key]
    env.update(ASPNETCORE_ENVIRONMENT="Production", DOTNET_ENVIRONMENT="Production")
    # Command-line override also disables any key accidentally put in appsettings.
    command = [args.dotnet, str(args.assembly.resolve()), "--urls", base,
               "--contentroot", str(project), "--OpenAI:ApiKey=", "--OPENAI_API_KEY="]
    checks = []

    def request(route, payload=None, origin=None):
        headers = {"Content-Type": "application/json"}
        if origin:
            headers["Origin"] = origin
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(base + route, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status, response.read().decode()
        except urllib.error.HTTPError as error:
            return error.code, error.read().decode()

    with tempfile.TemporaryFile(mode="w+b") as log:
        process = subprocess.Popen(command, cwd=project, env=env, stdout=log,
                                   stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                if process.poll() is not None:
                    log.seek(0)
                    raise RuntimeError(log.read().decode())
                try:
                    status, body = request("/api/chat/status")
                    break
                except urllib.error.URLError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("ASP.NET Core did not start.")
            assert status == 200 and json.loads(body) == {"available": False}
            checks.append("Status reports unavailable without exposing credentials")
            invalid = [
                {"message": ""}, {"message": "x" * 1601},
                {"message": "Chào", "history": [{"role": "system", "content": "bad"}]},
                {"message": "Chào", "history": [None]},
                {"message": "Chào", "history": [{"role": "user", "content": "x"}] * 21},
                {"message": "Chào", "context": {"soldOut": list(range(73))}},
            ]
            for payload in invalid:
                assert request("/api/chat", payload)[0] == 400
            checks.append("Empty/oversized questions, forged/null history and excessive context rejected")
            assert request("/api/chat", {"message": "Chào"}, "https://foreign.example")[0] == 403
            checks.append("Foreign browser origin rejected")
            status, body = request("/api/chat", {"message": "Chào"})
            assert status == 503 and json.loads(body)["error"] == "ai_unavailable"
            checks.append("Missing credential produces a safe HTTP 503")
            statuses = [request("/api/chat", {"message": "Chào"})[0] for _ in range(6)]
            assert 429 in statuses
            checks.append("Per-IP request limit returns HTTP 429")
            status, body = request("/staff/")
            assert status == 200 and 'id="adminView"' in body and '<base href="/">' in body
            checks.append("Staff route serves the frontend with correct asset base")
            status, body = request("/api/does-not-exist")
            assert status == 404 and json.loads(body)["error"] == "not_found"
            checks.append("Unknown API returns JSON 404")
            result = {"passed": True, "checks": checks, "provider": "No external API call"}
            (solution / "Tests/api-smoke-results.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False, indent=2))
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
