# Fixing Scarb PATH Issue for Garaga

The issue is that `garaga` runs `scarb fmt` in a subprocess, and `scarb` isn't found in that subprocess's PATH.

## Solution 1: Find and Add Scarb to Standard PATH

First, find where `scarb` is installed:

```bash
which scarb
```

Common locations:
- `~/.local/bin/scarb` (if installed via installer script)
- `~/.asdf/installs/scarb/2.12.1/bin/scarb` (if using asdf)
- `/usr/local/bin/scarb` (if installed system-wide)

## Solution 2: Create a Symlink (Quick Fix)

If `scarb` is in a non-standard location, create a symlink to a standard PATH location:

```bash
# Find scarb location
SCARB_PATH=$(which scarb)

# Create symlink in a standard location (if not already there)
sudo ln -s "$SCARB_PATH" /usr/local/bin/scarb

# Verify
which scarb
scarb --version
```

## Solution 3: Ensure asdf is in PATH (if using asdf)

If you're using `asdf`, make sure it's initialized in your shell config:

```bash
# Add to ~/.bashrc or ~/.zshrc
. "$HOME/.asdf/asdf.sh"
. "$HOME/.asdf/completions/asdf.bash"

# Then reload
source ~/.bashrc
```

## Solution 4: Use Full Path (Temporary Workaround)

You can modify the garaga source, but a better approach is to ensure scarb is in a standard PATH location.

## Solution 5: Install Scarb to Standard Location

Reinstall scarb to a standard location:

```bash
# If using the installer script, it should install to ~/.local/bin
# Make sure ~/.local/bin is in PATH:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
which scarb
```

## Verify the Fix

After applying any solution, test:

```bash
# Test scarb directly
scarb --version

# Test scarb fmt (what garaga calls)
cd /mnt/c/Users/DELL/ztarknet/quickstart/verifier
scarb fmt --check .

# If that works, retry garaga
cd /mnt/c/Users/DELL/ztarknet/quickstart
garaga gen --system ultra_starknet_zk_honk --vk ./circuit/target/vk --project-name verifier
```






















