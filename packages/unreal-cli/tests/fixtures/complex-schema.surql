-- ------------------------------
-- Complex Schema Test Fixture
-- Tests: relations, nested objects, arrays, computed fields, search indexes
-- ------------------------------

OPTION IMPORT;

-- ------------------------------
-- ANALYZERS
-- ------------------------------

DEFINE ANALYZER text_analyzer TOKENIZERS CLASS FILTERS LOWERCASE,ASCII,NGRAM(1,5);

-- ------------------------------
-- TABLE: conversation (relation: user -> post)
-- ------------------------------

DEFINE TABLE conversation TYPE RELATION IN user OUT post SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD createdAt ON conversation TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD in ON conversation TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD participants ON conversation TYPE array<record<user>> DEFAULT [] PERMISSIONS FULL;
DEFINE FIELD participants[*] ON conversation TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD out ON conversation TYPE record<post> PERMISSIONS FULL;
DEFINE FIELD updatedAt ON conversation TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

-- ------------------------------
-- TABLE: message (relation: user -> conversation)
-- ------------------------------

DEFINE TABLE message TYPE RELATION IN user OUT conversation SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD content ON message TYPE string PERMISSIONS FULL;
DEFINE FIELD createdAt ON message TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD in ON message TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD out ON message TYPE record<conversation> PERMISSIONS FULL;
DEFINE FIELD updatedAt ON message TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

-- ------------------------------
-- TABLE: category (normal table with computed fields)
-- ------------------------------

DEFINE TABLE category TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD activePostCount ON category TYPE any VALUE count((SELECT id FROM post WHERE out = $parent.id AND status = 'ACTIVE')) PERMISSIONS FULL;
DEFINE FIELD createdAt ON category TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD description ON category TYPE string PERMISSIONS FULL;
DEFINE FIELD icon ON category TYPE string PERMISSIONS FULL;
DEFINE FIELD productCount ON category TYPE any VALUE count((SELECT id FROM product WHERE category = $parent.id)) PERMISSIONS FULL;
DEFINE FIELD maxItemsPerTransaction ON category TYPE int DEFAULT 4 PERMISSIONS FULL;
DEFINE FIELD itemLimit ON category TYPE option<int> PERMISSIONS FULL;
DEFINE FIELD name ON category TYPE string PERMISSIONS FULL;
DEFINE FIELD updatedAt ON category TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX category_description ON category FIELDS description SEARCH ANALYZER text_analyzer BM25(1.2,0.75) DOC_IDS_ORDER 100 DOC_LENGTHS_ORDER 100 POSTINGS_ORDER 100 TERMS_ORDER 100 DOC_IDS_CACHE 100 DOC_LENGTHS_CACHE 100 POSTINGS_CACHE 100 TERMS_CACHE 100 HIGHLIGHTS;
DEFINE INDEX category_name ON category FIELDS name SEARCH ANALYZER text_analyzer BM25(1.2,0.75) DOC_IDS_ORDER 100 DOC_LENGTHS_ORDER 100 POSTINGS_ORDER 100 TERMS_ORDER 100 DOC_IDS_CACHE 100 DOC_LENGTHS_CACHE 100 POSTINGS_CACHE 100 TERMS_CACHE 100 HIGHLIGHTS;

-- ------------------------------
-- TABLE: product (normal table with variants array)
-- ------------------------------

DEFINE TABLE product TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD `value` ON product TYPE option<int> PERMISSIONS FULL;
DEFINE FIELD type ON product TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD createdAt ON product TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD description ON product TYPE string PERMISSIONS FULL;
DEFINE FIELD category ON product TYPE record<category> PERMISSIONS FULL;
DEFINE FIELD icon ON product TYPE string PERMISSIONS FULL;
DEFINE FIELD name ON product TYPE string PERMISSIONS FULL;
DEFINE FIELD tier ON product TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD quantity ON product TYPE int DEFAULT 5 PERMISSIONS FULL;
DEFINE FIELD available ON product TYPE option<bool> PERMISSIONS FULL;
DEFINE FIELD tags ON product TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD updatedAt ON product TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD variants ON product TYPE array<object> PERMISSIONS FULL;
DEFINE FIELD variants[*] ON product TYPE object PERMISSIONS FULL;
DEFINE FIELD variants[*].description ON product TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD variants[*].name ON product TYPE string PERMISSIONS FULL;
DEFINE FIELD variants[*].properties ON product TYPE option<object> PERMISSIONS FULL;

DEFINE INDEX idx_product_category ON product FIELDS category;
DEFINE INDEX product_description ON product FIELDS description SEARCH ANALYZER text_analyzer BM25(1.2,0.75) DOC_IDS_ORDER 100 DOC_LENGTHS_ORDER 100 POSTINGS_ORDER 100 TERMS_ORDER 100 DOC_IDS_CACHE 100 DOC_LENGTHS_CACHE 100 POSTINGS_CACHE 100 TERMS_CACHE 100 HIGHLIGHTS;
DEFINE INDEX product_name ON product FIELDS name SEARCH ANALYZER text_analyzer BM25(1.2,0.75) DOC_IDS_ORDER 100 DOC_LENGTHS_ORDER 100 POSTINGS_ORDER 100 TERMS_ORDER 100 DOC_IDS_CACHE 100 DOC_LENGTHS_CACHE 100 POSTINGS_CACHE 100 TERMS_CACHE 100 HIGHLIGHTS;

