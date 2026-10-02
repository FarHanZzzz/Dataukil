"""Fictional, template-family grouped NLI experiment. No hidden-world truth inputs."""
from pathlib import Path
import json
import hashlib
from .features import LABELS

ROOT=Path(__file__).resolve().parents[1]
# Each complete phrase family, including translations, remains in exactly one split.
# These are agent-authored annotation candidates, NOT independently human reviewed.
FAMILIES=[
  [('completed.','did not complete.','status is unknown.'),('সম্পন্ন হয়েছে।','সম্পন্ন হয়নি।','অবস্থা জানা নেই।'),('complete hoyeche.','complete hoyni.','status jani na.')],
  [('was confirmed as completed.','was confirmed as not completed.','could not be confirmed.'),('সম্পন্ন বলে নিশ্চিত করা হয়েছে।','সম্পন্ন হয়নি বলে নিশ্চিত করা হয়েছে।','নিশ্চিত করা যায়নি।'),('complete bole confirm hoyeche.','complete hoyni bole confirm hoyeche.','confirm kora jayni.')],
  [('took place successfully.','never took place.','may have taken place, but no confirmation is available.'),('সফলভাবে হয়েছে।','কখনো হয়নি।','হয়তো হয়েছে, কিন্তু নিশ্চিত নয়।'),('successful bhabe hoyeche.','kokhono hoyni.','hoyto hoyeche kintu sure na.')],
  [('is recorded as received and completed.','is recorded as not received or completed.','is mentioned without a completion result.'),('গ্রহণ ও সম্পন্ন হিসেবে নথিভুক্ত।','গ্রহণ বা সম্পন্ন হয়নি বলে নথিভুক্ত।','উল্লেখ আছে, সম্পন্ন হওয়ার ফল নেই।'),('received ar complete hishebe record ache.','received ba complete hoyni bole record ache.','mention ache kintu completion result nai.')],
  [('has been completed according to this note.','has not been completed according to this note.','is awaiting verification according to this note.'),('এই নোট অনুযায়ী সম্পন্ন হয়েছে।','এই নোট অনুযায়ী সম্পন্ন হয়নি।','এই নোট অনুযায়ী যাচাইয়ের অপেক্ষায়।'),('ei note e complete hoyeche.','ei note e complete hoyni.','ei note e verification er opekkhay.')],
  [('happened; the note explicitly confirms completion.','did not happen; the note explicitly denies completion.','was requested; no completion is established.'),('হয়েছে; নোটে স্পষ্ট নিশ্চিতকরণ আছে।','হয়নি; নোটে স্পষ্ট অস্বীকার আছে।','অনুরোধ করা হয়েছে; সম্পন্ন হওয়া প্রতিষ্ঠিত নয়।'),('hoyeche; note e confirm ache.','hoyni; note e deny kora ache.','request kora hoyeche; complete kina jani na.')],
  [('is complete, not merely requested.','is not complete, despite an earlier claim.','remains pending and cannot be called complete.'),('সম্পন্ন, শুধু অনুরোধ নয়।','আগের দাবি সত্ত্বেও সম্পন্ন নয়।','অপেক্ষমাণ, সম্পন্ন বলা যায় না।'),('complete, shudhu request na.','ager claim er poreo complete na.','pending, complete bola jay na.')],
  [('has a final successful result in the supplied passage.','has a final failed result in the supplied passage.','has an unclear result in the supplied passage.'),('দেওয়া লেখায় চূড়ান্ত সফল ফল আছে।','দেওয়া লেখায় চূড়ান্ত ব্যর্থ ফল আছে।','দেওয়া লেখায় অস্পষ্ট ফল আছে।'),('deya passage e final successful result ache.','deya passage e final failed result ache.','deya passage e unclear result ache.')],
  [('was carried out and acknowledged here.','was explicitly denied here.','is discussed, but its occurrence is not established.'),('এখানে হয়েছে এবং স্বীকার করা হয়েছে।','এখানে স্পষ্ট অস্বীকার করা হয়েছে।','আলোচনা হয়েছে, কিন্তু ঘটেছে কিনা জানা নেই।'),('ekhane hoyeche ar acknowledge kora ache.','ekhane explicitly denied.','alochona ache kintu hoyeche kina jana nei.')]
]
TOPICS=[
  [('The QR payment completed.','The QR payment'),('QR পেমেন্ট সম্পন্ন হয়েছে।','QR পেমেন্ট'),('QR payment complete hoyeche.','QR payment')],
  [('A cash payment was received.','Receipt of a cash payment'),('নগদ টাকা গ্রহণ করা হয়েছে।','নগদ টাকা গ্রহণ'),('Cash payment received hoyeche.','Cash payment receive')],
  [('Repayment completed.','Repayment'),('টাকা ফেরত দেওয়া হয়েছে।','টাকা ফেরত'),('Repayment complete hoyeche.','Repayment ferot')],
  [('Both payments are for the same purchase.','Linking both payments to the same purchase'),('দুই পেমেন্ট একই কেনাকাটার জন্য।','দুই পেমেন্ট একই কেনাকাটার সঙ্গে যুক্ত করা'),('Duita payment ekoi kenakatar jonno.','Duita payment ekoi kenakatay link')]
]


def build():
    rows=[]
    for family,forms in enumerate(FAMILIES):
        split='train' if family<5 else 'dev' if family<7 else 'test'
        for topic,langs in enumerate(TOPICS):
            for variation,amount in enumerate([250,500,1200]):
                for status,label in enumerate(LABELS):
                    case_id=f'fiction-{family}-{topic}-{variation}-{status}'
                    for language,((claim,subject),form) in enumerate(zip(langs,forms)):
                        lang=['en','bn','banglish'][language]
                        passage=f'{subject} {form[status]} BDT {amount}. Reference P-{family*100+topic*10+variation}.'
                        for pair_claim,pair_label in [(claim,label),(TOPICS[(topic+1)%4][language][0],LABELS[2])]:
                            rows.append(dict(id=f'pair-{len(rows):04}',case_id=case_id,group=f'phrase-family-{family}',split=split,language=lang,
                                claim=pair_claim,passage=passage,label=pair_label,annotation_status='agent-authored; independent human review pending',quality='clean text'))
    path=ROOT/'data';path.mkdir(exist_ok=True)
    body='\n'.join(json.dumps(r,ensure_ascii=False) for r in rows)+'\n'
    (path/'pairs.jsonl').write_text(body,encoding='utf-8')
    manifest=dict(dataset_sha256=hashlib.sha256((path/'pairs.jsonl').read_bytes()).hexdigest(),split_strategy='complete dependent phrase families, cases and translations grouped',
                  counts={s:sum(r['split']==s for r in rows) for s in ['train','dev','test']},
                  groups={s:sorted({r['group'] for r in rows if r['split']==s}) for s in ['train','dev','test']},
                  cases={s:len({r['case_id'] for r in rows if r['split']==s}) for s in ['train','dev','test']},
                  independent_human_review=False,hidden_truth_used=False)
    (path/'split_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps(manifest,indent=2))

if __name__=='__main__':build()
