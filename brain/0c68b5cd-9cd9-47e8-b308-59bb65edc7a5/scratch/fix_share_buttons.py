import re
import os

file_path = r"c:\Grhapoch\frontend\src\module\user\pages\restaurants\RestaurantDetails.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Share button at line 1973
# Pattern matches: <button onClick={(e) => e.stopPropagation()} className="..."><Share2 size={18} /></button>
pattern1 = re.compile(r'(<button\s+onClick=\{\(e\) => e\.stopPropagation\(\)\}\s+className="p-1\.5 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">\s+<Share2 size=\{18\} />\s+</button>)')
replacement1 = r'''<button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleShareClick(item);
                                            }}
                                            className="p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">

                                            <Share2 size={18} />
                                          </button>'''

# Fix 2: Share button in modal (line 2657)
pattern2 = re.compile(r'(<div className="absolute bottom-4 right-4 flex items-center gap-3">.*?<button className="h-10 w-10[^>]*?>\s+<Share2 className="h-5 w-5" />\s+</button>)', re.DOTALL)
def fix2(match):
    block = match.group(1)
    if 'onClick' not in block:
         # Replace the share button part
         return block.replace('<button className="h-10 w-10', '<button onClick={(e) => { e.stopPropagation(); handleShareClick(selectedItem); }} className="h-10 w-10')
    return block

# Fix 3: Share button in modal desktop (line 2709)
pattern3 = re.compile(r'(<button className="h-8 w-8 rounded-full border border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center transition-colors">\s+<Share2 className="h-4 w-4" />\s+</button>)')
replacement3 = r'''<button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareClick(selectedItem);
                          }}
                          className="h-8 w-8 rounded-full border border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center transition-colors">
                          <Share2 className="h-4 w-4" />
                        </button>'''

new_content = content
new_content = pattern1.sub(replacement1, new_content)
new_content = pattern2.sub(fix2, new_content)
new_content = pattern3.sub(replacement3, new_content)

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated the file.")
else:
    print("No changes were made. Patterns did not match.")
