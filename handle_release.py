#!/usr/bin/env python3
"""
Script to handle a specific release of the DecFiles repository.
Clones/checks out the repo at the specified release, parses it, and updates the releases list.
"""

import os
import sys
import json
import subprocess
import argparse
import shutil
import tempfile
from pathlib import Path

REPO_URL = 'https://gitlab.cern.ch/lhcb-datapkg/Gen/DecFiles.git'
PUBLIC_DIR = 'frontend/public'
RELEASES_JSON = os.path.join(PUBLIC_DIR, 'releases.json')


def clone_and_checkout_release(release_name, temp_dir):
    """
    Clone the repository and checkout the specified release.
    Returns the path to the cloned repository.
    """
    repo_path = os.path.join(temp_dir, 'DecFiles')
    
    # Clone the repository if it doesn't exist
    if not os.path.exists(repo_path):
        print(f"Cloning repository to {repo_path}...")
        result = subprocess.run(
            ['git', 'clone', REPO_URL, repo_path],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"Error cloning repository: {result.stderr}")
            sys.exit(1)
    else:
        print(f"Repository already exists at {repo_path}")
    
    # Fetch all tags and branches
    print(f"Fetching tags and branches...")
    subprocess.run(
        ['git', 'fetch', '--all', '--tags'],
        cwd=repo_path,
        capture_output=True
    )
    
    # Checkout the specified release
    print(f"Checking out release {release_name}...")
    result = subprocess.run(
        ['git', 'checkout', release_name],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Error checking out release {release_name}: {result.stderr}")
        sys.exit(1)
    
    print(f"Successfully checked out release {release_name}")
    return repo_path


def update_releases_json(release_name):
    """
    Update the releases.json file to include the new release.
    Creates the file if it doesn't exist.
    """
    releases = []
    
    # Read existing releases if file exists
    if os.path.exists(RELEASES_JSON):
        try:
            with open(RELEASES_JSON, 'r') as f:
                releases = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: {RELEASES_JSON} exists but is not valid JSON. Creating new file.")
            releases = []
    
    # Add the new release if it's not already in the list
    if release_name not in releases:
        releases.append(release_name)
        releases.sort(reverse=True)  # Sort in descending order (newest first)
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(RELEASES_JSON), exist_ok=True)
        
        # Write the updated list
        with open(RELEASES_JSON, 'w') as f:
            json.dump(releases, f, indent=2)
        
        print(f"Updated {RELEASES_JSON} with release {release_name}")
    else:
        print(f"Release {release_name} already exists in {RELEASES_JSON}")


def main():
    parser = argparse.ArgumentParser(
        description='Handle a specific release of the DecFiles repository'
    )
    parser.add_argument(
        'release',
        type=str,
        help='Release name (e.g., v32r41)'
    )
    parser.add_argument(
        '--keep-repo',
        action='store_true',
        help='Keep the cloned repository after processing (default: delete it)'
    )
    parser.add_argument(
        '--repo-path',
        type=str,
        default=None,
        help='Path to existing DecFiles repository (if not provided, will clone to temp directory)'
    )
    parser.add_argument(
        "-n", "--num-files",
        type=int,
        default=None,
        help='Number of files to parse (default: all)'
    )
    args = parser.parse_args()
    
    release_name = args.release
    
    # Create release directory in public folder
    release_dir = os.path.join(PUBLIC_DIR, release_name)
    os.makedirs(release_dir, exist_ok=True)
    print(f"Created release directory: {release_dir}")
    
    # Determine repository path
    if args.repo_path:
        repo_path = args.repo_path
        if not os.path.exists(repo_path):
            print(f"Error: Repository path {repo_path} does not exist")
            sys.exit(1)
        # Checkout the release in the existing repo
        print(f"Checking out release {release_name} in existing repository...")
        result = subprocess.run(
            ['git', 'fetch', '--all', '--tags'],
            cwd=repo_path,
            capture_output=True
        )
        result = subprocess.run(
            ['git', 'checkout', release_name],
            cwd=repo_path,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"Error checking out release {release_name}: {result.stderr}")
            sys.exit(1)
        temp_dir = None
    else:
        # Clone to temporary directory
        temp_dir = tempfile.mkdtemp(prefix='decfiles_release_')
        try:
            repo_path = clone_and_checkout_release(release_name, temp_dir)
        except Exception as e:
            print(f"Error during repository checkout: {e}")
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            sys.exit(1)
    
    # Set up paths for parse_dkfiles.py
    dkfiles_dir = os.path.join(repo_path, 'dkfiles')
    output_json = os.path.join(release_dir, 'data.json')
    dkfiles_output = os.path.join(release_dir, 'dkfiles')
    dotfiles_dir = os.path.join(release_dir, 'dotfiles')
    
    # Verify dkfiles directory exists
    if not os.path.exists(dkfiles_dir):
        print(f"Error: dkfiles directory not found at {dkfiles_dir}")
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        sys.exit(1)
    
    # Call parse_dkfiles.py
    print(f"Running parse_dkfiles.py...")
    script_path = os.path.join(os.path.dirname(__file__), 'parse_dkfiles.py')
    
    cmd = [
        sys.executable,
        script_path,
        '--dkfiles-dir', dkfiles_dir,
        '--output', output_json,
        '--dkfiles-output', dkfiles_output,
        '--dotfiles-dir', dotfiles_dir
    ] + (['-n', str(args.num_files)] if args.num_files else [])
    
    result = subprocess.run(cmd, capture_output=False)
    if result.returncode != 0:
        print(f"Error running parse_dkfiles.py")
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        sys.exit(1)
    
    print(f"Successfully parsed release {release_name}")
    
    # Update releases.json
    update_releases_json(release_name)
    
    # Clean up temporary directory if not keeping the repo
    if temp_dir and os.path.exists(temp_dir) and not args.keep_repo:
        print(f"Cleaning up temporary directory...")
        shutil.rmtree(temp_dir)
    
    print(f"Release {release_name} processed successfully!")
    print(f"  - Data JSON: {output_json}")
    print(f"  - Dkfiles: {dkfiles_output}")
    print(f"  - Dotfiles: {dotfiles_dir}")


if __name__ == '__main__':
    main()

