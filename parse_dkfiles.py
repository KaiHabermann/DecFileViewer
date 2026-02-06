import os
import json
import re
import shutil
import subprocess
import argparse
from datetime import datetime
from decaylanguage import DecFileParser, DecayChainViewer

DKFILES_DIR = 'DecFiles/dkfiles'
OUTPUT_FILE = 'frontend/public/data.json'
DECFILES_PUBLIC_DIR = 'frontend/public/dkfiles'
DOT_FILES_DIR = 'frontend/public/dotfiles'


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

def remove_sig_suffix(particle_name):
    """
    Remove 'sig' suffix from particle names.
    Example: 'B0sig' -> 'B0', 'B-sig' -> 'B-'
    """
    if not particle_name:
        return particle_name
    
    # Remove 'sig' suffix (case-insensitive)
    particle_name = particle_name.strip()
    if particle_name.lower().endswith('sig'):
        return particle_name[:-3]
    return particle_name

def clean_descriptor(descriptor):
    """
    Remove 'sig' suffixes from particle names in a decay descriptor string.
    Example: 'B0sig -> K+ K-' -> 'B0 -> K+ K-'
    """
    if not descriptor:
        return descriptor
    
    # Pattern to match particle names ending with 'sig' (case-insensitive)
    # Match word boundaries to avoid partial matches
    pattern = r'\b(\w+)sig\b'
    
    def replace_sig(match):
        particle = match.group(1)
        return particle
    
    # Replace all occurrences
    cleaned = re.sub(pattern, replace_sig, descriptor, flags=re.IGNORECASE)
    return cleaned

def build_decay_structure(mother, dfp, aliases, visited=None):
    """
    Build a decay structure as a nested list.
    Format: [mother, daughter1, daughter2, [subdecay_mother, ...], ...]
    Uses aliases to normalize particle names and removes 'sig' suffixes.
    """
    if visited is None:
        visited = set()
    
    # Apply alias to mother name and remove sig suffix
    mother_alias = aliases.get(mother, mother)
    mother_alias = remove_sig_suffix(mother_alias)
    
    # Avoid infinite recursion (check both original and aliased name)
    if mother in visited or mother_alias in visited:
        return None
    visited.add(mother)
    visited.add(mother_alias)
    
    try:
        modes = dfp.list_decay_modes(mother)
        if not modes:
            return None
        
        # For now, take the first mode (could be extended to handle multiple modes)
        mode = modes[0]
        
        structure = [mother_alias]
        
        for daughter in mode:
            # Check if this daughter is itself a mother (sub-decay)
            # Use original name to check against list_decay_mother_names()
            if daughter in dfp.list_decay_mother_names():
                # Build sub-structure with original name
                sub_structure = build_decay_structure(daughter, dfp, aliases, visited.copy())
                if sub_structure:
                    structure.append(sub_structure)
                else:
                    # If sub-structure build failed, use aliased name and remove sig
                    daughter_alias = aliases.get(daughter, daughter)
                    daughter_alias = remove_sig_suffix(daughter_alias)
                    structure.append(daughter_alias)
            else:
                # Apply alias to daughter name for final state particles and remove sig
                daughter_alias = aliases.get(daughter, daughter)
                daughter_alias = remove_sig_suffix(daughter_alias)
                structure.append(daughter_alias)
        
        return structure
    except Exception:
        return None

def get_all_decay_structures(dfp, aliases, mode_index=None):
    """
    Get all decay structures from all mothers.
    Uses aliases to normalize particle names.
    If mode_index is specified, only use that decay mode (for handling splits).
    Returns a list of decay structures.
    """
    decay_structures = []
    mothers = dfp.list_decay_mother_names()
    
    for mother in mothers:
        try:
            modes = dfp.list_decay_modes(mother)
            if not modes:
                continue
            
            # If mode_index is specified, only use that mode; otherwise use first mode
            if mode_index is not None and mode_index < len(modes):
                mode = modes[mode_index]
            else:
                mode = modes[0]
            
            # Build structure for this specific mode
            structure = build_decay_structure_for_mode(mother, mode, dfp, aliases)
            if structure:
                decay_structures.append(structure)
        except:
            continue
    
    return decay_structures

def build_decay_structure_for_mode(mother, mode, dfp, aliases, visited=None):
    """
    Build a decay structure for a specific decay mode.
    Format: [mother, daughter1, daughter2, [subdecay_mother, ...], ...]
    Uses aliases to normalize particle names and removes 'sig' suffixes.
    """
    if visited is None:
        visited = set()
    
    # Apply alias to mother name and remove sig suffix
    mother_alias = aliases.get(mother, mother)
    mother_alias = remove_sig_suffix(mother_alias)
    
    # Avoid infinite recursion (check both original and aliased name)
    if mother in visited or mother_alias in visited:
        return None
    visited.add(mother)
    visited.add(mother_alias)
    
    try:
        structure = [mother_alias]
        
        for daughter in mode:
            # Check if this daughter is itself a mother (sub-decay)
            # Use original name to check against list_decay_mother_names()
            if daughter in dfp.list_decay_mother_names():
                # Get all modes for this daughter and use the first one
                daughter_modes = dfp.list_decay_modes(daughter)
                if daughter_modes:
                    # Build sub-structure with first mode of daughter
                    sub_structure = build_decay_structure_for_mode(daughter, daughter_modes[0], dfp, aliases, visited.copy())
                    if sub_structure:
                        structure.append(sub_structure)
                    else:
                        # If sub-structure build failed, use aliased name and remove sig
                        daughter_alias = aliases.get(daughter, daughter)
                        daughter_alias = remove_sig_suffix(daughter_alias)
                        structure.append(daughter_alias)
                else:
                    daughter_alias = aliases.get(daughter, daughter)
                    daughter_alias = remove_sig_suffix(daughter_alias)
                    structure.append(daughter_alias)
            else:
                # Apply alias to daughter name for final state particles and remove sig
                daughter_alias = aliases.get(daughter, daughter)
                daughter_alias = remove_sig_suffix(daughter_alias)
                structure.append(daughter_alias)
        
        return structure
    except Exception:
        return None

