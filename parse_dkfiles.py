import os
import json
import re
import shutil
import subprocess
from datetime import datetime
from decaylanguage import DecFileParser, DecayChainViewer

DKFILES_DIR = 'DecFiles/dkfiles'
OUTPUT_FILE = 'frontend/public/data.json'
DECFILES_PUBLIC_DIR = 'frontend/public/dkfiles'
DOT_FILES_DIR = 'frontend/public/dotfiles'

# Regex to capture particles. 
def extract_particles(descriptor):
    if not descriptor:
        return []
    
    # 1. Clean up known syntax characters that act as separators
    cleaned = descriptor.replace('=>', ' ').replace('->', ' ').replace('[', ' ').replace(']', ' ')\
                        .replace('(', ' ').replace(')', ' ').replace('{', ' ').replace('}', ' ')\
                        .replace('...', ' ').replace(',', ' ').replace(';', ' ')
    
    # 2. Tokenize by splitting on whitespace
    tokens = cleaned.split()
    particles = set()
    
    for token in tokens:
        token = token.strip()
        if not token: continue
        
        # Rule: Filter out common syntax keywords
        if token in ['cc', 'os', 'ss', 'pp', 'photos', 'pythia']:
            continue

        # Rule: A particle name will never start with a special character except ~ or ^
        if not (token[0].isalnum() or token[0] in ['~', '^']):
            continue
            
        particles.add(token)
        
    return list(particles)

# Helper function to split joined particles like "K+pi-" or "mu+mu-"
def split_joined_particles(token):
    potential_particles = []
    suffixes = ['+', '-', '0', '*', '\'']
    
    current_particle = ""
    i = 0
    while i < len(token):
        char = token[i]
        current_particle += char
        
        # Check if this char could be the end of a particle
        is_suffix = char in suffixes
        
        # Look ahead
        if i + 1 < len(token):
            next_char = token[i+1]
            
            if is_suffix:
                if next_char in suffixes:
                    # Continue accumulating suffixes
                    pass
                elif next_char.isalnum() or next_char in ['~', '^']:
                     # Suffix followed by alphanumeric -> SPLIT
                     potential_particles.append(current_particle)
                     current_particle = ""
                else:
                    pass
            else:
                pass
        else:
             # End of string
             if current_particle:
                 potential_particles.append(current_particle)
                 
        i += 1
        
    return potential_particles    

def parse_file(filepath):
    event_type = None
    descriptor = None
    physics_wg = None
    responsible = None
    email = None
    date = None
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line.startswith('# EventType:'):
                    event_type = line.split(':', 1)[1].strip()
                elif line.startswith('# Descriptor:'):
                    descriptor = line.split(':', 1)[1].strip()
                elif line.startswith('# PhysicsWG:'):
                    physics_wg = line.split(':', 1)[1].strip()
                elif line.startswith('# Responsible:'):
                    responsible = line.split(':', 1)[1].strip()
                elif line.startswith('# Email:'):
                    email = line.split(':', 1)[1].strip()
                elif line.startswith('# Date:'):
                    date = line.split(':', 1)[1].strip()
                
                # Continue reading to get all fields (don't break early)
                # We could optimize by breaking after all fields are found
                if event_type and descriptor and physics_wg and responsible and email and date:
                    break
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return None, None, None, None, None, None
                
    return event_type, descriptor, physics_wg, responsible, email, date

