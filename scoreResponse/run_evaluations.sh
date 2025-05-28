#!/bin/bash

# Define arrays of models and response files
MODELS=(
  "gemma3:1b-it-q4_K_M"
  "phi4-mini:3.8b-q4_K_M"
  "gemma2:2b-instruct-q4_0"
  "llama3.2:3b"
)

RESPONSES=(
  "resp-high.txt"
  "resp-mid.txt"
  "resp-low.txt"
)

# Function to display progress
function show_progress() {
  echo "========================================"
  echo "Running model: $1"
  echo "Response file: $2"
  echo "Progress: $3 of $4"
  echo "========================================"
}

# Calculate total runs
TOTAL_RUNS=$((${#MODELS[@]} * ${#RESPONSES[@]}))
CURRENT_RUN=0

# Loop through each model and response file
for model in "${MODELS[@]}"; do
  for response in "${RESPONSES[@]}"; do
    # Increment counter
    CURRENT_RUN=$((CURRENT_RUN + 1))
    
    # Show progress
    show_progress "$model" "$response" "$CURRENT_RUN" "$TOTAL_RUNS"
    
    # Run the evaluation command
    echo "Starting evaluation..."
    node scoreResponse.mjs "$model" "$response"
    
    # Optional: add a short pause between runs
    sleep 1
    
    echo "Completed $CURRENT_RUN of $TOTAL_RUNS runs"
    echo ""
  done
done

echo "All evaluations complete!"
