"""Immutable receipt fixtures and OpenCV visual regions: never OCR/authentication."""
import base64
import hashlib
import io
import json
import re
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from .domain import now, uid

MAX_PIXELS = 12_000_000
FONT_DIR = Path(__file__).resolve().parent.parent / 'static/fonts/receipt'
DEFAULT_ITEMS = [dict(description=d, quantity=1, unit_price_minor=p) for d, p in [
    ('Rice, 1 kg',8000),('Milk, 500 ml',5000),('Eggs, 4 pieces',4800),
    ('Bread, one loaf',4500),('Bananas, 4 pieces',3200),('Potatoes, 1 kg',4000),
    ('Tomatoes, 500 g',3500),('Yoghurt, 100 g',3000),('Cooking oil, 500 ml',14000)]]


def validate_image(content, mime):
    if mime not in ('image/png', 'image/jpeg'):
        raise ValueError('Use a PNG or JPEG receipt image.')
    with Image.open(io.BytesIO(content)) as image:
        if image.width * image.height > MAX_PIXELS or min(image.size) < 100:
            raise ValueError('Receipt must be at least 100px on each side and at most 12 megapixels.')
        if image.format != ('PNG' if mime == 'image/png' else 'JPEG'):
            raise ValueError('Image bytes do not match the supplied MIME type.')
        image.verify()


def purchase_items(sim):
    return sim.get('line_items') or [dict(description=sim['item'],quantity=1,
        unit_price_minor=sim['total_minor'],line_total_minor=sim['total_minor'])]


