@echo off
set CUDA_VISIBLE_DEVICES=1
start "" E:\llama_game\llama.cpp-tq\build\bin\Release\llama-server.exe ^
  --model E:\llama_game\models\qwen35-9b\Qwen_Qwen3.5-9B-Q4_K_M.gguf ^
  --host 127.0.0.1 --port 8081 ^
  --ctx-size 40960 --parallel 20 ^
  --n-gpu-layers 999 ^
  --flash-attn on ^
  --cache-type-k turbo3 --cache-type-v turbo3 ^
  --reasoning off
