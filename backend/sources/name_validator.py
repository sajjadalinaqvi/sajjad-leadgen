import re
from typing import Optional, Tuple

# Corporate entity keywords that disqualify a name
CORPORATE_KEYWORDS = {
    "ltd", "limited", "llp", "plc", "inc", "corp", "corporation", "company", "co",
    "group", "holdings", "holding", "services", "service", "management", "investment",
    "investments", "enterprises", "enterprise", "properties", "property", "partners",
    "partnership", "associates", "international", "solutions", "pharmacy", "medical",
    "clinic", "hospital", "center", "centre", "foundation", "trust", "logistics",
    "consulting", "trading", "foods", "food", "auto", "tech", "technologies", "ventures",
    "capital", "industries", "agency", "consultants", "care", "dental", "pharma",
    "halal", "bakery", "restaurant", "sweets", "meat", "catering", "motors", "cars", "car"
}

# Web junk keywords that indicate an article, recipe, or site headline rather than a person
JUNK_KEYWORDS = {
    "definition", "meaning", "wikipedia", "wiki", "how", "what", "why", "where",
    "guide", "tips", "recipe", "recipes", "best", "top", "review", "reviews",
    "overview", "login", "signin", "register", "portal", "directory", "profiles",
    "search", "results", "news", "article", "articles", "video", "videos",
    "download", "free", "online", "support", "help", "contact", "privacy",
    "terms", "rasmalai", "biryani", "food", "kitchen", "stock", "etf", "investopedia",
    "coursera", "udemy", "youtube", "facebook", "twitter", "instagram", "tiktok",
    "curriculum", "syllabus", "course", "degree", "diploma", "salary", "jobs", "careers",
    "history", "today", "yesterday", "tomorrow", "calendar", "events", "event", "date",
    "births", "deaths", "facts", "trivia", "quiz", "century", "daily", "quotes", "quotations", "this"
}

# Known diaspora surnames and prefixes for validation (comprehensive across all regions of Pakistan)
DIASPORA_SURNAME_SET = {
    "khan", "malik", "chaudhry", "chaudhary", "qureshi", "siddiqui", "siddique", "ahmed", "ahmad",
    "shah", "butt", "dar", "baig", "beg", "mirza", "sheikh", "shaikh", "tariq", "iqbal",
    "hussain", "husain", "ali", "babar", "anwar", "farooq", "baqir", "dawood", "sheikha",
    "allana", "shroff", "khalid", "masood", "rao", "sherwani", "akeel", "rahman", "rehman",
    "choudrey", "choudhury", "mussarat", "niazi", "abbasi", "gillani", "gilani", "naqvi", "rizvi",
    "bhatti", "cheema", "tarar", "wattoo", "bajwa", "rana", "kasuri", "durrani", "soomro",
    "zardari", "bhutto", "leghari", "jatoi", "khoso", "mangi", "talpur", "memon", "laghari",
    "mansha", "saigol", "tabba", "monnoo", "lakhani", "habib", "hashwani", "cowasjee", "alnoor",
    "dewan", "bawany", "vohra", "chundrigar", "chandio", "junejo", "magsi", "mengal", "marri",
    "bugti", "rind", "zehri", "bizenjo", "achakzai", "kakar", "yousafzai", "yousufzai", "afridi",
    "khattak", "bangash", "shinwari", "orakzai", "mahsud", "wazir", "burki", "alizai", "sadozai",
    "swati", "tanoli", "jadoon", "tareen", "haroon", "alvi", "arif", "aslam", "ashraf", "azhar",
    "bilal", "ghaffar", "ghafoor", "hameed", "haris", "iftikhar", "jahangir", "javed", "kamran",
    "khurram", "latif", "liaquat", "luqman", "mansoor", "munir", "mushtaq", "nadeem", "noman",
    "pervez", "pervaiz", "rafiq", "saleem", "salman", "shafi", "shahid", "shakeel", "shahzad",
    "sohail", "tahir", "umair", "usman", "waqas", "waseem", "younas", "yousaf", "yousuf", "zafar",
    "zahid", "zia", "zubair", "bukhari", "gardezi", "tiwana", "noon", "khawaja", "paracha", "zaidi"
}

HONORIFICS_REGEX = re.compile(
    r"^(mr|mrs|ms|miss|dr|doctor|prof|professor|sir|lord|lady|shaikh|sheikh|engr|eng)\.?\s+",
    re.IGNORECASE
)

SUFFIX_CREDENTIALS_REGEX = re.compile(
    r"[,\s]+(md|m\.d\.|do|d\.o\.|phd|ph\.d\.|mbbs|m\.b\.b\.s\.|frcs|mrcp|facp|facs|dds|dmd|cpa|fca|mba|esq|jd)\.?$",
    re.IGNORECASE
)


def validate_and_clean_person_name(raw_name: str, require_diaspora_surname: bool = False) -> Optional[Tuple[str, str]]:
    """
    Validates whether a raw name string represents a genuine human individual.
    Returns (cleaned_name, title_or_credential) if valid, or None if invalid/junk.
    """
    if not raw_name or not isinstance(raw_name, str):
        return None

    cleaned = raw_name.strip()
    
    # Extract credentials if present at the end
    credential = ""
    cred_match = SUFFIX_CREDENTIALS_REGEX.search(cleaned)
    if cred_match:
        credential = cred_match.group(1).upper().replace(".", "")
        cleaned = SUFFIX_CREDENTIALS_REGEX.sub("", cleaned).strip()

    # Extract honorifics if present at the beginning
    honorific = ""
    hon_match = HONORIFICS_REGEX.search(cleaned)
    if hon_match:
        honorific = hon_match.group(1).capitalize()
        cleaned = HONORIFICS_REGEX.sub("", cleaned).strip()

    # Remove commas and excessive whitespace
    cleaned = re.sub(r"[,;]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Split name into tokens
    parts = cleaned.split()
    if len(parts) < 2 or len(parts) > 5:
        return None

    # Check for non-alphabetical characters (numbers, symbols, URLs)
    if re.search(r"[\d@#$%&*+=_/\\[\]{}()<>~`^|:?!\"]", cleaned):
        return None

    # Discard if any word is a corporate keyword
    words_lower = [re.sub(r"[^\w]", "", p.lower()) for p in parts]
    if any(w in CORPORATE_KEYWORDS for w in words_lower):
        return None

    # Discard if any word is a junk keyword
    if any(w in JUNK_KEYWORDS for w in words_lower):
        return None

    # If diaspora surname is required (e.g. for open web dork searches), verify match
    if require_diaspora_surname:
        if not any(w in DIASPORA_SURNAME_SET for w in words_lower):
            return None

    # Discard single-character words except initials
    for p in parts:
        if len(p) == 1 and not p.isalpha():
            return None

    # Capitalize cleanly: First M. Last
    clean_parts = []
    for p in parts:
        clean_parts.append(p.capitalize())

    final_name = " ".join(clean_parts)
    return final_name, credential
