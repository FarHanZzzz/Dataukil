"""Choose an honest advisory runtime from already-saved measurements, no retesting."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]


def main():
    r=json.loads((ROOT/'artifacts'/'evaluation.json').read_text(encoding='utf-8'))
    challenge=r['suites']['authored_challenge']
    prefer_rules=challenge['rules']['macro_f1']>=challenge['trained_verifier']['macro_f1']
    p=dict(primary='rules' if prefer_rules else 'trained_verifier',trained_advisory=True,
           reason='The first frozen authored challenge favored rules in macro F1; trained predictions remain visible. Neither is independently human validated.',
           evaluation_version=r['version'],selection_after_first_test=True)
    (ROOT/'artifacts'/'runtime_policy.json').write_text(json.dumps(p,indent=2),encoding='utf-8')
    print(json.dumps(p,indent=2))

if __name__=='__main__':main()
