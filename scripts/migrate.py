import os
import re
import yaml
from pathlib import Path

SOURCE_DIR = Path('migrate/_posts')
MIGRATE_ROOT = Path('migrate')
DEST_DIR = Path('src/content/blog')
DEFAULT_AUTHOR = 'chara'

slugify = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def load_post(path):
    text = path.read_text(encoding='utf-8')
    if text.startswith('---'):
        _, fm_text, content = text.split('---', 2)
        data = yaml.safe_load(fm_text)
    else:
        data = {}
        content = text
    return data, content.strip()

for md_path in SOURCE_DIR.glob('*.md'):
    data, body = load_post(md_path)
    slug = slugify(md_path.stem)
    dest_dir = DEST_DIR / slug
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / 'index.mdx'

    image = data.get('top_image') or data.get('image')
    if image:
        if image.startswith('http'):
            new_image = image
        else:
            img_path = MIGRATE_ROOT / image.lstrip('/')
            if img_path.exists():
                dest_img = dest_dir / Path(img_path.name)
                dest_img.write_bytes(img_path.read_bytes())
                new_image = './' + dest_img.name
            else:
                new_image = image
    else:
        new_image = None

    tags = []
    for key in ('categories', 'tags'):
        val = data.get(key)
        if isinstance(val, list):
            for item in val:
                if isinstance(item, list):
                    tags.extend(item)
                else:
                    tags.append(item)
        elif isinstance(val, str):
            tags.append(val)
    tags = [slugify(t) for t in tags if t]
    tags = list(dict.fromkeys(tags))

    fm = {
        'title': data.get('title', md_path.stem),
        'description': data.get('excerpt', ''),
        'date': str(data.get('date')).split(' ')[0],
        'tags': tags,
        'authors': [DEFAULT_AUTHOR],
    }
    if new_image:
        fm['image'] = new_image

    with dest_path.open('w', encoding='utf-8') as f:
        f.write('---\n')
        yaml.safe_dump(fm, f, sort_keys=False)
        f.write('---\n\n')
        f.write(body.replace('<!-- more -->', '') + '\n')

print('Migrated', len(list(SOURCE_DIR.glob('*.md'))), 'posts')
