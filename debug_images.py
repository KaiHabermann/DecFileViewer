from decaylanguage import DecFileParser, DecayChainViewer
import os

test_file = 'DecFiles/dkfiles/B+_K+a2a1a1a1mmmmmmK_0.25GeV_4.25GeV_100ps=DecProdCut.dec'
IMAGES_PUBLIC_DIR = 'frontend/public/images'
os.makedirs(IMAGES_PUBLIC_DIR, exist_ok=True)

print(f"DEBUG: Parsing {test_file}...")
dfp = DecFileParser(test_file)
dfp.parse()

mothers = dfp.list_decay_mother_names()
print(f"DEBUG: Mothers found: {mothers}")

print(f"DEBUG: dfp._parsed_decays type: {type(dfp._parsed_decays)}")
# print(f"DEBUG: dfp._parsed_decays content: {dfp._parsed_decays}")

all_daughters = set()

# Inspect internal structure based on previous error (list object has no items)
# _parsed_decays might be a LIST of dictionaries, not a dict of mother->decays?
# Or maybe the structure changed in 0.20?
print(f"DEBUG: dfp._parsed_decays type: {type(dfp._parsed_decays)}")
if isinstance(dfp._parsed_decays, dict):
    print("DEBUG: _parsed_decays is a dict. Iterating...")
    for mother_name, decays in dfp._parsed_decays.items():
            print(mother_name)
            print(decays)
            for decay in decays:
                if 'fs' in decay:
                    for d in decay['fs']:
                        all_daughters.add(d)
                        print(d)
elif isinstance(dfp._parsed_decays, list):
    print("DEBUG: _parsed_decays is a list. Iterating...")
    for decay_obj in dfp._parsed_decays:
        # decay_obj might be a dict representing a decay mode?
        # But where is the mother info?
        print(decay_obj)
        print(f"DEBUG: Item keys: {decay_obj.keys() if isinstance(decay_obj, dict) else 'Not a dict'}")
        
        # It seems _parsed_decays changed or I assumed wrong structure.
        # Let's try to get decays via public API if possible, or inspection.
        
        # In recent decaylanguage, _parsed_decays is a dict mapping particle -> list of decay modes.
        # BUT the error said 'list' object has no attribute 'items'.
        pass

print(dir(dfp))
print(dfp.number_of_decays)
non_root = set()
for mother in mothers:
    print(mother)
    print(dfp.list_decay_modes(mother))
    for mode in dfp.list_decay_modes(mother):
         for daughter in mode:
            non_root.add(daughter)


print(f"DEBUG: All daughters: {all_daughters}")

roots = [m for m in mothers if m not in non_root]
print(f"DEBUG: Computed roots: {roots}")

if not roots and mothers:
    print("DEBUG: No roots found, falling back to all mothers")
    roots = mothers

for mother in roots:
    print(f"DEBUG: Attempting to generate image for {mother}")
    try:
        chain = dfp.build_decay_chains(mother)
        dcv = DecayChainViewer(chain)
        
        filename_no_ext = os.path.splitext(os.path.basename(test_file))[0]
        safe_mother = mother.replace('/', '_').replace('+', 'p').replace('-', 'm').replace('*', 'st')
        image_name = f"{filename_no_ext}_{safe_mother}"
        output_path_base = os.path.join(IMAGES_PUBLIC_DIR, image_name)
        
        print(f"DEBUG: Rendering to {output_path_base}")
        dcv.graph.render(output_path_base, format='png', cleanup=True)
        print("DEBUG: Render successful")
    except Exception as e:
        print(f"DEBUG: Error: {e}")
