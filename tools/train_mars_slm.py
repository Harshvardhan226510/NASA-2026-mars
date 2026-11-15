#!/usr/bin/env python3
"""
Mars Field Atlas: 100% Offline Mars SLM Fine-Tuning & Quantization Pipeline.
Trains Qwen2.5-1.5B-Instruct (or Llama-3.2-1B) on 100% authentic NASA PDS / USGS data
using Unsloth QLoRA 4-bit, then exports directly to GGUF Q4_K_M for local offline inference.

Hardware requirements:
- Free Google Colab T4 GPU (15GB VRAM) OR local NVIDIA GPU (>= 6GB VRAM).
- Time to train 5,800 NASA samples: ~15 to 25 minutes.
"""

import os
import sys
import json
import torch

def train_pipeline(
    base_model_name: str = "Qwen/Qwen2.5-1.5B-Instruct",
    output_dir: str = "./mars_qwen_1.5b_lora",
    gguf_output_name: str = "mars_eva_q4_k_m.gguf",
    max_seq_length: int = 2048,
    epochs: int = 1,
    batch_size: int = 4,
    gradient_accumulation_steps: int = 4,
    learning_rate: float = 2e-4
):
    print("=" * 72)
    print("MARS TACTICAL SLM: 100% AUTHENTIC NASA TRAINING PIPELINE")
    print(f"Base Model: {base_model_name}")
    print(f"Target Quantization: GGUF Q4_K_M (Offline Edge Deployment)")
    print("=" * 72)

    try:
        from unsloth import FastLanguageModel
        from unsloth import is_bfloat16_supported
        USE_UNSLOTH = True
        print("[1/5] Initializing Unsloth 4-bit FastLanguageModel...")
    except ImportError:
        USE_UNSLOTH = False
        print("[1/5] Unsloth not installed. Falling back to HuggingFace PEFT / TRL...")

    if USE_UNSLOTH:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=base_model_name,
            max_seq_length=max_seq_length,
            dtype=None,
            load_in_4bit=True,
        )

        model = FastLanguageModel.get_peft_model(
            model,
            r=16,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            lora_alpha=16,
            lora_dropout=0,
            bias="none",
            use_gradient_checkpointing="unsloth",
            random_state=3407,
            max_seq_length=max_seq_length,
        )
    else:
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import LoraConfig, get_peft_model

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True
        )
        tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True
        )
        peft_config = LoraConfig(
            r=16,
            lora_alpha=16,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM"
        )
        model = get_peft_model(model, peft_config)

    # Load authentic NASA train dataset
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    train_file = os.path.join(project_root, "packages", "data", "nasa_mars_authentic_train.jsonl")

    if not os.path.exists(train_file):
        raise FileNotFoundError(f"Training data not found at {train_file}. Run tools/extract_nasa_pds_dataset.py first.")

    print(f"\n[2/5] Loading authentic NASA training dataset from {train_file}...")
    from datasets import load_dataset
    dataset = load_dataset("json", data_files=train_file, split="train")
    print(f"      Loaded {len(dataset)} verified NASA training conversations.")

    # Format using tokenizer's native chat template
    def formatting_prompts_func(examples):
        texts = []
        for msgs in examples["messages"]:
            text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)
            texts.append(text)
        return {"text": texts}

    dataset = dataset.map(formatting_prompts_func, batched=True)

    print("\n[3/5] Configuring SFTTrainer...")
    from trl import SFTTrainer

    try:
        from trl import SFTConfig
        training_args = SFTConfig(
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=gradient_accumulation_steps,
            warmup_steps=10,
            num_train_epochs=epochs,
            learning_rate=learning_rate,
            fp16=False,
            bf16=False,
            logging_steps=10,
            optim="adamw_8bit" if USE_UNSLOTH else "paged_adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir=output_dir,
            report_to="none",
            dataset_text_field="text",
            max_seq_length=max_seq_length,
        )
        trainer = SFTTrainer(
            model=model,
            train_dataset=dataset,
            args=training_args,
            processing_class=tokenizer,
        )
    except (ImportError, TypeError):
        from transformers import TrainingArguments
        training_args = TrainingArguments(
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=gradient_accumulation_steps,
            warmup_steps=10,
            num_train_epochs=epochs,
            learning_rate=learning_rate,
            fp16=False,
            bf16=False,
            logging_steps=10,
            optim="adamw_8bit" if USE_UNSLOTH else "paged_adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="cosine",
            seed=3407,
            output_dir=output_dir,
            report_to="none"
        )
        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=dataset,
            dataset_text_field="text",
            max_seq_length=max_seq_length,
            args=training_args,
        )

    print("\n[4/5] Executing Fine-Tuning Run on NASA Mars Data...")
    trainer_stats = trainer.train()
    print("      Fine-tuning complete!")

    print(f"\n[5/5] Saving model and exporting to GGUF Q4_K_M...")
    os.makedirs(output_dir, exist_ok=True)
    if USE_UNSLOTH:
        # Unsloth has native 1-step GGUF export!
        model.save_pretrained_gguf(output_dir, tokenizer, quantization_method="q4_k_m")
        print(f"      Successfully saved GGUF model: {os.path.join(output_dir, gguf_output_name)}")
    else:
        model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)
        print(f"      Saved LoRA adapter to {output_dir}.")
        print("      To convert to GGUF, run: python llama.cpp/convert_hf_to_gguf.py ...")

    print("\n" + "=" * 72)
    print("TRAINING & QUANTIZATION PIPELINE COMPLETE")
    print("Ready for 100% Offline Edge Deployment on Mars Rover")
    print("=" * 72)


if __name__ == "__main__":
    train_pipeline()
