# Development environment for NixOS.
# Run `nix-shell` in this folder to get Node.js without installing it globally.
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = [
    pkgs.nodejs_22
    pkgs.git
    pkgs.gh       # GitHub CLI: login and repo creation from the terminal
  ];

  shellHook = ''
    echo "FightFit dev shell - node $(node -v)"
    echo "First time: npm install   |   Run: npm run dev"
  '';
}
