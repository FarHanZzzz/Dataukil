from pathlib import Path
import re
import unicodedata
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
LABELS=['SUPPORTED_BY_PASSAGE','CONTRADICTED_BY_PASSAGE','INSUFFICIENT_EVIDENCE']
DIGITS=str.maketrans('০১২৩৪৫৬৭৮৯','0123456789')
NEG=r'\b(?:not|no|never|denied|failed|pending|unconfirmed|different|separate|unrelated|requested|request|nai|hoyni|paini|alada|onno)\b|হয়নি|হয়নি|নয়|নয়|নেই|পাইনি|অস্বীকার|আলাদা|অন্য|অনুরোধ|অপেক্ষা'
TOPICS=[r'\bqr\b|কিউআর',r'cash|নগদ',r'repay|refund|returned|ferot|ফেরত',r'purchase|invoice|kenakata|কেনাকাটা|ক্রয়|ক্রয়|রসিদ']


def normalize(t):
    return unicodedata.normalize('NFC',t).translate(DIGITS).lower().strip()


def lexical(pairs):
    rows=[]
    for claim,passage in pairs:
        a,b=normalize(claim),normalize(passage)
        ta=set(re.findall(r'[\w]+',a));tb=set(re.findall(r'[\w]+',b))
        neg=bool(re.search(NEG,b))
        topics_a=[bool(re.search(t,a)) for t in TOPICS];topics_b=[bool(re.search(t,b)) for t in TOPICS]
        nums_a=set(re.findall(r'\d+',a));nums_b=set(re.findall(r'\d+',b))
        rows.append([len(ta&tb)/max(1,len(ta)),float(neg),float(a in b),float(bool(nums_a and nums_b and nums_a!=nums_b)),
                     *map(float,topics_a),*map(float,topics_b),*[float(x and y) for x,y in zip(topics_a,topics_b)],
                     *[float(x and y and neg) for x,y in zip(topics_a,topics_b)]])
    return np.array(rows,dtype=np.float32)


RULES_VERSION = 2


