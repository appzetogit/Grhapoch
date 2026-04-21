import sys

with open(r'c:\Grhapoch\frontend\src\module\admin\pages\categories\Category.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    # Match the specific block to remove (first handleAddNew)
    # HandleAddNew starts at index 247 (1-indexed 248)
    # We want to remove the first one, which has safeImage in it.
    if "const handleAddNew = () => {" in line and "safeImage" in lines[i+2]:
        skip = True
    
    if not skip:
        new_lines.append(line)
    
    if skip and "};" in line:
        skip = False

with open(r'c:\Grhapoch\frontend\src\module\admin\pages\categories\Category.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
