

This repository aims to take so called dec files, which are files describing particle decays, and make them searchable in a nice web interface.

There is a repository called DecFiles, from which we take the files. 
Allways assume this repository exists in the main file tree.

the process of making the files available has two steps:

- 1: use ```parse_dkfiles.py``` to generate a JSON containing all needed information as well as a folder dotfiles containing dotfiles describing the decays. Further, the decayfiles are all copied into dkfiles. All these files and folders are written into frontend/public 
- 2: In the frontend folder there is a react project, which takes the JSON form the public folder and displays the info. 


Finally the goal is to take all releases of the decfiles repository:
https://gitlab.cern.ch/lhcb-datapkg/Gen/DecFiles.git



## Instructions for code quality:
- Write minimal comments. 
- For python type as much as possible
