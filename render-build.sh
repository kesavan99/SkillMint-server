#!/usr/bin/env bash
set -euo pipefail

# Script to install Chromium on Render build instances.
# Run this from the Render `buildCommand` before `npm install`.

echo "=== Starting Chromium installation ==="

# Update package lists
echo "Updating package lists..."
apt-get update

# Try to install chromium (different package names on different systems)
echo "Installing Chromium..."
apt-get install -y chromium || apt-get install -y chromium-browser || {
    echo "Failed to install chromium, trying alternative method..."
    # Alternative: Download Chrome directly
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list
    apt-get update
    apt-get install -y google-chrome-stable
}

# Find where chromium/chrome was installed
echo "=== Searching for installed browsers ==="
for path in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable; do
    if [ -f "$path" ]; then
        echo "Found browser at: $path"
        "$path" --version || echo "Version check failed for $path"
    fi
done

echo "=== Installing npm dependencies ==="
npm install

echo "=== Build completed ==="
echo "Available browsers:"
ls -la /usr/bin/ | grep -E "chrom|google-chrome" || echo "No chromium/chrome found in /usr/bin/"
