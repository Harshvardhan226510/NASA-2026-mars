# ARES local integration

The formatted user specification is preserved in docs/ARES_USER_SPEC.md. Desktop implementation follows its dual engine, ChatML and configured model family/hyperparameters. Claims such as completed Mars fine-tuning, fully verified NASA flight rules, zero hallucination, training time and platform throughput are requirements/reference assertions, not verified results of this migration.

## End-user flow

Open **ARES Models**, import your authorized compatible Q8_0 or Q4_K_M GGUF, then select it. Files are inspected and hashed without copying multiple gigabytes. Missing/changed storage, unsupported metadata/quantization/template and inadequate RAM give explicit errors. Context presets are 2,048 (default) through 32,768 tokens subject to model metadata and memory; CPU threads and 300–350 output-token limits are configurable. Temperature stays 0.3 and stops are im_end/endoftext.

The optional approved download is Qwen/Qwen2.5-1.5B-Instruct-GGUF, Q4_K_M, pinned to revision 91cad51170dc346986eccefdc2dd33a9da36ead9. SHA-256: 6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e. Size: 1,117,320,736 bytes. Publisher licence: Apache 2.0. It is visibly labelled **official base, NOT Mars fine-tuned** and requires explicit Online Mode and a download click. No model is selected/downloaded as a hidden substitute.

After selecting weights, enable **Use my local ARES model** in the assistant. Desktop requests use only the app's /api/ares service, including Offline Mode. No separately installed Ollama/Python binding is required. Deterministic map/science commands remain available without weights. Missing current evidence remains unknown; map view centre is not astronaut position. Directive parsing permits only validated map controls/virtual equipment and existing route profiles. EVA_WALKING explicitly maps to direct_safe; unknown named sites do not acquire invented coordinates.

## Runtime and scientific limits

The packaged private CPU runtime is llama.cpp b12032, commit dde879bc4f954b809892fd0d660515f42536394a. scripts/build-inference.mjs verifies the pinned Windows archive and licence, or compiles the exact source on native Linux ARM64/Bookworm. Binaries are build resources, not launch-time downloads. Each inference process binds 127.0.0.1 on an owned random port with an API key, explicit ChatML Jinja template and FP16 key/value cache. Exact ChatML and token limits were checked with a real tokenizer and model on Windows.

Qwen GGUFs can store duplicated tied embedding tensors; storedTensorScalars is not reported as the model's unique parameter count. The publisher's 1.5B family identifier is used. A Llama-family alternative must be explicitly imported with a verified ChatML-compatible tokenizer/fine-tune; the standard Llama template is not silently replaced.

Original mars_eva_q8.gguf / mars_eva_q4_k_m.gguf weights, licence and checksum have not been provided. Original domain accuracy, Q8 footprint, Pi coexistence and operational EVA rule certification remain pending. The real official-base test validates runtime transport and generation, not Mars expertise. See TEST_REPORT.md for actual measurements.

Desktop voice input is now drafted as offline English push-to-talk using a private whisper.cpp tiny.en runtime. Click once to record, click Stop recording (or reach 30 seconds), review the transcript, and press Send. Closing/hiding/reloading or losing window focus cancels recording. No audio is uploaded; temporary WAV/transcript files are deleted after completion/cancellation and app-owned leftovers are removed on next startup. This source draft has not been built or acceptance-tested. Existing v0.1.1 installers retain the disabled microphone. Speech synthesis uses only locally installed voices; missing voices produce an explanation instead of silent failure. An independent offline output pack now has optional Windows installer/Pi first-launch setup and playback integration in source; archive preparation, testing, hosting and catalogue approval remain pending. See docs/ARES_OPTIONAL_VOICE.md. See docs/ARES_VOICE_REVIEW.md.

## Training (developer only)

No training starts implicitly. tools/train_mars_slm.py --inspect-data audits the existing JSONL without importing GPU libraries. The observed train/validation sets contain 5,824/648 records (5,817/648 unique pairs); provenance labels do not establish individual factual authenticity.

The explicit GPU training configuration uses QLoRA rank/alpha 16, dropout 0, all seven specified attention/MLP projections, NF4 base + FP16 compute, adamw_8bit, learning rate 2e-4, cosine schedule, batch 4 with accumulation 4, one epoch and 2,048-token sequences. Export records real discovered Q8_0/Q4_K_M files and hashes; an adapter-only result is not called a completed GGUF. No GPU training, new fine-tune, accuracy evaluation or T4 timing was performed here. Modelfile and tools/run_mars_offline_slm.py remain optional legacy developer recipes.

## User-supplied Q8 weights received — 3 November 2026

The previously missing mars_eva_q8.gguf is now present locally in artifacts/models. Metadata and SHA-256 were inspected, and the supplied training notebook was read. See docs/ARES_MODEL_PROVENANCE.md for the exact file identity, notebook configuration, official base licence and remaining evidence gaps. The file is not bundled, automatically imported or uploaded. Actual inference and platform acceptance remain deferred with the user's final testing/packaging gate.