def render_receipt(sim):
    """Return bytes, transcript and measured template regions from one snapshot."""
    normal = ImageFont.truetype(str(FONT_DIR/'DejaVuSansCondensed.ttf'), 31)
    small = ImageFont.truetype(str(FONT_DIR/'DejaVuSansCondensed.ttf'), 23)
    bold = ImageFont.truetype(str(FONT_DIR/'DejaVuSansCondensed-Bold.ttf'), 36)
    title = ImageFont.truetype(str(FONT_DIR/'DejaVuSansCondensed-Bold.ttf'), 64)
    total_font = ImageFont.truetype(str(FONT_DIR/'DejaVuSansCondensed-Bold.ttf'), 48)
    # First lay out against a scratch canvas; height follows wrapped contents.
    canvas = Image.new('RGB', (900, 6500), '#fafafa')
    draw = ImageDraw.Draw(canvas)
    fields = []
    y = 88
    def font_for(value,font):
        if re.search('[\u0980-\u09ff]',str(value)):
            name='NotoSansBengali-Bold.ttf' if 'Bold' in str(font.path) else 'NotoSansBengali-Regular.ttf'
            return ImageFont.truetype(str(FONT_DIR/name),font.size)
        return font
    def text(value, key=None, font=normal, center=False, right=False, x=90):
        nonlocal y
        value = str(value)
        font=font_for(value,font)
        width = draw.textlength(value, font=font)
        px = (900-width)/2 if center else 810-width if right else x
        draw.text((px,y), value, fill='#171717', font=font)
        box = draw.textbbox((px,y),value,font=font)
        if key:
            fields.append(dict(field=key,bbox=[box[0],box[1],box[2]-box[0],box[3]-box[1]]))
        return box
    def wrapped(value, key, font=normal, width=720, center=False):
        nonlocal y
        # Character wrapping also supports long, unbroken supplied names.
        remaining = str(value)
        font=font_for(value,font)
        while remaining:
            cut = len(remaining)
            while draw.textlength(remaining[:cut],font=font)>width: cut-=1
            if cut<len(remaining) and ' ' in remaining[:cut]: cut=remaining.rfind(' ',0,cut)+1
            text(remaining[:cut].strip(),key,font=font,center=center)
            remaining=remaining[cut:].lstrip(); y+=43
    def rule():
        nonlocal y
        for x in range(90,810,22): draw.line((x,y,x+12,y), fill='#444444',width=2)
        y+=25
    def money_line(label, value, key, font=normal):
        nonlocal y
        text(label,font=font); box=text(f'BDT {value/100:.2f}',key,font=font,right=True)
        if key=='total':fields.append(dict(field='currency',bbox=[box[0],box[1],box[2]-box[0],box[3]-box[1]]))
        y+=53
    merchant=sim['merchant']
    title=font_for(merchant,title)
    # Shrink only the merchant heading to preserve its centered receipt hierarchy.
    while draw.textlength(merchant,font=title)>720:
        title=ImageFont.truetype(str(title.path),title.size-1)
    text(merchant,'merchant',font=title,center=True); y+=88
    address=sim.get('merchant_address') or 'Dhaka, Bangladesh'
    wrapped(address,'address',font=small,center=True)
    issued=sim.get('receipt_issued_at') or sim['created_at']
    timestamp=datetime.fromisoformat(issued).astimezone(timezone(timedelta(hours=6))).strftime('%d/%m/%Y %I:%M:%S %p %z')
    text(timestamp,'timestamp',font=small,center=True); y+=39
    text('Invoice '+sim['purchase_id'],'purchase_id',font=small,center=True); y+=56
    text('Purchased items',font=bold,center=True); y+=70
    transcript=[f'Merchant: {merchant}',f'Address: {address}',f'Timestamp: {timestamp}',
                f'Purchase: {sim["purchase_id"]}','Currency: BDT']
    items=purchase_items(sim)
    for i,item in enumerate(items):
        key=f'line_items.{i}'
        value=item.get('line_total_minor',item['quantity']*item['unit_price_minor'])
        text(f'{value/100:.2f}',key,right=True)
        wrapped(item['description'],key,width=525)
        if item['quantity']!=1:
            text(f'{item["quantity"]} x {item["unit_price_minor"]/100:.2f}',key,font=small); y+=36
        y+=9
        transcript.append(f'Item {i+1}: '+json.dumps([item['description'],item['quantity'],item['unit_price_minor'],value],ensure_ascii=False,separators=(',',':')))
    y+=12;rule()
    subtotal=sim.get('subtotal_minor',sim['total_minor'])
    tax=sim.get('tax_minor',0)
    money_line('Subtotal',subtotal,'subtotal',bold)
    money_line('Tax',tax,'tax')
    rule(); y+=13
    money_line('TOTAL',sim['total_minor'],'total',total_font); y+=25
    money_line('Cash paid',sim['cash_amount_minor'],'cash_paid')
    text('Payment: CASH','payment_method',font=small); y+=37
    wrapped('Cash ref: CASH-'+sim['purchase_id'],'cash_reference',font=small)
    y+=25
    # Decorative, deterministic barcode: no encoded/decoded financial authority.
    start=y; x=210
    for byte in hashlib.sha256(sim['purchase_id'].encode()).digest()*2:
        width=2+(byte%3)
        if x+width>690: break
        draw.rectangle((x,y,x+width,y+91),fill='#171717');x+=width+3
    fields.append(dict(field='barcode',bbox=[210,start,x-210,92]))
    y+=110;text('Thank you for shopping with us!',font=small,center=True);y+=40
    text('Synthetic DataUkil Demo',font=small,center=True);y+=42
    text('Decorative barcode · evidence for review',font=small,center=True);y+=65
    image=canvas.crop((0,0,900,y))
    # A quiet paper surface, with an actual boundary for contour detection.
    paper=Image.new('RGB',(900,y),'#eeeeeb')
    pd=ImageDraw.Draw(paper);pd.rectangle((42,35,858,y-35),fill='#f7f6f1',outline='#d3d2cc',width=2)
    # Composite printing only; do not paint the scratch canvas's background.
    import numpy as np
    pixels=np.asarray(image);mask=Image.fromarray((pixels.min(axis=2)<160).astype('uint8')*255)
    paper.paste(image,(0,0),mask)
    output=io.BytesIO();paper.save(output,format='PNG',optimize=True)
    transcript += [f'Subtotal: BDT {subtotal/100:.2f}',f'Tax: BDT {tax/100:.2f}',
        f'Total: BDT {sim["total_minor"]/100:.2f}',f'Cash paid: BDT {sim["cash_amount_minor"]/100:.2f}',
        'Payment: CASH',f'Cash reference: CASH-{sim["purchase_id"]}']
    return output.getvalue(), '\n'.join(transcript), dict(version=2,width=900,height=y,fields=fields)


