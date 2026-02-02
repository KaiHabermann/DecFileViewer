import os
import json
import re
import shutil
from decaylanguage import DecFileParser, DecayChainViewer

DKFILES_DIR = 'DecFiles/dkfiles'
OUTPUT_FILE = 'frontend/public/data.json'
DECFILES_PUBLIC_DIR = 'frontend/public/dkfiles'
IMAGES_PUBLIC_DIR = 'frontend/public/images'

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
        if token.lower() in ['cc', 'os', 'ss', 'pp', 'photos', 'pythia']:
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

# Improved version with better tokenization for missing spaces
def extract_particles_advanced(descriptor):
    if not descriptor:
        return []

    # Pre-processing to ensure separation around syntax characters
    s = descriptor.replace('=>', ' => ').replace('->', ' -> ')
    
    for char in ['[', ']', '(', ')', '{', '}', ',', ';']:
        s = s.replace(char, f' {char} ')
        
    # Now split by whitespace
    raw_tokens = s.split()
    
    particles = set()
    for token in raw_tokens:
        # Remove any remaining syntax chars
        if token in ['=>', '->', '[', ']', '(', ')', '{', '}', ',', ';', '...']:
            continue
            
        # Rule: Filter out keywords
        if token.lower() in ['cc', 'os', 'ss', 'pp', 'photos', 'pythia', 'evtgen', 'jetset']:
            continue
            
        # Rule: Particle name never starts with special char except ~ or ^
        if not (token[0].isalnum() or token[0] in ['~', '^']):
            continue

        if token.isdigit():
            continue
            
        # Try to split joined particles
        split_tokens = split_joined_particles(token)
        
        for p in split_tokens:
            if not p: continue
             # Re-verify the split parts are valid
            if not (p[0].isalnum() or p[0] in ['~', '^']):
                continue
            particles.add(p.lower())

    return list(particles)

def parse_file(filepath):
    event_type = None
    descriptor = None
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line.startswith('# EventType:'):
                    event_type = line.split(':', 1)[1].strip()
                elif line.startswith('# Descriptor:'):
                    descriptor = line.split(':', 1)[1].strip()
                
                if event_type and descriptor:
                    break
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return None, None
                
    return event_type, descriptor

def generate_decay_images(filepath, filename_no_ext):
    image_paths = []
    try:
        dfp = DecFileParser(filepath)
        dfp.parse()
        
        # Get all defined mothers
        mothers = dfp.list_decay_mother_names()
        
        # Find root mothers (those that are not daughters of any other particle in the file)
        # 1. Collect all daughters from all decays in the file
        all_daughters = set()
        if hasattr(dfp, '_parsed_decays'):
            for mother_name, decays in dfp._parsed_decays.items():
                 for decay in decays:
                     if 'fs' in decay:
                         for d in decay['fs']:
                             all_daughters.add(d)
        
        # 2. Identify roots: mothers that are NOT in the set of all daughters
        # Note: We need to handle aliasing? Usually DecFileParser handles aliases internally.
        # But mothers list contains the aliased names used in the file.
        
        roots = [m for m in mothers if m not in all_daughters]
        
        # If no roots found (circular dependency? unlikely in valid decays), fall back to all mothers
        if not roots and mothers:
            roots = mothers

        for mother in roots:
            try:
                # Build chain
                chain = dfp.build_decay_chains(mother)
                
                # Create viewer
                dcv = DecayChainViewer(chain)
                
                # Define output path
                # We need to use a safe filename for the image
                safe_mother = mother.replace('/', '_').replace('+', 'p').replace('-', 'm').replace('*', 'st')
                image_name = f"{filename_no_ext}_{safe_mother}"
                output_path_base = os.path.join(IMAGES_PUBLIC_DIR, image_name)
                
                # Check if image already exists to save time?
                # For now, overwrite to ensure correctness
                if os.path.exists(output_path_base + ".png"):
                     image_paths.append(f"/images/{image_name}.png")
                     continue

                # Render (this creates .png automatically if format='png')
                dcv.graph.render(output_path_base, format='png', cleanup=True)
                
                image_paths.append(f"/images/{image_name}.png")
                
            except Exception as e:
                # print(f"Failed to generate image for {mother} in {filename_no_ext}: {e}")
                pass
                
    except Exception as e:
        # print(f"DecayParser failed for {filepath}: {e}")
        pass
        
    return image_paths

def main():
    data = []
    all_particles = set()
    
    # Ensure output directories exist
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    os.makedirs(DECFILES_PUBLIC_DIR, exist_ok=True)
    os.makedirs(IMAGES_PUBLIC_DIR, exist_ok=True)
    
    if not os.path.exists(DKFILES_DIR):
        print(f"Directory {DKFILES_DIR} not found.")
        return

    print(f"Parsing files in {DKFILES_DIR}...")
    count = 0
    files = os.listdir(DKFILES_DIR)
    total_files = len(files)
    
    # Load existing data to preserve progress/avoid re-parsing everything if not needed
    # But since we changed logic (roots only), we might want to re-run.
    # To speed up dev, we can check if image exists.
    
    for filename in files:
        if not filename.endswith('.dec'):
            continue
            
        filepath = os.path.join(DKFILES_DIR, filename)
        event_type, descriptor = parse_file(filepath)
        
        # Copy the file to public/dkfiles
        try:
            shutil.copy2(filepath, os.path.join(DECFILES_PUBLIC_DIR, filename))
        except Exception as e:
            pass

        if event_type:
            # Use advanced extraction
            particles = extract_particles_advanced(descriptor)
            all_particles.update(particles)
            
            # Generate images (updated logic)
            filename_no_ext = os.path.splitext(filename)[0]
            images = generate_decay_images(filepath, filename_no_ext)
            
            data.append({
                'eventType': event_type,
                'descriptor': descriptor if descriptor else "No descriptor found",
                'filename': filename,
                'particles': particles,
                'images': images
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
        'files': data,
        'uniqueParticles': sorted(list(all_particles))
    }

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Done. Processed {len(data)} files. Found {len(all_particles)} unique particles. Saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