def generate_decay_dot_files(filepath, filename_no_ext):
    dot_files = []
    roots = []
    try:
        dfp = DecFileParser(filepath)
        dfp.parse()
        
        # Get all defined mothers
        mothers = dfp.list_decay_mother_names()
        
        if not mothers:
             return dot_files, None, []

        
        non_root = set()
        for mother in mothers:
            for mode in dfp.list_decay_modes(mother):
                for daughter in mode:
                    non_root.add(daughter)
        # 2. Identify roots: mothers that are NOT in the set of all daughters
        roots = [m for m in mothers if m not in non_root and "sig" in m]
        
        # If no roots found (circular dependency?), fall back to all mothers
        if not roots and mothers:
            raise Exception("No roots found")
        all_particles = set(mothers)
        all_particles.update(non_root)
        aliases = dfp.dict_aliases()
        particles = [
            aliases.get(p, p) for p in all_particles
        ]
        particles = list(set(particles))
        particles = list(filter(lambda x: "ChargeConj" not in x and "sig" not in x, particles))
        # Generate DOT files for each root
        for mother in roots:
            safe_mother = mother.replace('/', '_').replace('+', 'p').replace('-', 'm').replace('*', 'st')
            dot_name = f"{filename_no_ext}_{safe_mother}.dot"
            output_path = os.path.join(DOT_FILES_DIR, dot_name)
            
            # Skip if already exists
            if os.path.exists(output_path):
                dot_files.append(f"dotfiles/{dot_name}")
                continue

            try:
                # Build chain
                chain = dfp.build_decay_chains(mother)
                
                # Create viewer
                dcv = DecayChainViewer(chain)
                
                # Get the DOT source and save it
                dot_source = dcv.graph.source
                
                with open(output_path, 'w') as f:
                    f.write(dot_source)
                
                dot_files.append(f"dotfiles/{dot_name}")
                
            except Exception as e:
                # If root fails, maybe it wasn't a valid root or chain build failed.
                # print(f"Failed to generate DOT for {mother} in {filename_no_ext}: {e}")
                pass
                
    except Exception as e:
        # print(f"DecayParser failed for {filepath}: {e}")
        particles = []

    if len(roots) == 1:
        descriptor_ = dfp.expand_decay_modes(roots[0])
        if isinstance(descriptor_, list) and len(descriptor_) == 1:
            return dot_files, descriptor_[0], particles
        else:
            return dot_files, None, particles
    else:
        return dot_files, None, []

def get_git_commit_hash(directory):
    """Get the latest git commit hash from a directory."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        print(f"Could not get git hash: {e}")
    return None

def get_git_commit_short_hash(directory):
    """Get the short git commit hash from a directory."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        print(f"Could not get git short hash: {e}")
    return None

def main():
    data = []
    all_particles = set()
    
    # Get metadata
    processing_timestamp = datetime.utcnow().isoformat() + 'Z'
    git_hash = get_git_commit_hash(DKFILES_DIR)
    git_short_hash = get_git_commit_short_hash(DKFILES_DIR)
    
    # Ensure output directories exist
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    os.makedirs(DECFILES_PUBLIC_DIR, exist_ok=True)
    os.makedirs(DOT_FILES_DIR, exist_ok=True)
    
    if not os.path.exists(DKFILES_DIR):
        print(f"Directory {DKFILES_DIR} not found.")
        return

    print(f"Parsing files in {DKFILES_DIR}...")
    count = 0
    files = os.listdir(DKFILES_DIR)
    total_files = len(files)
    
    for filename in files:
        if not filename.endswith('.dec'):
            continue
            
        filepath = os.path.join(DKFILES_DIR, filename)
        event_type, descriptor, physics_wg, responsible, email, date = parse_file(filepath)
        
        # Copy the file to public/dkfiles
        try:
            shutil.copy2(filepath, os.path.join(DECFILES_PUBLIC_DIR, filename))
        except Exception as e:
            pass

        if event_type:
            # Generate DOT files for decay chains
            filename_no_ext = os.path.splitext(filename)[0]
            dot_files, new_descriptor, particles = generate_decay_dot_files(filepath, filename_no_ext)

            if new_descriptor:
                descriptor = new_descriptor
                
            if new_descriptor:
                all_particles.update(particles)

            data.append({
                'eventType': event_type,
                'descriptor': descriptor if descriptor else "No descriptor found",
                'filename': filename,
                'particles': particles,
                'dotFiles': dot_files,
                'physicsWG': physics_wg,
                'responsible': responsible,
                'email': email,
                'date': date
            })
            count += 1
            if count % 100 == 0:
                print(f"Processed {count}/{total_files} files...")

            # Incremental save every 500 files
            if count % 500 == 0:
                 temp_output = {
                    'files': data,
                    'uniqueParticles': sorted(list(all_particles))
                 }
                 with open(OUTPUT_FILE, 'w') as f:
                    json.dump(temp_output, f, indent=2)

    # Sort by EventType for nicer display/debugging
    data.sort(key=lambda x: x['eventType'])

    output_data = {
        'metadata': {
            'processedAt': processing_timestamp,
            'gitCommitHash': git_hash,
            'gitCommitShortHash': git_short_hash,
            'totalFiles': len(data),
            'totalParticles': len(all_particles)
        },
        'files': data,
        'uniqueParticles': sorted(list(all_particles))
    }

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Done. Processed {len(data)} files. Found {len(all_particles)} unique particles. Saved to {OUTPUT_FILE}")
    print(f"Git commit: {git_short_hash or 'N/A'}")
    print(f"Processed at: {processing_timestamp}")

if __name__ == '__main__':
    main()
