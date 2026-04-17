
import os

filepath = r"c:\Grhapoch\frontend\src\module\user\pages\DiningRestaurantDetail.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Identified duplicate block:
# Look for the first occurrence of "{/* Bottom Action for steps 1-5 */}"
# and the second occurrence.

first_occurrence = -1
second_occurrence = -1

for i, line in enumerate(lines):
    if "{/* Bottom Action for steps 1-5 */}" in line:
        if first_occurrence == -1:
            first_occurrence = i
        else:
            second_occurrence = i
            break

if first_occurrence != -1 and second_occurrence != -1:
    print(f"Found occurrences at {first_occurrence} and {second_occurrence}")
    # We want to remove from first_occurrence to just before second_occurrence.
    # But wait, we also have that extra </div> before it.
    
    # Let's find the closing </div> and } before the first occurrence.
    # Actually, let's just remove the block between them.
    
    # Based on view_file:
    # 1032:             }
    # 1033:                     </div>
    # 1034: 
    # 1035:                     {/* Bottom Action for steps 1-5 */}
    
    # We want to keep everything up to 1033.
    # And keep everything from 1098 onwards.
    
    # But wait, my line numbers were 1-indexed.
    # In 0-indexed:
    # 1032 -> 1031
    # 1033 -> 1032
    # ...
    # 1098 -> 1097
    
    # Let's find the EXACT lines.
    
    new_lines = lines[:first_occurrence - 2] + lines[second_occurrence:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("File cleaned successfully.")
else:
    print("Could not find both occurrences.")