def rules(pairs):
    """Conservative topic-scoped rules. Never treat generic 'paid' as QR success."""
    results=[]
    for claim,passage in pairs:
        a,b=normalize(claim),normalize(passage)
        # Negation about the *request*, not completion, must not reverse completion.
        b=re.sub(r'not merely requested|not just requested|not merely a request|শুধু আবেদন নয়|শুধু আবেদন নয়|শুধু অনুরোধ নয়|শুধু অনুরোধ নয়','',b)
        if re.search(r'both|same purchase|duita|দুই পেমেন্ট',a):
            if re.search(r'different purchase|separate (?:purchase|sale)|alada (?:invoice|purchase)|আলাদা কেনাকাটা|রসিদ আলাদা',b):
                results.append(LABELS[1]);continue
            if re.search(r'same purchase|same invoice|one invoice|ekoi (?:invoice|kenakata)|একই (?:কেনাকাটা|রসিদ)',b) and (re.search(r'both|payments|duita|দুই',b) or (re.search(TOPICS[0],b) and re.search(TOPICS[1],b))):
                results.append(LABELS[0]);continue
            results.append(LABELS[2]);continue
        topic=2 if re.search(TOPICS[2],a) else 1 if re.search(TOPICS[1],a) else 0 if re.search(TOPICS[0],a) else None
        if topic is None or not re.search(TOPICS[topic],b):
            results.append(LABELS[2]);continue
        if topic==0:
            negative=r'qr[^.!?।;]{0,65}(?:did not complete|not complete|never took|failed|hoyni|successful hoyni|সম্পন্ন হয়নি|সম্পন্ন হয়নি|সফল হয়নি|ব্যর্থ)|qr[^.!?।;]{0,35}সম্পন্ন নয়'
            positive=r'qr[^.!?।;নগদ]{0,65}(?:completed|complete hoyeche|successful|succeeded|সম্পন্ন হয়েছে|সম্পন্ন হয়েছে|সফল)|successful qr'
        elif topic==1:
            negative=r'no cash|cash[^.!?।;]{0,65}(?:not received|did not receive|never took|denied|paini|hoyni)|did not receive cash|নগদ[^.!?।;]{0,65}(?:পাননি|পাইনি|গ্রহণ হয়নি|গ্রহণ হয়নি|গ্রহণ করা হয়নি|গ্রহণ করা হয়নি|অস্বীকার)'
            positive=r'cash[^.!?।;]{0,65}(?:received|receiving|completed|paid|peyechi|pey[e]?chi|hoyeche)|(?:paid|receiving|receive|received) (?:the )?cash|নগদ[^.!?।;]{0,65}(?:গ্রহণ করা হয়েছে|গ্রহণ করা হয়েছে|পেয়েছেন|পেয়েছেন|দিয়েছি|দিয়েছি|গ্রহণ ও সম্পন্ন)|নগদ টাকা গ্রহণ সম্পন্ন'
        else:
            negative=r'(?:repay|refund)[^.!?।;]{0,65}(?:not complete|never took|did not|denied|hoyni)|no funds (?:have been )?returned|not (?:been )?returned|ferot (?:jayni|hoyni)|ফেরত[^.!?।;]{0,65}(?:দেওয়া হয়নি|দেওয়া হয়নি|দেওয়া হয়ন|দেওয়া হয়ন|দেওয়া হয়নি|হয়নি|হয়নি|সম্পন্ন নয়)'
            positive=r'(?:repay|refund)[^.!?।;]{0,65}(?:completed|complete hoyeche|successful|happened|carried out|peyech|acknowledged)|(?:funds|money|taka)[^.!?।;]{0,25}(?:returned|ferot deya)|ফেরত[^.!?।;]{0,45}(?:সম্পন্ন হয়েছে|সম্পন্ন হয়েছে|দেওয়া হয়েছে|দেওয়া হয়েছে|গ্রহণ ও সম্পন্ন)|টাকা ফেরত সম্পন্ন'
        if re.search(negative,b):
            results.append(LABELS[1]);continue
        uncertain=r'unknown|unclear|unconfirmed|could not|cannot|may have|maybe|awaiting|pending|not sure|jani na|jana nei|নিশ্চিত নয়|নিশ্চিত নয়|জানা নেই|অস্পষ্ট|অপেক্ষা|হয়তো|হয়তো'
        if re.search(uncertain,b):
            results.append(LABELS[2]);continue
        # Prevent cash predicates later in a QR clause being attributed to QR.
        if topic==0:
            scoped=re.split(r'cash|নগদ',b)[0]
            supported=bool(re.search(positive,scoped))
        else:
            supported=bool(re.search(positive,b))
        results.append(LABELS[0] if supported else LABELS[2])
    return results


class Encoder:
    def __init__(self,path=None):
        import torch
        from transformers import AutoTokenizer,AutoModel
        torch.set_num_threads(4)
        self.torch=torch
        self.path=Path(path or ROOT/'models'/'encoder')
        self.tokenizer=AutoTokenizer.from_pretrained(self.path,local_files_only=True)
        self.model=AutoModel.from_pretrained(self.path,local_files_only=True).eval()

    def embed(self,texts,batch_size=12):
        torch=self.torch
        out=[]
        with torch.inference_mode():
            for i in range(0,len(texts),batch_size):
                tokens=self.tokenizer(['query: '+normalize(t) for t in texts[i:i+batch_size]],padding=True,truncation=False,return_tensors='pt')
                if tokens['input_ids'].shape[1]>256:
                    raise ValueError('Passage exceeds 256-token limit; explicit abstention is required.')
                h=self.model(**tokens).last_hidden_state
                mask=tokens['attention_mask'].unsqueeze(-1)
                v=(h*mask).sum(1)/mask.sum(1)
                v=torch.nn.functional.normalize(v,p=2,dim=1)
                out.append(v.cpu().numpy())
        return np.concatenate(out) if out else np.empty((0,384))

    def features(self,pairs):
        unique=list(dict.fromkeys(t for pair in pairs for t in pair))
        vectors=self.embed(unique)
        mapping=dict(zip(unique,vectors))
        a=np.array([mapping[c] for c,p in pairs]);b=np.array([mapping[p] for c,p in pairs])
        return np.concatenate([a,b,np.abs(a-b),a*b,lexical(pairs)],axis=1)
