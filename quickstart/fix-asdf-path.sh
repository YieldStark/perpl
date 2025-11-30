#!/bin/bash
# Script to fix asdf PATH issue for garaga

# Check if asdf shims is already in PATH
if [[ ":$PATH:" != *":$HOME/.asdf/shims:"* ]]; then
    echo "Adding asdf shims to PATH..."
    echo '' >> ~/.bashrc
    echo '# Add asdf shims to PATH for garaga' >> ~/.bashrc
    echo 'export PATH="$HOME/.asdf/shims:$PATH"' >> ~/.bashrc
    echo "✓ Added to ~/.bashrc"
else
    echo "asdf shims already in PATH"
fi

# Also ensure asdf is initialized
if ! grep -q 'asdf.sh' ~/.bashrc; then
    echo "Initializing asdf in ~/.bashrc..."
    echo '' >> ~/.bashrc
    echo '# Initialize asdf' >> ~/.bashrc
    echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
    echo '. "$HOME/.asdf/completions/asdf.bash"' >> ~/.bashrc
    echo "✓ Added asdf initialization"
fi

echo ""
echo "Now run: source ~/.bashrc"
echo "Then verify: which scarb"
echo "Then retry: garaga gen ..."






















