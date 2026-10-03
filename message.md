Your project has **two connected interfaces: customer and admin/operator**. Both use the same saved transaction and case information.

- **Payment demo:** The customer starts a simulated bank-to-upay transfer; the admin sees it automatically.
- **Complaint reporting:** Customers report stuck transfers or paying twice through cash and QR.
- **One case per incident:** Payments, complaints and updates stay linked, preventing duplicate cases.
- **Customer tracking:** Customers see confirmed payment facts, their case owner and the next update.
- **Admin inbox:** Unresolved payments appear for the admin to open and investigate.
- **Visual payment pipeline:** Connected nodes show processing stages. Completed stages turn green, active stages animate, observed failures turn red and unknown stages stay neutral.
- **Expandable details:** Admins explore retries, missing responses, queues and related processing branches.
- **Evidence inspection:** Clicking a node opens its records, timestamps and source details.
- **AI investigation:** The admin starts AI, which checks relevant records and visibly follows the investigation through the graph.
- **Possible-cause tracking:** AI narrows explanations as evidence arrives, keeping unresolved possibilities visible.
- **Paid-twice evidence checking:** The existing verifier checks whether complaint evidence supports, contradicts or leaves a claim unanswered.
- **Verification boundaries:** Customer statements, uploaded receipts and confirmed financial records remain clearly distinguished.
- **Repair recommendations:** AI proposes a correction; the backend checks whether it is permitted.
- **Admin-approved sandbox repair:** The admin approves an eligible simulated correction. Confirmed results update the graph and customer page.
- **Operator handoff:** When correction is unsupported, the system assigns follow-up and explains what still needs checking.
- **Investigation reports:** Admins export the findings, evidence, attempted actions and remaining problems.
- **Case history:** Checks, decisions, failed attempts and corrections remain saved for review.
- **Access and duplicate protection:** Customers access their own cases; repeated clicks cannot create duplicate payments or corrections.
- **Language support:** Simple Bangla/English customer updates, with multilingual complaint evidence handled by the existing verifier.
- **Presentation controls:** Zoom, expand nodes, follow the investigation, replay saved events and reset isolated demo scenarios.
- **Honest AI modes:** Use live AI when connected, or a clearly labelled demo investigation when unavailable.

**Main journey:** Customer starts payment → it becomes uncertain → admin receives the case → AI investigates → admin approves a supported repair or hands it off → customer receives the verified update.

**Payments and repairs use synthetic money and mock partners in this demo.**