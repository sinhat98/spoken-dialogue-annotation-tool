#!/bin/bash

# Function to show usage
usage() {
    echo "Usage: $0 [directory_path]"
    echo "  directory_path: Optional. Path to specific directory under 'data/'"
    echo "  If no directory is specified, all audio.wav files under data/ will be processed"
    exit 1
}

# Check if data directory exists
if [ ! -d "data" ]; then
    echo "Error: data directory not found"
    exit 1
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed"
    exit 1
fi

# Set target directory
if [ $# -eq 0 ]; then
    TARGET_DIR="data"
else
    TARGET_DIR="data/$1"
    if [ ! -d "$TARGET_DIR" ]; then
        echo "Error: Directory $TARGET_DIR not found"
        usage
    fi
fi

echo "Processing directory: $TARGET_DIR"

# Find all audio.wav files and convert them to mono
# -i: input file
# -map_channel 0.0.0: select first channel from first stream of first input
# -y: overwrite output file without asking
find "$TARGET_DIR" -name "audio.wav" | while read -r file; do
    dir=$(dirname "$file")
    echo "Converting: $file"
    ffmpeg -i "$file" -af "pan=mono|c0=c0" -y "${dir}/audio_processed.wav" 2>/dev/null
done

echo "Conversion completed" 