def generate_decay_dot_files(filepath, filename_no_ext):
    dot_files = []
    roots = []
    decay_structures = []
    try:
        dfp = DecFileParser(filepath)
        dfp.parse()
        
        # Get all defined mothers
        mothers = dfp.list_decay_mother_names()
        
        if not mothers:
             return dot_files, None, [], []

        
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
        # Remove 'sig' suffixes from particle names (like we do in decay structures)
        particles = [remove_sig_suffix(p) for p in particles]
        particles = list(set(particles))
        # Filter out ChargeConj particles, but keep particles that had 'sig' (now removed)
        particles = list(filter(lambda x: "ChargeConj" not in x, particles))
        
        # Get all decay structures (using aliases)
        # We'll build structures for each mode if there are multiple modes
        decay_structures = get_all_decay_structures(dfp, aliases)
        
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
        decay_structures = []
        dfp = None
        aliases = {}
        roots = []

    descriptors = []
    all_mode_structures = []
    
    if len(roots) == 1 and dfp is not None:
        root = roots[0]
        try:
            descriptor_ = dfp.expand_decay_modes(root)
            root_modes = dfp.list_decay_modes(root)
            
            # Normalize descriptor_ to always be a list
            if isinstance(descriptor_, list):
                descriptor_list = descriptor_
            elif descriptor_:
                descriptor_list = [descriptor_]
            else:
                descriptor_list = []
            
            # Build decay structures for each mode (even if there's only one)
            for mode_idx, desc in enumerate(descriptor_list):
                if desc and mode_idx < len(root_modes):
                    cleaned_desc = clean_descriptor(desc)
                    descriptors.append(cleaned_desc)
                    # Build structures starting from root with this specific mode
                    root_mode = root_modes[mode_idx]
                    root_structure = build_decay_structure_for_mode(root, root_mode, dfp, aliases)
                    # Also get all other structures (non-root mothers)
                    other_structures = []
                    for mother in dfp.list_decay_mother_names():
                        if mother != root:
                            try:
                                modes = dfp.list_decay_modes(mother)
                                if modes:
                                    struct = build_decay_structure_for_mode(mother, modes[0], dfp, aliases)
                                    if struct:
                                        other_structures.append(struct)
                            except:
                                pass
                    # Combine root structure with other structures
                    mode_structures = []
                    if root_structure:
                        mode_structures.append(root_structure)
                    mode_structures.extend(other_structures)
                    all_mode_structures.append(mode_structures)
            
            # Always wrap decay_structures as a list of lists (even for single mode)
            if all_mode_structures:
                decay_structures = all_mode_structures
            elif decay_structures:
                # If we have decay_structures but no descriptors (fallback case)
                # Wrap the existing structures in a list to maintain consistent structure
                decay_structures = [decay_structures]
        except:
            # If exception, wrap existing decay_structures in a list if they exist
            if decay_structures and (not decay_structures or not isinstance(decay_structures[0] if decay_structures else None, list)):
                decay_structures = [decay_structures] if decay_structures else []
    
    # Ensure decay_structures is always a list of lists (even if empty or single mode)
    # Check if it's already a list of lists by checking if first element is a list
    if decay_structures:
        if not isinstance(decay_structures[0], list):
            # It's a flat list, wrap it: [decay1, decay2] -> [[decay1, decay2]]
            decay_structures = [decay_structures]
    else:
        # Empty list, keep it as []
        decay_structures = []
    
    # If we have descriptors, return them; otherwise return None
    if descriptors:
        return dot_files, descriptors, particles, decay_structures
    else:
        return dot_files, None, particles, decay_structures

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
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Parse DecFiles and generate data.json')
    parser.add_argument('-n', '--num-files', type=int, default=None,
                        help='Limit the number of files to parse (useful for testing)')
    args = parser.parse_args()
    
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
    if args.num_files:
        print(f"Limiting to {args.num_files} files")
    
    count = 0
    files = os.listdir(DKFILES_DIR)
    total_files = len(files)
    
    for filename in files:
        if not filename.endswith('.dec'):
            continue
        
        # Check if we've reached the limit
        if args.num_files and count >= args.num_files:
            print(f"Reached limit of {args.num_files} files. Stopping.")
            break
            
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
            dot_files, new_descriptors, particles, decay_structures = generate_decay_dot_files(filepath, filename_no_ext)

            # Handle multiple descriptors
            if new_descriptors:
                if isinstance(new_descriptors, list):
                    descriptors = new_descriptors
                else:
                    descriptors = [new_descriptors]
            else:
                descriptors = [descriptor] if descriptor else ["No descriptor found"]
                
            if new_descriptors:
                all_particles.update(particles)

            data.append({
                'eventType': event_type,
                'descriptor': descriptors[0] if len(descriptors) == 1 else descriptors,  # Single string or list of strings
                'descriptors': descriptors,  # Always a list for consistency
                'filename': filename,
                'particles': particles,
                'dotFiles': dot_files,
                'decay_structures': decay_structures,  # This is already a list of decay structures
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
