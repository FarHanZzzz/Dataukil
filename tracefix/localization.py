"""Deterministic customer translations of verified facts, never invented outcomes."""

TRANSFER_HEADLINES={
    'CONFLICTING':'যাচাইকৃত লেনদেনের রেকর্ডের অমিল পর্যালোচনা প্রয়োজন।',
    'NEEDS_EVIDENCE':'ট্রান্সফারের চূড়ান্ত তথ্য অসম্পূর্ণ। আরও যাচাই প্রয়োজন।',
    'REPAID':'সিমুলেটেড সংশোধন যাচাই করা হয়েছে।',
    'SUPPORTED':'একই ট্রান্সফারের জন্য ব্যাংকে দুইটি ডেবিট নিশ্চিত হয়েছে।',
    'NOT_SUPPORTED':'ব্যাংক থেকে উপায় ওয়ালেটে একটি নির্ধারিত ট্রান্সফার নিশ্চিত হয়েছে।',
    'NEEDS_REPAIR':'আটকে থাকা ডেবিটের জন্য সিমুলেটেড সংশোধনের অনুমতি যাচাই করা হয়েছে।'
}
LEGACY_HEADLINES={
    'CONFLICTING':'নগদ প্রদানের দাবি ও মার্চেন্টের বক্তব্যের অমিল পর্যালোচনা প্রয়োজন।',
    'NEEDS_EVIDENCE':'একই কেনাকাটায় দুইবার টাকা দেওয়া হয়েছে কি না, তা জানতে আরও প্রমাণ প্রয়োজন।',
    'REPAID':'সিমুলেটেড উৎসে সম্পন্ন ফেরতের রেকর্ড নিশ্চিত হয়েছে।',
    'SUPPORTED':'যাচাইকৃত কেনাকাটার রেকর্ডে নির্ধারিত মোটের চেয়ে বেশি টাকা দেওয়া হয়েছে।',
    'NOT_SUPPORTED':'যাচাইকৃত রেকর্ডে এই কেনাকাটার মোটের চেয়ে বেশি টাকা দেওয়ার প্রমাণ নেই।'
}
REQUIREMENTS={
    'Check the complete bank posting inventory for the exact transaction.':'এই ট্রান্সফারের সব ব্যাংক ডেবিটের রেকর্ড যাচাই করতে হবে।',
    'Obtain the final wallet outcome for the exact transaction.':'এই ট্রান্সফারের চূড়ান্ত ওয়ালেট ফলাফল সংগ্রহ করতে হবে।',
    'Obtain the final partner response and settlement record.':'পার্টনারের চূড়ান্ত রেসপন্স ও সেটেলমেন্টের রেকর্ড সংগ্রহ করতে হবে।',
    'Confirm the exact QR reference under the simulated payment source.':'সিমুলেটেড পেমেন্ট উৎসে নির্দিষ্ট QR রেফারেন্স যাচাই করতে হবে।',
    'Obtain a merchant acknowledgement of the alleged cash payment and purchase reference.':'এই কেনাকাটার জন্য নগদ টাকা পাওয়ার মার্চেন্ট নিশ্চিতকরণ সংগ্রহ করতে হবে।',
    'Obtain an invoice identifying this purchase and its total.':'এই কেনাকাটা ও মোট মূল্য উল্লেখ করা ইনভয়েস সংগ্রহ করতে হবে।',
    'Establish whether the second QR reference belongs to the same purchase.':'দ্বিতীয় QR রেফারেন্সটি একই কেনাকাটার কি না যাচাই করতে হবে।',
    'Resolve the conflicting merchant denial with a cited purchase-level record.':'কেনাকাটার নির্দিষ্ট রেকর্ড দিয়ে মার্চেন্টের অস্বীকৃতির অমিল যাচাই করতে হবে।'
}


def verified_headline(c,assessment):
    return (TRANSFER_HEADLINES if c.get('transaction_id') else LEGACY_HEADLINES).get(assessment['status'],'যাচাইকৃত তথ্য পর্যালোচনা করা হয়েছে।')


def confirmed_facts(c,f):
    facts=[]
    amount=lambda n:f'{n/100:,.2f}'
    if c.get('transaction_id'):
        if f['bank_debit_minor']:facts.append(f"ব্যাংকের যাচাইকৃত রেকর্ডে এই ট্রান্সফারের জন্য {amount(f['bank_debit_minor'])} টাকা ডেবিট হয়েছে।")
        if f['wallet_credit_minor']:facts.append(f"ওয়ালেটের যাচাইকৃত রেকর্ডে {amount(f['wallet_credit_minor'])} টাকা জমা হয়েছে।")
        if f['recorded_repaid_minor']:facts.append(f"যাচাইকৃত সিমুলেটেড সংশোধনে {amount(f['recorded_repaid_minor'])} টাকা ফেরত দেওয়া হয়েছে।")
    else:
        if f['qr_confirmed']:facts.append('সিমুলেটেড উৎসে QR পেমেন্ট নিশ্চিত হয়েছে। শুধু এই তথ্য অভিযোগের সমাধান বোঝায় না।')
        if f['cash_confirmed']:facts.append('সিমুলেটেড মার্চেন্ট এই কেনাকাটার নগদ টাকা গ্রহণের রেকর্ড নিশ্চিত করেছে।')
        if f['qr_not_completed']:facts.append('সিমুলেটেড উৎসে নির্দিষ্ট QR পেমেন্ট সম্পন্ন হয়নি বলে নিশ্চিত হয়েছে।')
        if f['recorded_repaid_minor']:facts.append(f"সিমুলেটেড উৎসে {amount(f['recorded_repaid_minor'])} টাকা ফেরতের রেকর্ড নিশ্চিত হয়েছে।")
    return facts
