// Generated from `frontend-web/features/faq/faq-data.ts`.
//
// The web page renders only three audience tabs and silently drops its 22
// aggregator entries; this app has an aggregator portal, so all four are
// listed here.

enum FaqAudience { general, artists, aggregators, buyers }

const faqAudienceLabel = <FaqAudience, String>{
  FaqAudience.general: 'General',
  FaqAudience.artists: 'Artists',
  FaqAudience.aggregators: 'Aggregators',
  FaqAudience.buyers: 'Buyers',
};

class FaqItem {
  const FaqItem({
    required this.audience,
    required this.question,
    required this.answer,
  });

  final FaqAudience audience;
  final String question;
  final String answer;
}

const faqItems = <FaqItem>[
  FaqItem(
    audience: FaqAudience.general,
    question: 'What is GalleryZone?',
    answer: 'GalleryZone is a verified marketplace for original artwork. It connects independent artists directly with collectors through an online marketplace, and with curated gallery partners, called aggregators, who can display and sell work in person.',
  ),
  FaqItem(
    audience: FaqAudience.general,
    question: 'How is pricing kept private?',
    answer: 'Every artist sets a private listed price that is never shown to buyers or the public. The marketplace price shown everywhere else already includes GalleryZone\'s markup, so an artist\'s confidential price and market value stay protected across every channel.',
  ),
  FaqItem(
    audience: FaqAudience.general,
    question: 'What does the Verified badge mean?',
    answer: 'Artist verification has three tiers: an official social or portfolio link, the signed GalleryZone artist agreement, and a first confirmed sale. Clearing all three unlocks the Gold ✦ Verified badge, shown on the artist\'s public profile and listings.',
  ),
  FaqItem(
    audience: FaqAudience.general,
    question: 'Is there a fee to list artwork?',
    answer: 'No. Listing is free, with a 0% confirmation fee when artwork is accepted. GalleryZone earns its margin from the markup on the customer-facing price, never from a submission or listing fee.',
  ),
  FaqItem(
    audience: FaqAudience.general,
    question: 'How do I know an artwork is genuine?',
    answer: 'Every artwork is linked to a Certificate of Authenticity and a signed origin declaration, plus a physical QR tag that resolves to its digital passport, showing ownership history for the artwork\'s life cycle.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'What is GalleryZone?',
    answer: 'GalleryZone is a verified art marketplace designed to connect independent artists, aggregators/distributors, and buyers through a structured platform with defined artwork, ownership, and financial procedures.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'How can I list my artwork?',
    answer: 'Create your artist profile, accept the applicable artist guidelines, and submit the required artwork information, including the title, medium, dimensions, year, description, authenticity information, condition details, photographs, and your private listed price.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Who can see my artist price?',
    answer: 'Your listed artist price is confidential. It is not displayed to customers, aggregators, or publicly on the marketplace. Aggregators see GalleryZone\'s offer and their permitted selling-price and incentive breakdown instead.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'How is the customer selling price calculated?',
    answer: 'GalleryZone first adds the 30% platform markup, then includes the applicable 5% artwork GST in the displayed price. For example, an artist price of ₹10,000 becomes ₹13,000 before GST and ₹13,650 including GST. Any payment-gateway fee and delivery charge appear separately at checkout.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'How much will I receive when my artwork sells?',
    answer: 'For a marketplace sale, GalleryZone does not deduct its own platform margin from the artist price; only applicable statutory or agreed pass-through deductions may apply. Aggregator-channel settlements can also include the disclosed delivery, convenience, technology, tax, and actual third-party charges allowed by the Artist MOU.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Is there an acceptance or confirmation fee?',
    answer: 'No. There is no fee for listing an artwork. We are currently working on a subscription-based model.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'What happens if my artwork is not sold within 30 days?',
    answer: 'GalleryZone may extend the placement, move the artwork to another approved aggregator, change the sales strategy, or arrange its return. When the configured monthly price ladder applies, the next GalleryZone offer decreases by 2% of the artist price per step; the artist\'s confidential listed price is not reduced.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Can I list the same artwork elsewhere while it is active?',
    answer: 'No. Once an artwork is accepted and active on the platform, it may not be listed or sold through another channel during the active period. If the artwork is promoted or sold through Instagram, you must provide the GalleryZone website link for the artwork.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'How does artist verification work?',
    answer: 'The three current tiers are: an official social or portfolio link, acceptance of the current Artist MOU, and one confirmed GalleryZone sale. A subscription is optional and is not a verification requirement.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'How can I demonstrate authenticity?',
    answer: 'Artists can provide authenticity statements, Certificate of Authenticity (COA) details, and social-proof links showing studio processes, materials, work-in-progress, or signature details. Social-proof content must not display or mention the price or monetary valuation of the artwork.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'When is my settlement paid?',
    answer: 'An eligible artist settlement is released after successful delivery and the configured seven-day payout window, subject to returns, reversals, lawful deductions, and the transaction\'s settlement status.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'What rights do I retain after selling my artwork?',
    answer: 'The buyer receives ownership of the physical original and may possess, display, use, and resell it. The artist retains copyright, moral rights, and permitted commercial rights for distinguishable prints, merchandise, publications, licensing, and derivative formats, but may not recreate an identical physical original.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Do I need to ship my artwork immediately after listing?',
    answer: 'The artwork is first submitted and reviewed. Once it is accepted and the required procedures and item arrangements are completed, it may be made available for aggregator collection and sale.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'How many photographs can I upload?',
    answer: 'Up to 8 photographs can be provided, including cover, detail, signature, and scale-reference photographs.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'What information is required for an artwork listing?',
    answer: 'The following information is required: title, medium, dimensions, year of creation, description, authenticity statement, warranty/material information, photographs, private artist price, and logistics information.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Can I mention the artwork price in my description?',
    answer: 'No. The artwork description must not contain the price, valuation, or any other monetary figures.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Can I change my artist price after listing?',
    answer: 'The current procedures state that the artist price remains fixed once the artwork is listed. Any related edits are valid only for 7 days.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Can I withdraw an artwork after it has been accepted?',
    answer: 'You may request withdrawal, but it can be deferred while an aggregator placement, exhibition, buyer transaction, or logistics commitment is active. GalleryZone must communicate any reasonable, actually incurred withdrawal cost before processing wherever practicable; there is no automatic fixed 1% penalty in the current MOU.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'What happens if my artwork is damaged during transit?',
    answer: 'Loss or damage is reviewed against the condition records, packaging, custody history and delivery records. The reasonable repair cost or substantiated loss is allocated to the party whose negligence, breach or failure to follow the agreed handling requirements caused it, as set out in the Artist MOU (Clause 10).',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'Can I use social media to promote my artwork?',
    answer: 'Yes. Social media proof can be linked to the artwork to demonstrate the creation process and strengthen authenticity. However, the linked content must not mention or display the price or valuation of the artwork. Any sale through social media should be converted through the GalleryZone platform by providing the website link to the respective artwork.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'What happens when I make my first sale?',
    answer: 'A confirmed sale contributes to your artist verification progress and is one of the three requirements for achieving full verified status.',
  ),
  FaqItem(
    audience: FaqAudience.artists,
    question: 'What is the Certificate of Authenticity?',
    answer: 'The artist completes the digital Certificate of Authenticity through GalleryZone before shipment. GalleryZone keeps it with the artwork\'s provenance record, and the artist can print, sign, and dispatch a physical COA when a collector requests one.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What is an aggregator?',
    answer: 'An aggregator is a display and sales partner. Aggregators take physical possession of selected artworks, display them in their gallery or approved space, and work to find buyers. They do not become the legal owners of the artworks.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'How do I add an artwork to my collection?',
    answer: 'Browse the available artworks, review the pricing breakdown, pay the 5% advance plus delivery charges based on the customer selling price, and confirm the collection. The artwork is then dispatched to your gallery or approved display location.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What is the aggregator advance?',
    answer: 'Before taking possession, the aggregator pays the configured security deposit plus delivery. The first two placement months use 5%; later configured placements use 3%. The reservation screen shows the exact basis and amount before Razorpay opens.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Is the 5% advance refundable?',
    answer: 'The security deposit is refundable or adjustable after a successful sale or after an unsold artwork is returned in the required condition, subject to permitted deductions. Delivery and handling charges for an unsold artwork are normally non-refundable.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'How long do I have to sell an artwork?',
    answer: 'An artwork is normally held for a maximum of 30 days in an aggregator\'s collection.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What happens after 30 days?',
    answer: 'GalleryZone may approve an extension, move the artwork to another aggregator, change the sales strategy, or arrange return. Under the current configured ladder, later GalleryZone offers step down by 2% of the artist price, not 10%, while the artist price remains unchanged.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'How does the aggregator incentive work?',
    answer: 'The incentive is a percentage of the pre-GST markup pool. The current month\'s rate is based on the immediately previous calendar month\'s eligible pre-GST sales: 20% up to ₹10 lakh, 35% above ₹10 lakh through ₹50 lakh, and 50% above ₹50 lakh. With no eligible previous-month sales, the 20% tier applies.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Can I negotiate or discount the customer price?',
    answer: 'The customer selling price is set by the platform. An aggregator cannot independently discount it. Any price below the established customer price requires prior approval from the platform.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Can I disclose the artist\'s private price?',
    answer: 'No. The artist price is confidential and must not be disclosed to customers or third parties.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Who owns an artwork while it is in my gallery?',
    answer: 'The artist retains legal ownership while the artwork is in the aggregator\'s custody. Title transfers to the buyer only after full payment and successful delivery are confirmed. Neither GalleryZone nor the aggregator becomes the owner merely by holding or displaying it.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What should I do when I find a buyer?',
    answer: 'Record the sale immediately through the Aggregator Portal, including the final sold price and the required buyer information. The confirmed sale triggers the settlement, rights-transfer, and incentive processes.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Who pays delivery charges?',
    answer: 'The customer pays the delivery charges separately. The platform coordinates delivery through third-party logistics providers.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What are my responsibilities while holding the artwork?',
    answer: 'The aggregator must protect and properly handle the artwork, prepare it for pickup after the sale, and follow the platform\'s logistics process while the artwork is in their possession.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Can I sell or transfer the artwork outside the platform?',
    answer: 'No. The aggregator may not sell, pledge, or transfer the artwork outside the platform\'s approved process.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Can I choose which artworks I want to display?',
    answer: 'The Aggregator Portal allows you to browse available artworks and select artworks for your collection, subject to the platform\'s procedures.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What happens if an artwork is damaged while in my possession?',
    answer: 'Loss, theft or damage while an artwork is in an aggregator\'s custody is investigated under the condition-audit process in the Aggregator MOU (Clause 7). No party is held responsible just because an incident happened in its possession: responsibility is decided from the condition reports, photographs, packaging and handover records, and the party found responsible pays the documented repair or loss amount.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Can I hand the artwork directly to the customer?',
    answer: 'Yes. You can hand the artwork directly to the customer in the respective art box by recording the sale and selecting the "Self-Picked" option at the time of recording the sale.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Who arranges delivery after I make a sale?',
    answer: 'The platform manages delivery bookings through third-party logistics providers. The aggregator must ensure that the artwork is properly packaged and ready for pickup.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Why must I record the sale immediately?',
    answer: 'A confirmed sale triggers the artist settlement, aggregator incentive, rights-transfer process, and platform margin booking.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What information must I collect from a buyer?',
    answer: 'The sale record requires the following information: final sold price, buyer\'s full name, email address, phone number, complete delivery address, and any relevant notes.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'What information can I see before selecting an artwork?',
    answer: 'The Aggregator Portal provides GalleryZone\'s current offer, the permitted listed selling price, the security-deposit and delivery amount, and the applicable incentive working. The artist\'s confidential private price is not disclosed.',
  ),
  FaqItem(
    audience: FaqAudience.aggregators,
    question: 'Can I display the artwork anywhere?',
    answer: 'The artwork\'s display location is recorded in the inventory system as the aggregator\'s gallery or approved display space.',
  ),
  FaqItem(
    audience: FaqAudience.buyers,
    question: 'What rights do I get when I buy a piece?',
    answer: 'Once full payment and delivery are confirmed, you own the physical original and may possess, display, use, and resell that physical artwork. Copyright, reproduction, licensing, and other intellectual-property rights remain with the artist unless a separate written sale term expressly transfers them.',
  ),
  FaqItem(
    audience: FaqAudience.buyers,
    question: 'Does the artist keep any rights after I buy their work?',
    answer: 'Yes. The artist permanently retains moral rights as the original creator, recorded against the piece regardless of who owns it.',
  ),
  FaqItem(
    audience: FaqAudience.buyers,
    question: 'Can I resell art I\'ve bought?',
    answer: 'Registered customers can resell authenticated artwork through GalleryZone, which supports a secondary market with resale royalties rather than a private, unverifiable sale.',
  ),
  FaqItem(
    audience: FaqAudience.buyers,
    question: 'How do I know a piece is authentic before I buy it?',
    answer: 'Every listing links to a Certificate of Authenticity, a signed origin declaration, and the artwork\'s QR passport page, so you can verify its history independently of the listing itself.',
  ),
];
