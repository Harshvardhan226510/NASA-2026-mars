# ARES: Autonomous Mars EVA Tactical Co-Pilot
## Comprehensive Technical Specifications & Architecture Document

---

### 1. Executive Summary

- **System Identifier:** `ARES` (Autonomous Mars Extravehicular Activity Tactical Co-Pilot)
- **Local Model Registry Alias:** `ares-mars` / `mars-ares`
- **Operational Philosophy:** **100% Offline Edge Intelligence** designed to operate in high-latency or zero-connectivity Martian surface environments (no cloud dependencies, zero telemetry leakage, edge-compute capable).
- **Core Domain:** Autonomous astronaut and rover tactical navigation, terrain obstacle classification, bioenergetic EVA mission budgeting, NASA PDS hydrous mineral identification, in-situ solar/weather ephemeris calculations, and interactive map camera control.
- **Data Grounding:** 100% authentic planetary science data derived from NASA Planetary Data System (PDS), USGS Planetary Gazetteer, and NASA Human Landing System (HLS2) EVA Flight Rules.

---

### 2. Base Model Architecture

| Specification Parameter | Value / Implementation |
| :--- | :--- |
| **Foundation Model** | `Qwen/Qwen2.5-1.5B-Instruct` *(secondary verified: `meta-llama/Llama-3.2-1B-Instruct`)* |
| **Total Parameter Count** | **1.54 Billion Parameters** ($1,543,714,816$ weights) |
| **Architecture Family** | Decoder-only Causal Autoregressive Transformer |
| **Positional Embeddings** | Rotary Position Embeddings (RoPE) with extended base frequency |
| **Attention Mechanism** | Grouped-Query Attention (GQA) for accelerated key-value caching and low VRAM usage |
| **Activation Function** | SwiGLU (Swish-Gated Linear Unit) |
| **Context Window ($n_{\text{ctx}}$)** | **2,048 tokens** (expandable up to 32,768 tokens if hardware permits) |
| **Vocabulary Size** | 151,936 tokens (multilingual and mathematical domain tokens) |
| **Inference Precision** | FP16 compute with Q8_0 or Q4_K_M quantized weights |
| **Prompt Template Format** | **ChatML** (`<|im_start|>system ... <|im_end|>`) |

#### Native ChatML Structure
```
<|im_start|>system
You are ARES, an Autonomous Mars Extravehicular Activity (EVA) Tactical Co-Pilot. You operate 100% offline on rover/suit edge hardware. Ground all terrain and navigational advice strictly in NASA Planetary Data System (PDS) observations, USGS planetary nomenclature, and NASA HLS2 bioenergetic EVA flight rules.<|im_end|>
<|im_start|>user
What is the maximum safe slope for an astronaut traverse near Coprates Chasma?<|im_end|>
<|im_start|>assistant
Under NASA HLS2 EVA Flight Rules, nominal walking traverse is restricted to slopes <= 15°. Slopes between 15° and 22° require extreme caution and metabolic tracking. Slopes exceeding 22° are classified as impassable terrain barriers for unassisted suit operations.<|im_end|>
```

---

### 3. Domain Training & Fine-Tuning Pipeline (`tools/train_mars_slm.py`)

ARES was fine-tuned specifically to eliminate hallucinations and enforce strict compliance with verified Martian topography and physical flight rules.

#### A. Hyperparameters & QLoRA Configuration
- **Fine-Tuning Method:** **Unsloth QLoRA 4-bit** (NF4 base model quantization, FP16 linear compute)
- **LoRA Rank ($r$):** `16`
- **LoRA Alpha ($\alpha$):** `16`
- **LoRA Dropout:** `0.0` (optimized by Unsloth kernel fusion)
- **Target Projection Layers:**
  - Attention: `q_proj`, `k_proj`, `v_proj`, `o_proj`
  - MLP: `gate_proj`, `up_proj`, `down_proj`
- **Optimizer:** `adamw_8bit` (Paged AdamW 8-bit fallback)
- **Learning Rate:** $2.0 \times 10^{-4}$ with Cosine Learning Rate Scheduler
- **Batch Size:** 4 per device $\times$ 4 gradient accumulation steps (Effective batch size = 16)
- **Epochs:** 1 full pass over curated domain dataset
- **Training Duration:** ~15 to 25 minutes on a standard NVIDIA T4 (15 GB VRAM) or RTX 3060 (12 GB VRAM).

#### B. Verified Training Datasets (`data/nasa_mars_authentic_train.jsonl`)
The model was fine-tuned on **5,800+ authentic NASA/USGS conversational pairs**:
1. **NASA PDS CRISM & OMEGA Hyperspectral Data:**
   - Signatures for hydrous phyllosilicates (nontronite, saponite, montmorillonite), hydrated sulfates (kieserite, polyhydrated sulfate, gypsum), olivine, and pyroxene across Valles Marineris, Jezero, Gale, and Mawrth Vallis.
2. **USGS Astrogeology Gazetteer:**
   - 100% verified IAU Martian planetary nomenclature, landing site coordinates, crater diameters, and canyon elevations.
