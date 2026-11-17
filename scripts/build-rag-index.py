# 离线构建 RAG 检索索引：把中考真题 PDF 切成题目级文本块，统计 2~3 字元组词频。
# 只做一次性构建，运行时由 server/rag/index.js 读取压缩后的 JSON，不再依赖 Python。
# 用法：python scripts/build-rag-index.py [--corpus 中考] [--out server/rag/rag-index.json.gz]
import argparse
import gzip
import json
import re
import sys
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:  # 旧版本仍然叫 fitz
    import fitz

ROOT = Path(__file__).resolve().parent.parent
SUBJECTS = ['数学', '物理', '化学', '生物', '语文', '英语', '历史', '地理', '政治', '道德与法治']
NOISE = re.compile(r'人人可教|陪娃到十五|微信公众号|扫码|长按|关注公众号|更多真题')
PAGE_NOISE = re.compile(r'^[\s第页]*\d{1,3}[\s页]*$')
QUESTION_START = re.compile(r'^\s*(?:\d{1,2}|[一二三四五六七八九十]{1,3})[.、．]\s*')


def clean_lines(text):
    lines = []
    for raw in text.replace('\u3000', ' ').split('\n'):
        line = raw.strip()
        if not line or NOISE.search(line) or PAGE_NOISE.match(line):
            continue
        lines.append(line)
    return lines


def split_segments(lines):
    segments = []
    current = []
    for line in lines:
        if QUESTION_START.match(line) and current:
            segments.append('\n'.join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        segments.append('\n'.join(current))
    return [segment for segment in segments if len(segment) >= 40]


def pack_chunks(segments, limit=640):
    chunks = []
    buffer = ''
    for segment in segments:
        if buffer and len(buffer) + len(segment) > limit:
            chunks.append(buffer)
            buffer = segment
        else:
            buffer = f'{buffer}\n{segment}' if buffer else segment
    if buffer:
        chunks.append(buffer)
    return [chunk for chunk in chunks if len(chunk) >= 60]


def detect_subject(name):
    for subject in SUBJECTS:
        if subject in name:
            return subject
    return ''


def detect_variant(name):
    if '解析' in name or '答案' in name:
        return '解析版'
    if '原卷' in name or '试题' in name:
        return '原卷版'
    return '试卷'


def normalize(text):
    """与 server/rag/index.js 的 normalizeText 保持一致：全角转半角、去掉标点空白。"""
    text = text.lower()
    text = ''.join(chr(ord(char) - 0xfee0) if '\uff01' <= char <= '\uff5e' else char for char in text)
    return re.sub(r'[^0-9a-z\u4e00-\u9fff]', '', text)


def tokenize(text):
    normalized = normalize(text)
    tokens = []
    cjk = ''.join(re.findall(r'[\u4e00-\u9fff]', normalized))
    for size in (2, 3):
        for index in range(len(cjk) - size + 1):
            tokens.append(cjk[index:index + size])
    tokens.extend(re.findall(r'[0-9a-z]{2,}', normalized))
    return tokens


def collect_files(corpus_roots):
    files = []
    for root in corpus_roots:
        for path in sorted(root.glob('**/*.pdf')):
            subject = detect_subject(path.name)
            if not subject:
                continue
            variant = detect_variant(path.name)
            year_match = re.search(r'(20\d{2})', str(path))
            files.append({
                'path': path, 'exam': root.name, 'stage': '初中',
                'year': int(year_match.group(1)) if year_match else 0,
                'subject': subject, 'variant': variant
            })
    # 解析版优先进入去重表，原卷版重复题面会被丢弃。
    return sorted(files, key=lambda item: (0 if item['variant'] == '解析版' else 1, item['year'], item['path'].name))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--corpus', default='中考')
    parser.add_argument('--out', default='server/rag/rag-index.json.gz')
    args = parser.parse_args()

    roots = [ROOT / name.strip() for name in args.corpus.split(',') if (ROOT / name.strip()).exists()]
    files = collect_files(roots)
    chunks, seen, skipped = [], set(), []
    postings = {}
    doc_lengths = []

    for item in files:
        try:
            document = fitz.open(item['path'])
        except Exception as error:  # 损坏文件跳过，不影响整体索引
            skipped.append((item['path'].name, str(error)))
            continue
        text = '\n'.join(page.get_text() for page in document)
        document.close()
        if len(text) < 200:
            skipped.append((item['path'].name, 'no-text-layer'))
            continue
        for chunk in pack_chunks(split_segments(clean_lines(text))):
            key = normalize(chunk)[:140]
            if key in seen:
                continue
            seen.add(key)
            chunk_id = len(chunks)
            tokens = tokenize(chunk)
            counts = {}
            for token in tokens:
                counts[token] = counts.get(token, 0) + 1
            doc_lengths.append(len(tokens))
            for token, count in counts.items():
                postings.setdefault(token, []).append([chunk_id, count])
            chunks.append({
                'id': chunk_id, 'text': chunk,
                'exam': item['exam'], 'stage': item['stage'], 'year': item['year'],
                'subject': item['subject'], 'variant': item['variant'],
                'file': f"{item['exam']}/{item['path'].relative_to(ROOT / item['exam']).as_posix()}"
            })

    # 只保留出现 2 次以上的词元，稀有词对检索贡献小但会显著放大索引体积。
    postings = {token: docs for token, docs in postings.items() if len(docs) >= 2}
    payload = {
        'version': 1,
        'builtAt': __import__('datetime').datetime.now().isoformat(timespec='seconds'),
        'stats': {'files': len(files), 'chunks': len(chunks), 'terms': len(postings), 'skipped': len(skipped)},
        'chunks': chunks,
        'docLengths': doc_lengths,
        'postings': postings,
        'skipped': skipped[:20]
    }

    output = ROOT / args.out
    output.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(output, 'wt', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(',', ':'))
    size = output.stat().st_size / 1024 / 1024
    print(json.dumps({
        'out': str(output), 'sizeMB': round(size, 2),
        'files': len(files), 'chunks': len(chunks), 'terms': len(postings),
        'skipped': len(skipped), 'sample': chunks[0]['text'][:80] if chunks else ''
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
