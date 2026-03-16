import os
import re

def main():
    root = r'e:\agentforge\flowforge-ai'
    file_map = {}
    
    # Build a map of lowercase path -> true case path
    for dirpath, dirnames, filenames in os.walk(root):
        if 'node_modules' in dirpath or '.next' in dirpath or '.git' in dirpath:
            continue
        for f in filenames:
            if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                full_path = os.path.join(dirpath, f)
                rel_path = os.path.relpath(full_path, root).replace('\\', '/')
                base = os.path.splitext(rel_path)[0]
                
                file_map[rel_path.lower()] = rel_path
                file_map[base.lower()] = base
                if base.endswith('/index'):
                    stripped = base[:-6]  # type: ignore
                    file_map[stripped.lower()] = stripped
                    
    issues = set()
    import_re = re.compile(r'(?:import|export)\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]')
    dynamic_import_re = re.compile(r'import\([\'"]([^\'"]+)[\'"]\)')
    
    for dirpath, dirnames, filenames in os.walk(root):
        if 'node_modules' in dirpath or '.next' in dirpath or '.git' in dirpath:
            continue
        for f in filenames:
            if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                full_path = os.path.join(dirpath, f)
                try:
                    with open(full_path, 'r', encoding='utf-8') as file:
                        content = file.read()
                    matches = import_re.findall(content) + dynamic_import_re.findall(content)
                    
                    for match in matches:
                        if match.startswith('.'):
                            rel_dir = os.path.relpath(dirpath, root).replace('\\', '/')
                            if rel_dir == '.':
                                rel_dir = ''
                            
                            resolved = os.path.normpath(posixpath_join(rel_dir, match)).replace('\\', '/')
                            resolved_lower = resolved.lower()
                            
                            if resolved_lower in file_map:
                                correct_case = file_map.get(resolved_lower)
                                if correct_case and resolved != correct_case and not resolved.endswith('.css'):
                                    issues.add(f"{full_path} -> Import '{match}' should be '{correct_case}'")
                        elif match.startswith('@/'):
                            resolved = match[2:]
                            resolved_lower = resolved.lower()
                            if resolved_lower in file_map:
                                correct_case = file_map.get(resolved_lower)
                                if correct_case and resolved != correct_case:
                                    issues.add(f"{full_path} -> Import '{match}' should be '@/{correct_case}'")
                except Exception as e:
                    pass

    if issues:
        print("CASE SENSITIVITY ISSUES FOUND:")
        for issue in issues:
            print(issue)
    else:
        print("No case sensitivity issues found.")

def posixpath_join(a, b):
    if not a: return b
    return a + '/' + b

if __name__ == '__main__':
    main()
