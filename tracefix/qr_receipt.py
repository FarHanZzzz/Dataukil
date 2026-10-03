"""OpenCV visual regions, never OCR or receipt authentication."""
import base64
import hashlib
import io
import re
from PIL import Image, ImageDraw, ImageFont
from .domain import now

MAX_PIXELS=12_000_000


def validate_image(content, mime):
    if mime not in ('image/png','image/jpeg'): raise ValueError('Use a PNG or JPEG receipt image.')
    with Image.open(io.BytesIO(content)) as image:
        if image.width*image.height>MAX_PIXELS or min(image.size)<100:
            raise ValueError('Receipt must be at least 100px on each side and at most 12 megapixels.')
        if image.format!=('PNG' if mime=='image/png' else 'JPEG'): raise ValueError('Image bytes do not match the supplied MIME type.')
        image.verify()


def sample_receipt(sim):
    image=Image.new('RGB',(900,1280),'#f8fbff'); draw=ImageDraw.Draw(image)
    try:
        font=ImageFont.truetype('DejaVuSans.ttf',25)
        bold=ImageFont.truetype('DejaVuSans-Bold.ttf',34)
    except OSError: font=bold=ImageFont.load_default()
    draw.rectangle((32,32,868,1248),outline='#235d91',width=4)
    draw.text((64,70),'SYNTHETIC DATAUKIL DEMO',fill='#235d91',font=bold)
    rows=[('Merchant',sim['merchant']),('Purchase',sim['purchase_id']),('Item',sim['item']),
        ('Amount',f"BDT {sim['cash_amount_minor']/100:.2f}"),('Cash reference','CASH-'+sim['purchase_id']),
        ('Timestamp',sim['created_at']),('Payment','CASH RECEIVED')]
    for i,(key,value) in enumerate(rows):
        y=185+i*130
        draw.text((64,y),key.upper(),fill='#526780',font=font)
        draw.text((64,y+40),str(value),fill='#102340',font=font)
    draw.text((64,1160),'Evidence for review. Not financial proof.',fill='#235d91',font=font)
    out=io.BytesIO();image.save(out,format='PNG')
    return out.getvalue(),'image/png','\n'.join(f'{key}: {value}' for key,value in rows)


def parse_transcript(transcript):
    labels={'merchant':'Merchant','purchase_id':'Purchase','item':'Item','amount':'Amount','cash_reference':'Cash reference','timestamp':'Timestamp'}
    fields={}
    for key,label in labels.items():
        match=re.search(r'^'+re.escape(label)+r':\s*(.+)$',transcript,re.M|re.I)
        value=match.group(1).strip() if match else None
        if key=='amount' and value: value=re.sub(r'^(BDT|৳)\s*','',value,flags=re.I)
        fields[key]=value
    return fields


def annotate(content, transcript='', mime='image/png'):
    import cv2
    import numpy as np
    validate_image(content,mime)
    raw=cv2.imdecode(np.frombuffer(content,dtype=np.uint8),cv2.IMREAD_COLOR)
    if raw is None: raise ValueError('OpenCV could not decode the image.')
    gray=cv2.cvtColor(raw,cv2.COLOR_BGR2GRAY)
    normalized=cv2.normalize(gray,None,0,255,cv2.NORM_MINMAX)
    _,threshold=cv2.threshold(normalized,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    contours,_=cv2.findContours(cv2.Canny(normalized,50,150),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    paper_candidates=[c for c in contours if cv2.contourArea(c)>raw.shape[0]*raw.shape[1]*.25]
    paper=max(paper_candidates,key=cv2.contourArea) if paper_candidates else None
    corrected=raw; warnings=[]
    if paper is not None:
        polygon=cv2.approxPolyDP(paper,.02*cv2.arcLength(paper,True),True)
        if len(polygon)==4:
            pts=polygon.reshape(4,2).astype('float32')
            sums=pts.sum(axis=1);diff=np.diff(pts,axis=1).ravel()
            ordered=np.array([pts[sums.argmin()],pts[diff.argmin()],pts[sums.argmax()],pts[diff.argmax()]],dtype='float32')
            h,w=raw.shape[:2]
            target=np.array([[0,0],[w-1,0],[w-1,h-1],[0,h-1]],dtype='float32')
            corrected=cv2.warpPerspective(raw,cv2.getPerspectiveTransform(ordered,target),(w,h))
        else: warnings.append('Paper contour is irregular; review alignment manually.')
    else: warnings.append('No reliable paper contour was detected.')
    gray=cv2.cvtColor(corrected,cv2.COLOR_BGR2GRAY)
    _,ink=cv2.threshold(gray,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)
    ink=cv2.dilate(ink,cv2.getStructuringElement(cv2.MORPH_RECT,(24,3)))
    text_contours,_=cv2.findContours(ink,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    h,w=corrected.shape[:2]
    detected=sorted([cv2.boundingRect(v) for v in text_contours if cv2.contourArea(v)>40],key=lambda b:b[1])
    fields=parse_transcript(transcript)
    regions=[]
    # Display labels come from the preserved transcript. Geometric regions are
    # detected visually and are advisory; no text recognition is performed.
    for i,(key,value) in enumerate(fields.items()):
        center=int((.145+i*.102)*h)
        candidates=[b for b in detected if abs(b[1]-center)<h*.05 and b[2]<w*.96]
        if candidates:
            x=min(b[0] for b in candidates);y=min(b[1] for b in candidates)
            right=max(b[0]+b[2] for b in candidates);bottom=max(b[1]+b[3] for b in candidates)
            box=[int(x),int(y),int(right-x),int(bottom-y)]
        else: box=[int(w*.055),center,int(w*.89),int(h*.085)]
        regions.append(dict(field=key,bbox=box,displayed_value=value,value_source='preserved_transcript',
            confidence=.85 if candidates else .35,requires_review=value is None or not candidates))
        x,y,bw,bh=box
        cv2.rectangle(corrected,(x,y),(min(w-1,x+bw),min(h-1,y+bh)),(255,150,20),3)
    # Bound the derived preview independently of the immutable full-resolution input.
    scale=min(1,1600/max(w,h))
    preview=cv2.resize(corrected,(max(1,int(w*scale)),max(1,int(h*scale)))) if scale<1 else corrected
    ok,encoded=cv2.imencode('.png',preview)
    if not ok: raise ValueError('The annotated preview could not be produced.')
    warnings.append('Visual annotations are advisory. Transcript values are customer evidence, not source authority.')
    return dict(input_sha256=hashlib.sha256(content).hexdigest(),engine=dict(name='opencv',version=cv2.__version__),
        status='ANNOTATED',image_width=w,image_height=h,regions=regions,fields=fields,warnings=warnings,at=now(),
        preview_mime='image/png',preview_base64=base64.b64encode(encoded.tobytes()).decode(),
        processing=['decode','grayscale','normalize','threshold','paper_contour','perspective_correction','region_detection'])
