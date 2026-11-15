# 🛠️ Mission Engineering, 3D Assets & Edge AI Tooling Suite

> **Developer Utilities, Procedural 3D Mesh Generators, and SLM Fine-Tuning Pipelines**  
> NASA Space Apps Challenge 2026 — *Interplanetary Survival Guide: Martian Map*

---

## 📌 Executive Overview

The `tools/` directory contains automated engineering utilities supporting:
1. **Procedural 3D Asset Synthesis**: Generating physically accurate, clamped-to-ground glTF 2.0 PBR models of Martian base infrastructure.
2. **NASA PDS Data Engineering**: Scraping, cleaning, and structuring raw NASA Planetary Data System (PDS) science releases into instruction-tuning corpora.
3. **Edge AI Model Training**: Fine-tuning, quantizing, and deploying domain-specific Small Language Models (SLMs) for 100% offline EVA operations.

---

## 🧰 Tool Inventory & Capabilities

### 1. `build_equipment_glbs.py` — Procedural 3D glTF Equipment Generator
* **Purpose**: Generates high-performance, compact glTF 2.0 binary (`.glb`) assets with physically-based rendering (PBR) metallic-roughness materials for all 9 deployable mission infrastructure modules.
* **Supported Models**:
  1. `crew_hab.glb`: Hexagonal pressurized crew habitat core with airlocks and radiator ribs.
  2. `greenhouse_dome.glb`: Geodesic botanical dome with translucent glass panels and internal biomass racks.
  3. `nuclear_reactor.glb`: Kilopower-class Stirling reactor with radial heat rejection fins.
  4. `isru_plant.glb`: Sabatier methanation plant with cryogenic methane/LOX storage spheres.
  5. `crew_rover.glb`: 6-wheel pressurized exploration rover with articulating rocker-bogie chassis.
  6. `solar_array.glb`: UltraFlex dual circular solar array wings with central mast.
  7. `comms_mast.glb`: X-band parabolic dish antenna and omnidirectional UHF tactical whip.
  8. `seis_station.glb`: InSight-style Wind and Thermal Shield (WTS) dome with leveling cradle.
  9. `weather_station.glb`: REMS/MEDA meteorological boom with sonic anemometer and radiation sensors.
* **Execution**:
  ```bash
  python tools/build_equipment_glbs.py
  ```
  *Outputs optimized `.glb` files into `apps/web/public/equipment/models/` (each under 12 KB for instant streaming).*

---

### 2. `extract_nasa_pds_dataset.py` — NASA PDS Corpus Extractor
* **Purpose**: Ingestion pipeline that processes raw NASA technical reports, Curiosity/Perseverance mission science diaries, and InSight seismic event tables into standardized JSONL instruction pairs.
* **Key Features**:
  * Strips boilerplate and parses authentic planetary science facts (e.g., atmospheric scale height, solar flux variations, mineral spectral bands).
  * Automatically deduplicates and validates schema conformity against `train` and `val` splits.
* **Execution**:
  ```bash
  python tools/extract_nasa_pds_dataset.py --input-dir /path/to/pds/archives --output-train packages/data/nasa_mars_authentic_train.jsonl --output-val packages/data/nasa_mars_authentic_val.jsonl
  ```

---

### 3. `mars_finetune_colab.ipynb` — GPU Fine-Tuning Notebook
* **Purpose**: Fully reproducible Google Colab notebook designed for free-tier T4 or A100 GPUs.
* **Key Features**:
  * Utilizes `Unsloth` / `PEFT` / `bitsandbytes` for 4-bit QLoRA fine-tuning.
  * Base Foundation Models: `Qwen/Qwen2.5-1.5B-Instruct` or `Llama-3.2-1B-Instruct`.
  * Exports directly into merged FP16 weights or quantized GGUF (`q4_k_m` or `q8_0`) for offline on-device execution.

---

### 4. `train_mars_slm.py` — Standalone Local Training Script
* **Purpose**: CLI training script for local GPU workstations running PyTorch and HuggingFace Transformers.
* **Key Hyperparameters**:
  * Rank $r = 16$, LoRA Alpha $\alpha = 32$, Target Modules: `q_proj, k_proj, v_proj, o_proj`.
  * Learning Rate: $2 \times 10^{-4}$ with Cosine Annealing scheduler.
  * Gradient accumulation steps: 4; Effective batch size: 16.
* **Execution**:
  ```bash
  python tools/train_mars_slm.py --base-model Qwen/Qwen2.5-1.5B-Instruct --dataset packages/data/nasa_mars_authentic_train.jsonl --output-dir models/mars-slm-lora
  ```

---

### 5. `run_mars_offline_slm.py` — Offline SLM Inference & Benchmark Harness
* **Purpose**: Fast local inference runner connecting to Ollama or llama.cpp.
* **Key Features**:
  * Evaluates responses against authentic mission benchmarks (terrain hazard detection, Minetti metabolic estimation, communications blackout predictions).
  * Demonstrates 100% offline inference with zero internet connection required.
* **Execution**:
  ```bash
  # Test interactive CLI mode
  python tools/run_mars_offline_slm.py --interactive

  # Run automated benchmark evaluation
  python tools/run_mars_offline_slm.py --eval packages/data/nasa_mars_authentic_val.jsonl
  ```

---

## 📁 Directory Structure

```
tools/
├── build_equipment_glbs.py         # Procedural 3D glTF PBR equipment generator
├── extract_nasa_pds_dataset.py     # PDS text extraction & structuring pipeline
├── mars_finetune_colab.ipynb       # Colab GPU notebook for LoRA fine-tuning
├── train_mars_slm.py               # Local training script for domain adaptation
├── run_mars_offline_slm.py         # Offline inference runner and benchmark harness
└── README.md                       # This documentation
```
