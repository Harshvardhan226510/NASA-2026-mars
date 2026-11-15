#!/usr/bin/env python3
"""
Mars Field Atlas: Local Offline Runner for Fine-Tuned NASA Mars SLM (GGUF).
Runs 100% offline edge inference with mars_eva_q8.gguf.

Usage:
  1. Interactive CLI:
     python tools/run_mars_offline_slm.py

  2. Local HTTP Server for ARES Web Assistant:
     python tools/run_mars_offline_slm.py --serve --port 8000

Supported engines:
  - llama-cpp-python (pip install llama-cpp-python)
  - Ollama (ollama create mars-ares -f Modelfile && ollama run mars-ares)
"""

import os
import sys
import argparse
import json
from pathlib import Path

# Search candidate locations for the downloaded GGUF file
SEARCH_PATHS = [
    Path("mars_eva_q8.gguf"),
    Path("data/mars_eva_q8.gguf"),
    Path("models/mars_eva_q8.gguf"),
    Path.home() / "Downloads" / "mars_eva_q8.gguf",
]

def find_model_path():
    for p in SEARCH_PATHS:
        if p.exists() and p.is_file():
            return str(p.resolve())
    return None

def run_interactive(model_path):
    print("=" * 70)
    print("🔴 ARES MARS TACTICAL CO-PILOT: 100% OFFLINE INFERENCE")
    print(f"Model: {model_path}")
    print("Trained on: NASA PDS CRISM/OMEGA, USGS Gazetteer, HLS2 Flight Rules")
    print("Type your tactical query (or 'exit' to quit):")
    print("=" * 70)

    try:
        from llama_cpp import Llama
    except ImportError:
        print("\n[!] 'llama-cpp-python' is not installed in this Python environment.")
        print("To install it with CPU or GPU support:")
        print("    pip install llama-cpp-python\n")
        print("Alternatively, to use Ollama with your GGUF file:")
        print("    1. Create a file named 'Modelfile' with:")
        print(f"       FROM {model_path}")
        print("       PARAMETER temperature 0.3")
        print("    2. Run:")
        print("       ollama create mars-ares -f Modelfile")
        print("       ollama run mars-ares")
        return

    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_threads=os.cpu_count() or 4,
        verbose=False
    )

    system_prompt = (
        "You are ARES, an Autonomous Mars Extravehicular Activity (EVA) Tactical Co-Pilot. "
        "You are 100% offline, operating on rover/suit edge hardware. "
        "Ground all terrain and navigational advice strictly in NASA Planetary Data System (PDS) observations, "
        "USGS planetary nomenclature, and NASA HLS2 bioenergetic EVA flight rules (e.g. max safe slope <= 15°, impassable barrier > 22°)."
    )

    while True:
        try:
            query = input("\n👨‍🚀 Astronaut: ").strip()
            if not query:
                continue
            if query.lower() in ["exit", "quit", "q"]:
                print("ARES Tactical Co-Pilot signing off. Safe traverse.")
                break

            prompt = (
                f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
                f"<|im_start|>user\n{query}<|im_end|>\n"
                f"<|im_start|>assistant\n"
            )

            print("🔴 ARES: ", end="", flush=True)
            output = llm(
                prompt,
                max_tokens=350,
                stop=["<|im_end|>", "<|endoftext|>"],
                echo=False,
                temperature=0.3
            )
            resp = output["choices"][0]["text"].strip()
            print(resp)

        except KeyboardInterrupt:
            print("\nSession interrupted.")
            break

def run_server(model_path, port=8000):
    from http.server import HTTPServer, BaseHTTPRequestHandler

    try:
        from llama_cpp import Llama
    except ImportError:
        print("[!] 'llama-cpp-python' is required for the local HTTP server.")
        print("Install: pip install llama-cpp-python")
        return

    print(f"Loading {model_path} into memory...")
    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_threads=os.cpu_count() or 4,
        verbose=False
    )
    print("Model ready!")

    class ChatHandler(BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_POST(self):
            if self.path == "/api/chat":
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length).decode("utf-8")
                data = json.loads(body)
                query = data.get("query", "")

                prompt = (
                    f"<|im_start|>system\nYou are ARES, an Autonomous Mars EVA Tactical Co-Pilot.<|im_end|>\n"
                    f"<|im_start|>user\n{query}<|im_end|>\n"
                    f"<|im_start|>assistant\n"
                )

                output = llm(prompt, max_tokens=300, stop=["<|im_end|>"], temperature=0.3)
                reply = output["choices"][0]["text"].strip()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"response": reply}).encode("utf-8"))
            else:
                self.send_response(404)
                self.end_headers()

    server = HTTPServer(("127.0.0.1", port), ChatHandler)
    print(f"🔴 ARES Edge Inference Server running at http://127.0.0.1:{port}/api/chat")
    print("The web app will automatically route assistant queries here when active.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ARES Mars Tactical SLM Runner")
    parser.add_argument("--model", type=str, default=None, help="Path to mars_eva_q8.gguf")
    parser.add_argument("--serve", action="store_true", help="Start local HTTP API server")
    parser.add_argument("--port", type=int, default=8000, help="Port for HTTP API server")
    args = parser.parse_args()

    model_file = args.model or find_model_path()
    if not model_file:
        print("=" * 70)
        print("⚠️  mars_eva_q8.gguf was not found in current folder, /data, or /Downloads.")
        print("Please place 'mars_eva_q8.gguf' into the project root or data/ directory:")
        print("    copy ~/Downloads/mars_eva_q8.gguf ./data/")
        print("Or specify its path manually:")
        print("    python tools/run_mars_offline_slm.py --model path/to/mars_eva_q8.gguf")
        print("=" * 70)
        sys.exit(1)

    if args.serve:
        run_server(model_file, args.port)
    else:
        run_interactive(model_file)