def sample_receipt(sim):
    if sim.get('issued_receipt'):
        receipt=sim['issued_receipt']
        return base64.b64decode(receipt['base64']),receipt['mime'],receipt['transcript']
    content,transcript,_=render_receipt(sim)
    return content,'image/png',transcript


def parse_transcript(transcript):
    labels={'merchant':'Merchant','address':'Address','purchase_id':'Purchase','item':'Item',
        'amount':'Amount','cash_reference':'Cash reference','timestamp':'Timestamp','currency':'Currency',
        'subtotal':'Subtotal','tax':'Tax','total':'Total','cash_paid':'Cash paid','payment_method':'Payment'}
    fields={}
    for key,label in labels.items():
        match=re.search(r'^'+re.escape(label)+r':\s*([^\n]+)$',transcript,re.M|re.I)
        value=match.group(1).strip() if match else None
        if key in ('amount','subtotal','tax','total','cash_paid') and value:
            value=re.sub(r'^(BDT|৳)\s*','',value,flags=re.I)
        fields[key]=value
    items=[]
    for match in re.finditer(r'^Item (\d+):\s*(.+)$',transcript,re.M|re.I):
        try:
            item=json.loads(match.group(2))
            if isinstance(item,list) and len(item)==4:item=dict(zip(('description','quantity','unit_price_minor','line_total_minor'),item))
            if not isinstance(item,dict) or not isinstance(item.get('description'),str): continue
            if any(type(item.get(k)) is not int for k in ('quantity','unit_price_minor','line_total_minor')):continue
            items.append(item)
        except (ValueError,TypeError): continue
    fields['line_items']=items
    # Preserve legacy labels explicitly; they do not silently supply cash paid.
    if not fields['total']:fields['total']=fields['amount']
    if not fields['item'] and items:fields['item']='; '.join(i['description'] for i in items)
    return fields


def money_minor(value):
    try:
        amount=Decimal(str(value))
        if not amount.is_finite() or amount<0 or amount*100!=int(amount*100):return None
        return int(amount*100)
    except (InvalidOperation,ValueError,OverflowError):return None


def field_values(fields):
    values={k:v for k,v in fields.items() if k not in ('line_items','amount','item')}
    for i,item in enumerate(fields.get('line_items',[])):
        values[f'line_items.{i}']=f'{item["description"]} · {item["quantity"]} × BDT {item["unit_price_minor"]/100:.2f} · BDT {item["line_total_minor"]/100:.2f}'
    if not fields.get('line_items'):values['item']=fields.get('item')
    values['barcode']=None
    return values


