"""Export blind annotation packet. Independent review is performed by real reviewers."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]


def main():
    rows=json.loads((ROOT/'data'/'challenge.json').read_text(encoding='utf-8'))
    out=[]
    for i,r in enumerate(rows):
        out.append(dict(pair_id=f'review-{i:03}',case_group=r['case_id'],language=r['language'],claim=r['claim'],passage=r['passage'],
            reviewer_id=None,review_label=None,visible_text_rationale=None))
    p=ROOT/'data'/'blind_review_packet.jsonl'
    p.write_text('\n'.join(json.dumps(r,ensure_ascii=False) for r in out)+'\n',encoding='utf-8')
    print(f'{len(out)} blind pairs exported to {p}. Candidate labels and model predictions omitted.')

if __name__=='__main__':main()