-- ------------------------------
-- TABLE: post (relation: user -> category, with nested objects)
-- ------------------------------

DEFINE TABLE post TYPE RELATION IN user OUT category SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD acceptedOffer ON post TYPE option<record<offer>> PERMISSIONS FULL;
DEFINE FIELD createdAt ON post TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD in ON post TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD offerCount ON post TYPE any VALUE count(<-offer) PERMISSIONS FULL;
DEFINE FIELD provided ON post TYPE object PERMISSIONS FULL;
DEFINE FIELD provided.items ON post TYPE array<object> PERMISSIONS FULL;
DEFINE FIELD provided.items[*] ON post TYPE object PERMISSIONS FULL;
DEFINE FIELD provided.items[*].product ON post TYPE record<product> PERMISSIONS FULL;
DEFINE FIELD provided.items[*].quantity ON post TYPE int PERMISSIONS FULL;
DEFINE FIELD provided.items[*].variant ON post TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD out ON post TYPE record<category> PERMISSIONS FULL;
DEFINE FIELD requested ON post TYPE object PERMISSIONS FULL;
DEFINE FIELD requested.allowOffers ON post TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD requested.items ON post TYPE array<object> PERMISSIONS FULL;
DEFINE FIELD requested.items[*] ON post TYPE object PERMISSIONS FULL;
DEFINE FIELD requested.items[*].product ON post TYPE record<product> PERMISSIONS FULL;
DEFINE FIELD requested.items[*].quantity ON post TYPE int PERMISSIONS FULL;
DEFINE FIELD requested.items[*].variant ON post TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD status ON post TYPE 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' DEFAULT ACTIVE PERMISSIONS FULL;
DEFINE FIELD totalOffers ON post TYPE any VALUE <future> { count(<-offer) } PERMISSIONS FULL;
DEFINE FIELD updatedAt ON post TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX idx_post_out_status ON post FIELDS out, status;
DEFINE INDEX idx_post_status ON post FIELDS status;
DEFINE INDEX idx_post_status_out ON post FIELDS status, out;

-- ------------------------------
-- TABLE: offer (relation: user -> post, with nested objects)
-- ------------------------------

DEFINE TABLE offer TYPE RELATION IN user OUT post SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD createdAt ON offer TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD in ON offer TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD provided ON offer TYPE object PERMISSIONS FULL;
DEFINE FIELD provided.items ON offer TYPE array<object> PERMISSIONS FULL;
DEFINE FIELD provided.items[*] ON offer TYPE object PERMISSIONS FULL;
DEFINE FIELD provided.items[*].product ON offer TYPE record<product> PERMISSIONS FULL;
DEFINE FIELD provided.items[*].quantity ON offer TYPE int PERMISSIONS FULL;
DEFINE FIELD provided.items[*].variant ON offer TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD out ON offer TYPE record<post> PERMISSIONS FULL;
DEFINE FIELD requested ON offer TYPE object PERMISSIONS FULL;
DEFINE FIELD requested.allowOffers ON offer TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD requested.items ON offer TYPE array<object> PERMISSIONS FULL;
DEFINE FIELD requested.items[*] ON offer TYPE object PERMISSIONS FULL;
DEFINE FIELD requested.items[*].product ON offer TYPE record<product> PERMISSIONS FULL;
DEFINE FIELD requested.items[*].quantity ON offer TYPE int PERMISSIONS FULL;
DEFINE FIELD requested.items[*].variant ON offer TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD updatedAt ON offer TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

-- ------------------------------
-- TABLE: user (normal table with computed ratings)
-- ------------------------------

DEFINE TABLE user TYPE NORMAL SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD avatar ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD createdAt ON user TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD ratingAverage ON user TYPE any VALUE math::fixed(math::mean(<-review.rating), 1) PERMISSIONS FULL;
DEFINE FIELD ratingCount ON user TYPE any VALUE count(<-review) PERMISSIONS FULL;
DEFINE FIELD roles ON user TYPE array<string> PERMISSIONS FULL;
DEFINE FIELD roles[*] ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD updatedAt ON user TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD username ON user TYPE string PERMISSIONS FULL;

-- ------------------------------
-- TABLE: inventory (relation: user -> product)
-- ------------------------------

DEFINE TABLE inventory TYPE RELATION IN user OUT product SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD createdAt ON inventory TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD in ON inventory TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD out ON inventory TYPE record<product> PERMISSIONS FULL;
DEFINE FIELD quantity ON inventory TYPE int PERMISSIONS FULL;
DEFINE FIELD updatedAt ON inventory TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD variant ON inventory TYPE option<string> PERMISSIONS FULL;

-- ------------------------------
-- TABLE: review (relation: user -> user, with post reference)
-- ------------------------------

DEFINE TABLE review TYPE RELATION IN user SCHEMAFULL PERMISSIONS NONE;

DEFINE FIELD content ON review TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD createdAt ON review TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD in ON review TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD post ON review TYPE record<post> PERMISSIONS FULL;
DEFINE FIELD out ON review TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD rating ON review TYPE int PERMISSIONS FULL;
DEFINE FIELD updatedAt ON review TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