def annotate(content, transcript='', mime='image/png', template=None):
    import cv2
    import numpy as np
    validate_image(content,mime)
    with Image.open(io.BytesIO(content)) as original:
        ow,oh=original.size;orientation=original.getexif().get(274,1)
        raw=np.array(ImageOps.exif_transpose(original).convert('RGB'))[:,:,::-1].copy()
    h,w=raw.shape[:2]
    orientations={1:[[1,0,0],[0,1,0],[0,0,1]],2:[[-1,0,ow-1],[0,1,0],[0,0,1]],
        3:[[-1,0,ow-1],[0,-1,oh-1],[0,0,1]],4:[[1,0,0],[0,-1,oh-1],[0,0,1]],
        5:[[0,1,0],[1,0,0],[0,0,1]],6:[[0,-1,oh-1],[1,0,0],[0,0,1]],
        7:[[0,-1,oh-1],[-1,0,ow-1],[0,0,1]],8:[[0,1,0],[-1,0,ow-1],[0,0,1]]}
    orientation_matrix=np.array(orientations.get(orientation,orientations[1]),dtype=float)
    gray=cv2.cvtColor(raw,cv2.COLOR_BGR2GRAY)
    edges=cv2.Canny(gray,30,100)
    contours,_=cv2.findContours(edges,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    candidates=[]
    for contour in contours:
        area=cv2.contourArea(contour)
        if area<w*h*.25:continue
        poly=cv2.approxPolyDP(contour,.02*cv2.arcLength(contour,True),True)
        if len(poly)==4 and cv2.isContourConvex(poly):
            outline=np.zeros_like(edges);cv2.polylines(outline,[poly],True,255,3)
            support=float(np.count_nonzero((outline>0)&(cv2.dilate(edges,np.ones((3,3),dtype='uint8'))>0))/max(1,np.count_nonzero(outline)))
            solidity=area/max(1,cv2.contourArea(cv2.convexHull(contour)))
            candidates.append((area/(w*h)*solidity*support,poly))
    matrix=np.eye(3);quad=None;corrected=raw;warnings=[]
    if candidates:
        pts=max(candidates,key=lambda c:c[0])[1].reshape(4,2).astype('float32')
        sums=pts.sum(axis=1);diff=np.diff(pts,axis=1).ravel()
        pts=np.array([pts[sums.argmin()],pts[diff.argmin()],pts[sums.argmax()],pts[diff.argmax()]],dtype='float32')
        rw=max(2,round(max(np.linalg.norm(pts[1]-pts[0]),np.linalg.norm(pts[2]-pts[3]))))
        rh=max(2,round(max(np.linalg.norm(pts[3]-pts[0]),np.linalg.norm(pts[2]-pts[1]))))
        matrix=cv2.getPerspectiveTransform(pts,np.array([[0,0],[rw-1,0],[rw-1,rh-1],[0,rh-1]],dtype='float32'))
        corrected=cv2.warpPerspective(raw,matrix,(rw,rh));quad=pts.tolist()
    else:warnings.append('No reliable paper contour was detected; image alignment needs review.')
    rh,rw=corrected.shape[:2]
    gray=cv2.cvtColor(corrected,cv2.COLOR_BGR2GRAY)
    background=cv2.GaussianBlur(gray,(0,0),max(9,rw/40))
    normalized=cv2.divide(gray,background,scale=255)
    block=max(15,(round(rw/20)//2)*2+1)
    ink=cv2.adaptiveThreshold(normalized,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,block,12)
    # Horizontal grouping joins letters/words without joining adjacent rows.
    kernel=cv2.getStructuringElement(cv2.MORPH_RECT,(max(7,round(rw*.014)),max(1,round(rh*.001))))
    grouped=cv2.morphologyEx(ink,cv2.MORPH_CLOSE,kernel)
    contours,_=cv2.findContours(grouped,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    boxes=[]
    for contour in contours:
        x,y,bw,bh=cv2.boundingRect(contour)
        if bw<rw*.012 or bh<4 or bw*bh<rw*rh*.000025:continue
        if bh>rh*.25 or bw>rw*.995:continue
        kind='separator' if bw>rw*.6 and bh<max(8,rh*.008) else 'text_line'
        # Vertical-bar density distinguishes a barcode candidate from text.
        section=ink[y:y+bh,x:x+bw]
        if bh>rh*.035 and bw>rw*.25 and np.mean(np.max(section,axis=0)>0)>.55:kind='barcode_candidate'
        boxes.append((x,y,bw,bh,kind))
    # Merge fragments with the same baseline; retain the large price-column gap.
    rows=[];special=[]
    for box in sorted(boxes,key=lambda b:(b[1],b[0])):
        if box[4]!='text_line':special.append(box);continue
        x,y,bw,bh,_=box
        row=next((row for row in rows if abs((y+bh/2)-(row[0][1]+row[0][3]/2))<max(5,min(bh,row[0][3])*.5)),None)
        if row is None:rows.append([box])
        else:row.append(box)
    boxes=special
    for row in rows:
        row.sort(key=lambda b:b[0]);groups=[[]]
        for box in row:
            if groups[-1] and box[0]-(groups[-1][-1][0]+groups[-1][-1][2])>rw*.14:groups.append([])
            groups[-1].append(box)
        for group in groups:
            x=min(b[0] for b in group);y=min(b[1] for b in group)
            right=max(b[0]+b[2] for b in group);bottom=max(b[1]+b[3] for b in group)
            boxes.append((x,y,right-x,bottom-y,'item_row_candidate' if len(groups)>1 else 'text_line'))
    boxes.sort(key=lambda b:(b[1],b[0]))
    scale=min(1,1600/max(rw,rh));pw=max(1,round(rw*scale));ph=max(1,round(rh*scale))
    preview_matrix=np.diag([pw/rw,ph/rh,1.])
    source_to_preview=preview_matrix@matrix@orientation_matrix
    fields=parse_transcript(transcript);values=field_values(fields)
    regions=[]
    for i,(x,y,bw,bh,kind) in enumerate(boxes):
        regions.append(dict(id=f'region-{i+1}',kind=kind,field=f'{kind}_{i+1}',
            bbox=[round(x*pw/rw),round(y*ph/rh),max(1,round(bw*pw/rw)),max(1,round(bh*ph/rh))],
            coordinate_space='preview',geometry_quality='detected',ink_coverage=round(float(np.count_nonzero(ink[y:y+bh,x:x+bw]))/(bw*bh),3),requires_review=True,
            displayed_value=None,value_source='preserved_transcript',semantic_source='unassigned'))
    inverse=np.linalg.inv(source_to_preview)
    for region in regions:
        x,y,bw,bh=region['bbox']
        region['original_polygon']=cv2.perspectiveTransform(np.array([[[x,y],[x+bw,y],[x+bw,y+bh],[x,y+bh]]],dtype='float32'),inverse)[0].tolist()
    associations=[]
    # Only an exact server-recognized fixture may provide semantic layout metadata.
    for key,value in values.items():
        ids=[]
        if template:
            for expected in [f['bbox'] for f in template['fields'] if f['field']==key]:
                x,y,bw,bh=expected
                poly=cv2.perspectiveTransform(np.array([[[x,y],[x+bw,y+bh]]],dtype='float32'),source_to_preview)[0]
                left,top=poly.min(axis=0);right,bottom=poly.max(axis=0)
                for region in regions:
                    bx,by,bww,bhh=region['bbox']
                    overlap=max(0,min(right,bx+bww)-max(left,bx))*max(0,min(bottom,by+bhh)-max(top,by))
                    if overlap/max(1,bww*bhh)>.25:
                        ids.append(region['id'])
                        region.setdefault('fields',[]).append(key)
                        if region['semantic_source']=='unassigned':region.update(field=key,displayed_value=value)
                        region.update(semantic_source='fixture_template',requires_review=value is None and key!='barcode')
        associations.append(dict(field=key,region_ids=list(dict.fromkeys(ids)),displayed_value=value,
            value_source='preserved_transcript',semantic_source='fixture_template' if ids else 'unassigned',
            requires_review=not ids or (value is None and key!='barcode')))
    clean=cv2.resize(corrected,(pw,ph)) if (pw,ph)!=(rw,rh) else corrected.copy()
    marked=clean.copy()
    for i,region in enumerate(regions):
        x,y,bw,bh=region['bbox'];cv2.rectangle(marked,(x,y),(x+bw,y+bh),(219,91,36),2)
        cv2.putText(marked,str(i+1),(x,max(15,y-4)),cv2.FONT_HERSHEY_SIMPLEX,.45,(219,91,36),1)
    def encoded(image):
        ok,buffer=cv2.imencode('.png',image)
        if not ok:raise ValueError('The receipt preview could not be produced.')
        return base64.b64encode(buffer.tobytes()).decode(),hashlib.sha256(buffer.tobytes()).hexdigest()
    clean64,clean_hash=encoded(clean);marked64,marked_hash=encoded(marked)
    warnings.append('OpenCV detects visual regions. Values come from the preserved transcript; this is not OCR or payment proof.')
    return dict(scan_id=uid('scan'),manifest_version=2,input_sha256=hashlib.sha256(content).hexdigest(),
        engine=dict(name='opencv',version=cv2.__version__),status='ANNOTATED' if regions else 'NEEDS_REVIEW',
        image_width=pw,image_height=ph,regions=regions,field_associations=associations,fields=fields,
        warnings=warnings,at=now(),preview_mime='image/png',preview_base64=marked64,clean_preview_base64=clean64,
        derivatives=dict(clean_sha256=clean_hash,annotated_sha256=marked_hash,width=pw,height=ph),
        geometry=dict(original_dimensions=[ow,oh],oriented_dimensions=[w,h],rectified_dimensions=[rw,rh],preview_dimensions=[pw,ph],
            exif_orientation=orientation,paper_quadrilateral=quad,orientation_transform=orientation_matrix.tolist(),
            perspective_transform=matrix.tolist(),preview_transform=preview_matrix.tolist(),
            original_to_preview=source_to_preview.tolist(),preview_to_original=np.linalg.inv(source_to_preview).tolist()),
        processing=['decode','exif_orientation','grayscale','normalize','threshold','paper_contour','perspective_correction','region_detection'])
