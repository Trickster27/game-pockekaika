"""Генерация всех «живых» персонажей: python3 tools/art/gen.py src/assets/art [модуль ...]"""
import json, os, sys, importlib
sys.path.insert(0, os.path.dirname(__file__))
OUT = sys.argv[1]
MODULES = ['featured', 'order', 'grove', 'ash', 'abyss', 'forge', 'mobs', 'book1']
only = sys.argv[2:]
path = os.path.join(OUT, 'rigs.json')
rigs = json.load(open(path)) if os.path.exists(path) else {}
for name in MODULES:
    if only and name not in only:
        continue
    if not os.path.exists(os.path.join(os.path.dirname(__file__), name + '.py')):
        continue
    r = importlib.import_module(name).make(OUT)
    rigs.update(r)
    print(name, len(r))
# Ручные персонажи: точка руки/оружия, рост и стойка.
EXTRA = {'knight': {'hand': [47, -118], 'top': 118}, 'ifrita': {'hand': [29, -116], 'top': 120},
         'grom': {'hand': [36, -126], 'top': 122, 'idle': 'heavy'}, 'nocta': {'hand': [52, -58], 'top': 110, 'idle': 'sway'}}
for k, e in EXTRA.items():
    if k in rigs:
        rigs[k].update(e)
# Роли слоёв по именам (для поз в бою), если не заданы явно.
for key, rec in rigs.items():
    for p in rec['parts']:
        if 'role' in p:
            continue
        i = p['id']
        if i in ('head', 'eyes', 'hairFront', 'headgear', 'plume', 'hairBack') or i.startswith('head'):
            p['role'] = 'head'
        elif p.get('motion', {}).get('kind') == 'swing':
            p['role'] = 'weapon'
json.dump(rigs, open(path, 'w'), indent=1, ensure_ascii=False)
print('total', len(rigs))
