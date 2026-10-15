#!/usr/bin/env bash
# Mavri quickstart for macOS and Linux.
#
# Makes sure Docker and git are installed (installing them if not), then
# clones Mavri into ./mavri (or updates an existing checkout) and starts it
# with install.sh.
#
#   macOS  Docker Desktop and git through Homebrew
#   Linux  Docker Engine through the official get.docker.com script, git
#          through the system package manager
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Raktim94/mavri/main/scripts/quickstart.sh | bash
#
# Optional environment variables:
#   HOST_PORT        port to publish Mavri on (default 3001)
#   MAVRI_REPO_URL   clone from somewhere else, for example a fork
#
# Safe to re-run: each step only acts if it is still needed, and an existing
# checkout is updated in place rather than overwritten. Your data lives in a
# Docker volume and is not touched.
set -euo pipefail

REPO_URL="${MAVRI_REPO_URL:-https://github.com/Raktim94/mavri.git}"
REPO_DIR="mavri"
SUDO=""

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

docker_ready() { docker info >/dev/null 2>&1; }

wait_for_docker() {
  for _ in $(seq 1 "${1:-60}"); do
    docker_ready && return 0
    sleep 2
  done
  return 1
}

install_docker_linux() {
  echo "==> Installing Docker Engine with the official convenience script..."
  curl -fsSL https://get.docker.com | as_root sh
  as_root usermod -aG docker "${SUDO_USER:-${USER:-$(id -un)}}" 2>/dev/null || true
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    as_root systemctl enable --now docker 2>/dev/null || true
  else
    # No systemd (for example WSL2 without it): start the daemon directly.
    as_root service docker start 2>/dev/null || true
  fi
}

install_docker_mac() {
  if ! command -v brew >/dev/null 2>&1; then
    echo "Docker Desktop is not installed, and neither is Homebrew." >&2
    echo "Install Homebrew first (https://brew.sh) and run this command again," >&2
    echo "or install Docker Desktop yourself: https://docs.docker.com/desktop/setup/install/mac-install/" >&2
    exit 1
  fi
  echo "==> Installing Docker Desktop with Homebrew..."
  brew install --cask docker
  echo "==> Starting Docker Desktop..."
  open -a Docker
  echo "==> Waiting for Docker to start. If macOS asks for permission or a licence"
  echo "    agreement, approve it. That is normal on the first launch."
  wait_for_docker 150 || true
}

echo "==> Checking for Docker..."
if command -v docker >/dev/null 2>&1 && docker_ready; then
  echo "Docker is installed and running."
else
  case "$(uname -s)" in
    Darwin) install_docker_mac ;;
    Linux)  install_docker_linux ;;
    *)
      echo "Unsupported system: $(uname -s). Install Docker yourself: https://docs.docker.com/get-docker/" >&2
      exit 1
      ;;
  esac
  wait_for_docker 30 || true
fi

if ! docker_ready; then
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    # A group change only applies to new login sessions, so fall back to sudo
    # for this run and the install still finishes in one go.
    SUDO="sudo"
    echo "Using sudo for Docker this time. Log out and back in once and you will not need it."
  else
    echo "Docker is installed but not reachable yet." >&2
    echo "Linux: log out and back in (a new docker group needs a fresh session), then run this command again." >&2
    echo "macOS: open Docker Desktop, wait until it says it is running, then run this command again." >&2
    exit 1
  fi
fi

install_git_linux() {
  echo "==> Installing git..."
  if   command -v apt-get >/dev/null 2>&1; then as_root apt-get update -y && as_root apt-get install -y git
  elif command -v dnf     >/dev/null 2>&1; then as_root dnf install -y git
  elif command -v yum     >/dev/null 2>&1; then as_root yum install -y git
  elif command -v pacman  >/dev/null 2>&1; then as_root pacman -Sy --noconfirm git
  elif command -v zypper  >/dev/null 2>&1; then as_root zypper install -y git
  elif command -v apk     >/dev/null 2>&1; then as_root apk add git
  else
    echo "No supported package manager found to install git." >&2
    echo "Install git yourself (https://git-scm.com/downloads) and run this command again." >&2
    exit 1
  fi
}

install_git_mac() {
  # Checked with command -v on purpose: running a bare "git" on a Mac without
  # the Command Line Tools opens a blocking installer dialog.
  if command -v brew >/dev/null 2>&1; then
    echo "==> Installing git with Homebrew..."
    brew install git
  else
    echo "git is not installed, and neither is Homebrew." >&2
    echo "Install Homebrew (https://brew.sh) and run this command again, or run: xcode-select --install" >&2
    exit 1
  fi
}

if ! command -v git >/dev/null 2>&1; then
  case "$(uname -s)" in
    Darwin) install_git_mac ;;
    Linux)  install_git_linux ;;
    *)
      echo "Unsupported system: $(uname -s). Install git yourself: https://git-scm.com/downloads" >&2
      exit 1
      ;;
  esac
fi

echo "==> Getting Mavri..."
if [ -d "$REPO_DIR/.git" ]; then
  echo "Found ./$REPO_DIR, updating it instead of cloning again."
  git -C "$REPO_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
echo "==> Building and starting Mavri..."
$SUDO env HOST_PORT="${HOST_PORT:-3001}" bash ./install.sh
