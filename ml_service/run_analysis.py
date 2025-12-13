#!/usr/bin/env python3
import sys
import json
import re
import os
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "clause-classifier")


tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()




def predict_clause_type(text: str) -> str:
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        pred_id = torch.argmax(logits, dim=1).item()

    return LABELS[pred_id]

LABELS = model.config.id2label

# ---------------------------
# Read raw text from stdin
# ---------------------------
raw_text = sys.stdin.read() or ""
text = raw_text.replace('\r', '').strip()

if not text:
    print(json.dumps({"status": "error", "message": "no text received"}))
    sys.exit(0)

# ---------------------------
# OCR / PDF noise cleaning helpers
# ---------------------------
OCR_GARBAGE_PATTERNS = [
    re.compile(r'ﬁ'),  # ligature
    re.compile(r'ﬂ'),
    re.compile(r'\u2013'),  # en dash
]

def clean_ocr_noise(s: str) -> str:
    s = s.replace('\x0c', '\n')  # form feed -> newline (pdf page break)
    for p in OCR_GARBAGE_PATTERNS:
        s = p.sub('', s)
    s = re.sub(r'[ \t]{2,}', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    s = '\n'.join(line.rstrip() for line in s.splitlines())
    return s.strip()

# normalize paragraphs and merge innocent line-breaks within paragraphs
def normalize_and_merge(s: str) -> str:
    # first normalize repeated newlines then operate paragraph-wise
    s = re.sub(r'\r\n?', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    paras = [p.strip() for p in re.split(r'\n{2,}', s) if p.strip()]
    merged_paras = []
    for p in paras:
        lines = [ln.strip() for ln in p.splitlines() if ln.strip()]
        if not lines:
            continue
        cur = lines[0]
        for ln in lines[1:]:
            ln_s = ln
            # If the next line looks like a heading, break
            if is_heading_line := False:
                pass
            # heuristics: if current ends with sentence-ending punctuation, keep as new sentence
            if re.search(r'[\.!\?;:]$', cur):
                cur = cur + ' ' + ln_s
            else:
                cur = cur + ' ' + ln_s
        merged_paras.append(cur.strip())
    return '\n\n'.join(merged_paras)

# We'll use a simple version of merge_broken_lines inside main flow below.

# ---------------------------
# Heading detection (robust)
# ---------------------------
def is_heading(line: str) -> bool:
    line = line.strip()
    if not line:
        return False

    # ANNEXURE / SCHEDULE / APPENDIX / NOTE / DECLARATION headings
    if re.match(r'^(ANNEXURE|SCHEDULE|APPENDIX|NOTE|NOTES|DECLARATION|ANNEXURE\s+[A-Z])\b', line, re.IGNORECASE):
        return True

    # ALL CAPS headings (ignore very short tokens)
    letters = sum(1 for c in line if c.isalpha())
    if line.upper() == line and letters >= 3 and len(line) <= 120:
        return True

    # Numbered headings: 1. Title / 2.1 Title / 3.2.4 Title
    if re.match(r'^\s*\d+(?:\.\d+){0,3}[\)\.\-]?\s+[A-Za-z].+', line):
        return True

    # ARTICLE / SECTION format
    if re.match(r'^\s*(ARTICLE|SECTION)\s+[IVXLCDM0-9]+', line, re.IGNORECASE):
        return True

    return False

# small helper used while normalizing paragraphs
def is_heading_line_for_merge(line: str) -> bool:
    return is_heading(line)

# ---------------------------
# Advanced segmentation function
# ---------------------------
def segment_clauses(text):
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    clauses = []
    current = []
    cid = 1

    # A) MAJOR headings → SHOULD split
    major_heading = re.compile(r'^\s*\d{1,2}\.\s+[A-Z][A-Za-z ]{3,100}$')

    # C) Inline headings → SHOULD split
    inline_heading = re.compile(r'^[A-Z][A-Za-z\' ]{2,100}:$')
    inline_heading_with_body = re.compile(
        r'^([A-Z][A-Za-z\' ]{2,100}):\s+(.+)$'
    )

    # B) Numbered lines → SHOULD NOT split (unless after major heading)
    small_numbered = re.compile(r'^\d{1,2}\.\s+.+')

    last_was_major = False

    def flush():
        nonlocal current, cid
        if not current:
            return
        block = " ".join(current).strip()
        if len(block) > 20:
            clauses.append({
                "id": cid,
                "title": current[0][:80],
                "text": block
            })
            cid += 1
        current = []

    for line in lines:

        # -------- A) MAJOR HEADING --------
        # Example: "14. INSURANCE AND LIABILITY"
        if major_heading.match(line):
            flush()
            current = [line]
            last_was_major = True
            continue

        # -------- C) INLINE HEADING WITH BODY --------
        # Example: "Tenant's Insurance: The tenant shall..."
        m = inline_heading_with_body.match(line)
        if m:
            flush()
            current = [m.group(1), m.group(2)]
            last_was_major = False
            continue

        # -------- C) INLINE HEADING ALONE --------
        # Example: "Tenant's Insurance:"
        if inline_heading.match(line):
            flush()
            current = [line]
            last_was_major = False
            continue

        # -------- B) NUMBERED SUB-ITEMS --------
        # Example: "1. The tenant shall maintain..."
        if small_numbered.match(line):
            if last_was_major:
                # numbered clause AFTER major heading → split
                flush()
                current = [line]
            else:
                # numbered list inside section → DO NOT split
                current.append(line)
            continue

        # -------- NORMAL TEXT --------
        current.append(line)
        last_was_major = False

    flush()
    return clauses


# ---------------------------
# Run segmentation and print JSON
# ---------------------------
clauses = segment_clauses(text)
for clause in clauses:
    clause["clause_type"] = predict_clause_type(clause["text"])


output = {
    "status": "success",
    "total_clauses": len(clauses),
    "clauses": clauses
}

print(json.dumps(output))
