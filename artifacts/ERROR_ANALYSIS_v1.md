# First-run exploratory model error analysis

69 incorrect predictions from 469 pairs. Labels are agent-authored, not independently reviewed.

No test-driven retraining or relabelling was performed. The scores remain visible. Runtime treats model labels as advisory; source authority remains deterministic.

- fiction-7-0-0-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment deya passage e final failed result ache. BDT 250. Reference P-700.
- fiction-7-0-1-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment deya passage e final successful result ache. BDT 500. Reference P-701.
- fiction-7-0-1-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment deya passage e final failed result ache. BDT 500. Reference P-701.
- fiction-7-0-2-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment deya passage e final successful result ache. BDT 1200. Reference P-702.
- fiction-7-0-2-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment deya passage e final failed result ache. BDT 1200. Reference P-702.
- fiction-7-1-0-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive deya passage e final successful result ache. BDT 250. Reference P-710.
- fiction-7-1-0-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive deya passage e final failed result ache. BDT 250. Reference P-710.
- fiction-7-1-1-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive deya passage e final successful result ache. BDT 500. Reference P-711.
- fiction-7-1-1-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive deya passage e final failed result ache. BDT 500. Reference P-711.
- fiction-7-1-2-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive deya passage e final successful result ache. BDT 1200. Reference P-712.
- fiction-7-1-2-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive deya passage e final failed result ache. BDT 1200. Reference P-712.
- fiction-7-2-1-0 (bn): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: টাকা ফেরত দেওয়া হয়েছে। Passage: টাকা ফেরত দেওয়া লেখায় চূড়ান্ত সফল ফল আছে। BDT 500. Reference P-721.
- fiction-7-2-1-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Repayment complete hoyeche. Passage: Repayment ferot deya passage e final successful result ache. BDT 500. Reference P-721.
- fiction-7-2-1-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Repayment complete hoyeche. Passage: Repayment ferot deya passage e final failed result ache. BDT 500. Reference P-721.
- fiction-7-2-2-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Repayment complete hoyeche. Passage: Repayment ferot deya passage e final failed result ache. BDT 1200. Reference P-722.
- fiction-8-0-0-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment ekhane hoyeche ar acknowledge kora ache. BDT 250. Reference P-800.
- fiction-8-0-0-1 (en): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: The QR payment completed. Passage: The QR payment was explicitly denied here. BDT 250. Reference P-800.
- fiction-8-0-0-1 (bn): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR পেমেন্ট সম্পন্ন হয়েছে। Passage: QR পেমেন্ট এখানে স্পষ্ট অস্বীকার করা হয়েছে। BDT 250. Reference P-800.
- fiction-8-0-0-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment ekhane explicitly denied. BDT 250. Reference P-800.
- fiction-8-0-1-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment ekhane hoyeche ar acknowledge kora ache. BDT 500. Reference P-801.
- fiction-8-0-1-1 (bn): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR পেমেন্ট সম্পন্ন হয়েছে। Passage: QR পেমেন্ট এখানে স্পষ্ট অস্বীকার করা হয়েছে। BDT 500. Reference P-801.
- fiction-8-0-1-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment ekhane explicitly denied. BDT 500. Reference P-801.
- fiction-8-0-2-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment ekhane hoyeche ar acknowledge kora ache. BDT 1200. Reference P-802.
- fiction-8-0-2-1 (en): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: The QR payment completed. Passage: The QR payment was explicitly denied here. BDT 1200. Reference P-802.
- fiction-8-0-2-1 (bn): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR পেমেন্ট সম্পন্ন হয়েছে। Passage: QR পেমেন্ট এখানে স্পষ্ট অস্বীকার করা হয়েছে। BDT 1200. Reference P-802.
- fiction-8-0-2-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: QR payment complete hoyeche. Passage: QR payment ekhane explicitly denied. BDT 1200. Reference P-802.
- fiction-8-1-0-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive ekhane hoyeche ar acknowledge kora ache. BDT 250. Reference P-810.
- fiction-8-1-0-1 (bn): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: নগদ টাকা গ্রহণ করা হয়েছে। Passage: নগদ টাকা গ্রহণ এখানে স্পষ্ট অস্বীকার করা হয়েছে। BDT 250. Reference P-810.
- fiction-8-1-0-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive ekhane explicitly denied. BDT 250. Reference P-810.
- fiction-8-1-1-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive ekhane hoyeche ar acknowledge kora ache. BDT 500. Reference P-811.
- fiction-8-1-1-1 (bn): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: নগদ টাকা গ্রহণ করা হয়েছে। Passage: নগদ টাকা গ্রহণ এখানে স্পষ্ট অস্বীকার করা হয়েছে। BDT 500. Reference P-811.
- fiction-8-1-1-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive ekhane explicitly denied. BDT 500. Reference P-811.
- fiction-8-1-2-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive ekhane hoyeche ar acknowledge kora ache. BDT 1200. Reference P-812.
- fiction-8-1-2-1 (bn): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: নগদ টাকা গ্রহণ করা হয়েছে। Passage: নগদ টাকা গ্রহণ এখানে স্পষ্ট অস্বীকার করা হয়েছে। BDT 1200. Reference P-812.
- fiction-8-1-2-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Cash payment received hoyeche. Passage: Cash payment receive ekhane explicitly denied. BDT 1200. Reference P-812.
- fiction-8-2-0-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Repayment complete hoyeche. Passage: Repayment ferot ekhane hoyeche ar acknowledge kora ache. BDT 250. Reference P-820.
- fiction-8-2-0-1 (en): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Repayment completed. Passage: Repayment was explicitly denied here. BDT 250. Reference P-820.
- fiction-8-2-0-1 (bn): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: টাকা ফেরত দেওয়া হয়েছে। Passage: টাকা ফেরত এখানে স্পষ্ট অস্বীকার করা হয়েছে। BDT 250. Reference P-820.
- fiction-8-2-0-1 (banglish): expected CONTRADICTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Repayment complete hoyeche. Passage: Repayment ferot ekhane explicitly denied. BDT 250. Reference P-820.
- fiction-8-2-1-0 (banglish): expected SUPPORTED_BY_PASSAGE, predicted INSUFFICIENT_EVIDENCE. Claim: Repayment complete hoyeche. Passage: Repayment ferot ekhane hoyeche ar acknowledge kora ache. BDT 500. Reference P-821.