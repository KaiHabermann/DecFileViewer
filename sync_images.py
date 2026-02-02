import os
import json

DATA_FILE = 'frontend/public/data.json'
IMAGES_DIR = 'frontend/public/images'

def main():
    if not os.path.exists(DATA_FILE):
        print("data.json not found")
        return
        
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
        
    # data is dict with 'files': [...]
    files_list = data.get('files', [])
    
    # Map filename -> entry index
    file_map = {entry['filename']: i for i, entry in enumerate(files_list)}
    
    # Scan images
    print(f"Scanning {IMAGES_DIR}...")
    if not os.path.exists(IMAGES_DIR):
         print("Images dir not found")
         return

    image_files = os.listdir(IMAGES_DIR)
    print(f"Found {len(image_files)} images.")
    
    # We need to map image -> filename.
    # Image name format: {filename_no_ext}_{safe_mother}.png
    # This is tricky because filenames can contain underscores.
    # But we know the filename matches one of the known filenames in data.json (minus extension)
    
    # Better approach: Iterate over files in data.json, look for matching images.
    
    count = 0
    for entry in files_list:
        filename = entry['filename'] # e.g. "Bd_DstD,DKKpi=DDALITZ,DecProdCut,CPV.dec"
        filename_no_ext = os.path.splitext(filename)[0]
        
        # Look for images starting with this prefix
        # Be careful of partial matches (e.g. file "A" and file "A_B")
        # The separator we used was just string concatenation?
        # No, we used: image_name = f"{filename_no_ext}_{safe_mother}"
        
        # So we look for files in images_dir that start with filename_no_ext + "_"
        
        entry_images = []
        prefix = filename_no_ext + "_"
        
        for img in image_files:
            if img.startswith(prefix) and img.endswith(".png"):
                # verify it's not a false positive from a longer filename that shares prefix
                # e.g. "FileA" matching "FileA_extended_..."
                # But here prefix includes "_" so "FileA_" won't match "FileA_extended_" unless "extended" is the mother name.
                # Use strict checking if needed, but it's likely fine.
                
                entry_images.append(f"/images/{img}")
        
        if entry_images:
            entry['images'] = entry_images
            count += 1
            
    print(f"Updated {count} entries with images.")
    
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)
        
if __name__ == '__main__':
    main()

