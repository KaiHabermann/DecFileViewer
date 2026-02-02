from decaylanguage import DecFileParser
import os

test_file = 'DecFiles/dkfiles/tau+_anti-p-mu+mu+=FromB.dec'

print(f"Parsing {test_file}...")
dfp = DecFileParser(test_file)
dfp.parse()

mothers = dfp.list_decay_mother_names()
print(f"Mothers: {mothers}")

# Find all daughters used in the file
all_daughters = set()
for mother in mothers:
    decays = dfp.dict_decays2copy[mother] if mother in dfp.dict_decays2copy else dfp._parsed_decays.get(mother, [])
    # _parsed_decays structure is list of dicts: {'bf': ..., 'fs': [...], ...}
    # dict_decays2copy maps alias to original? No, it handles CDecay/CopyDecay.
    
    # Access via list_decay_modes might be cleaner
    modes = dfp.list_decay_modes(mother)
    for mode in modes:
        # mode is simpler string or object?
        # parsed_decays is better source of truth
        pass
        
    # Let's look at _parsed_decays directly
    if mother in dfp._parsed_decays:
        for decay in dfp._parsed_decays[mother]:
            for daughter in decay['fs']:
                 all_daughters.add(daughter)

print(f"All daughters: {all_daughters}")

roots = [m for m in mothers if m not in all_daughters]
print(f"Roots: {roots}")