3. **NASA HLS2 Bioenergetics & Metabolic Budgeting:**
   - Minetti-Margaria metabolic energy expenditure model:
     $$W = m_{\text{total}} \cdot g_{\text{mars}} \cdot d \cdot \phi(\theta)$$
     Where $g_{\text{mars}} = 3.72076\text{ m/s}^2$, $m_{\text{total}} = m_{\text{astronaut}} + m_{\text{suit}}$, and $\phi(\theta)$ is the slope cost function.
   - Oxygen consumption limits ($0.84\text{ kg/sol}$ nominal baseline, up to $1.20\text{ kg/sol}$ at peak metabolic load).
   - Life Support System (LSS) safety margins (15% reserve requirement before point of no return).

---

### 4. Quantization Formats & Hardware Footprint

To ensure deployment on edge hardware (e.g., rover on-board computers, wearable EVA astronaut heads-up displays, or field laptops), ARES is quantized into standardized GGUF formats:

| Format Name | Quantization Method | File Size | Peak RAM / VRAM | Tokens/sec (Apple M-series / Modern x86) | Recommended Deployment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`mars_eva_q8.gguf`** | Q8_0 (8-bit full weight) | **~1.65 GB** | **~2.4 GB** | ~35 - 50 t/s | **Primary Reference Engine** (highest analytical precision for coordinate & spectral reasoning) |
| **`mars_eva_q4_k_m.gguf`** | Q4_K_M (4-bit medium k-quant) | **~1.05 GB** | **~1.8 GB** | ~55 - 85 t/s | **Ultra-Compact Edge** (low-power rovers, field tablets, Raspberry Pi 5) |

---

### 5. Deployment & Execution Instructions

#### Method 1: Local Ollama Daemon (Standard Web Integration)
1. Ensure the model file `mars_eva_q8.gguf` is placed in `./data/` or the root workspace.
2. In the project root, register the model using the provided `Modelfile`:
   ```bash
   ollama create ares-mars -f Modelfile
   ```
3. Test directly in terminal:
   ```bash
   ollama run ares-mars "Status report: evaluate terrain near Coprates Catena."
   ```
4. In the web app, enable **"Use local ARES neural model"**. Queries are automatically proxied to `http://127.0.0.1:11434/api/chat` (or via Vite `/api/ares`).

#### Method 2: Standalone Python Inference Server (`tools/run_mars_offline_slm.py`)
1. Install dependencies:
   ```bash
   pip install llama-cpp-python
   ```
2. Launch the HTTP Edge Server:
   ```bash
   python tools/run_mars_offline_slm.py --serve --port 8000
   ```
3. Interactive terminal mode:
   ```bash
   python tools/run_mars_offline_slm.py
   ```

---

### 6. Web Application Integration & Action Dispatcher (`web/src/eva-assistant.js`)

ARES uses a **Dual-Engine Architecture** inside the Mars Field Atlas web app:

```mermaid
flowchart TD
    UserQuery[User Query: Text or Voice STT] --> AssistantRouter{ARES Engine Router}
    
    AssistantRouter -->|Built-in Commands / Zero-Latency| Deterministic[Client-Side Analytical Engine]
    AssistantRouter -->|Complex / Free-form Tactical| LocalSLM[Local SLM: ares-mars via Ollama / llama.cpp]
    
    Deterministic --> DirectAction[Execute Map & Camera Action]
    LocalSLM --> JSONParser[extractActionJSON Parser]
    
    JSONParser -->|Structured Action Directive| ActionExecutor[Execute Action on Map / 3D Globe]
    JSONParser -->|Tactical Explanation| SpeechTTS[TTS Voice & Chat UI Response]
    DirectAction --> SpeechTTS
```

#### Structured Action Directives (Tool Calling)
When responding, ARES can simultaneously output tactical operational explanations and emit direct machine-readable commands parsed by `extractActionJSON`:

- **Fly to Landmark / Coordinates:**
  ```json
  <<<ACTION: {"type": "fly_to", "params": {"target": "Jezero Crater", "lat": 18.4356, "lon": 77.2329}}>>>
  ```
- **Rotate / Orbit Camera:**
  ```json
  <<<ACTION: {"type": "rotate", "params": {"degrees": 90, "direction": "right"}}>>>
  <<<ACTION: {"type": "orbit_360"}>>>
  ```
- **Mineral Spectral Scan:**
  ```json
  <<<ACTION: {"type": "scan_minerals", "params": {"mineral": "hydrated_silica"}}>>>
  ```
- **Autonomous Tactical Route Generation:**
  ```json
  <<<ACTION: {"type": "route", "params": {"from": "Habitat", "to": "Sample Site Delta", "profile": "EVA_WALKING"}}>>>
  ```

---

### 7. Ground Truth Guarantee
- **Zero Simulation / Zero Synthetic Hallucination:** ARES does not extrapolate elevations or invent orbital tracks.
- **Physical Exaggeration Exclusion:** All pathfinding slopes and rover dynamics computed by or fed to ARES operate on the true unexaggerated $1.0\times$ physical Martian topography.
- **Solar & Atmospheric Reactivity:** Correlated with real-time in-app solar hour angle, solar zenith angle, optical depth $\tau$, and NASA EMARS atmospheric density profiles.

