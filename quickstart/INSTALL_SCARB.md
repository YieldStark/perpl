# Installing Scarb 2.12.1

The `garaga gen` command requires `scarb` to be installed and available in your PATH. Here's how to install it:

## Option 1: Using asdf (Recommended)

If you're using `asdf` for version management:

```bash
# 1. Install asdf plugin for scarb (if not already installed)
asdf plugin add scarb

# 2. Install scarb 2.12.1
asdf install scarb 2.12.1

# 3. Set it globally or locally
asdf global scarb 2.12.1
# OR set it locally in the verifier directory:
cd /mnt/c/Users/DELL/ztarknet/quickstart/verifier
asdf local scarb 2.12.1

# 4. Verify installation
scarb --version
```

**Important:** Make sure `asdf` is properly initialized in your shell. Add to `~/.bashrc` or `~/.zshrc`:
```bash
. "$HOME/.asdf/asdf.sh"
. "$HOME/.asdf/completions/asdf.bash"
```

## Option 2: Manual Installation (Linux/WSL)

```bash
# Download and install scarb manually
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Reload shell
source ~/.bashrc  # or source ~/.zshrc

# Verify
scarb --version
```

## Option 3: Using Cargo (if you have Rust installed)

```bash
cargo install --locked --git https://github.com/software-mansion/scarb --tag v2.12.1 scarb
```

## Verify Installation

After installation, verify:

```bash
which scarb
scarb --version
```

You should see:
```
scarb 2.12.1
```

## After Installation

Once `scarb` is installed, retry the garaga command:

```bash
cd /mnt/c/Users/DELL/ztarknet/quickstart
garaga gen --system ultra_starknet_zk_honk --vk ./circuit/target/vk --project-name verifier
```

## Troubleshooting

### If `scarb` command not found after installation:

1. **Check PATH:**
   ```bash
   echo $PATH
   which scarb
   ```

2. **If using asdf, make sure it's initialized:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   . "$HOME/.asdf/asdf.sh"
   source ~/.bashrc
   ```

3. **If manually installed, add to PATH:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export PATH="$HOME/.local/bin:$PATH"
   source ~/.bashrc
   ```

### If you get permission errors:

```bash
# Make sure scarb is executable
chmod +x $(which scarb)
```






