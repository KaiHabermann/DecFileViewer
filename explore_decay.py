from decaylanguage import DecFileParser
import os

test_file = 'DecFiles/dkfiles/Bd_ccKS,Jpsipipi,mm=TightCut.dec'

print(f"Parsing {test_file}...")
dfp = DecFileParser(test_file)
dfp.parse()

mothers = dfp.list_decay_mother_names()
print(f"Mothers: {mothers}")

# Find all daughters used in the file
all_daughters = set()
for mother in mothers:
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
print(f"Aliasses: {dfp.dict_aliases()}")
roots = [m for m in mothers if m not in all_daughters and "sig" in m]
print(f"Roots: {roots}")

for root in roots:
    print(f"Root: {root}")
    print(dfp.expand_decay_modes(root))