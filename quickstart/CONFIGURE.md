# Configuration Guide for bb, nargo, and scarb

## Current Status

You have installed:
- `bb` at `/home/ahm/.bb/bb` (version 0.86.0-starknet.1)
- `nargo` via `noirup` at `/home/ahm/.nargo/bin/` (version 1.0.0-beta.3)

## Step 1: Add Tools to PATH

You need to ensure these directories are in your PATH. Add the following to your shell configuration file:

### For Bash (~/.bashrc or ~/.bash_profile):
```bash
export PATH="$HOME/.bb:$PATH"
export PATH="$HOME/.nargo/bin:$PATH"
```

### For Zsh (~/.zshrc):
```bash
export PATH="$HOME/.bb:$PATH"
export PATH="$HOME/.nargo/bin:$PATH"
```

**To apply immediately:**
```bash
source ~/.bashrc  # or source ~/.zshrc
```

## Step 2: Verify Installation

Run the verification script:
```bash
chmod +x verify-setup.sh
./verify-setup.sh
```

Or manually check:
```bash
# Check bb
bb --version

# Check nargo
nargo --version

# Check if they're in PATH
which bb
which nargo
```

## Step 3: Install and Configure Scarb

Scarb is required for the verifier generation. Install it:

### Option A: Using asdf (Recommended)
```bash
# Install asdf if not already installed
# Then:
asdf plugin add scarb
asdf install scarb 2.12.1
asdf local scarb 2.12.1  # in the verifier directory
```

### Option B: Manual Installation
Follow: https://docs.swmansion.com/scarb/download.html

## Step 4: Verify All Versions

After configuration, verify:
```bash
bb --version        # Should show 0.86.0-starknet.1
nargo --version     # Should show 1.0.0-beta.3
scarb --version     # Should show 2.12.1
```

## Step 5: Retry garaga gen

Once everything is configured:
```bash
cd /mnt/c/Users/DELL/ztarknet/quickstart
garaga gen --system ultra_starknet_zk_honk --vk ./circuit/target/vk --project-name verifier
```

## Troubleshooting

If `scarb` still shows exit code 126:
- Make sure scarb is installed and executable
- Check that scarb is in PATH: `which scarb`
- Try running `scarb --version` directly
- If using asdf, ensure it's properly initialized in your shell






