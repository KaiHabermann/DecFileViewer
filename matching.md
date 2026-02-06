

## Algorithm

- Query A -> B C D ... is assumed 1 layer
- Matching: In Graph G Look up B C D ...
- Check 0:
    - B C D... must be perfectly covered by a set of daughter lists: i.e exact number and types of daughters matches query perfectly
- Check 1: 
    - walk graph in reverse to root. Collect list of accepted roots (all mothers)
    - Match against query
- Check 2: 
    - Add all the node weights. 
    - leaves have a weight of 1 and nodes a sum of the wights of their daughters.
    - If sum(all_found daughters == value of mother) then the result is valid
