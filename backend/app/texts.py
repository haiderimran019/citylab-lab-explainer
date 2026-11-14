"""Fixed user-facing sentences in English and simple Urdu.

Test names, numbers and units always stay in English (they must match the printed report).
"""

from app.models import Lang

DISCLAIMER: dict[Lang, str] = {
    "en": "This is not a diagnosis. Only a licensed doctor can diagnose a condition.",
    "ur": "یہ تشخیص نہیں ہے۔ صرف لائسنس یافتہ ڈاکٹر ہی کسی بیماری کی تشخیص کر سکتا ہے۔",
}

URGENT_BANNER: dict[Lang, str] = {
    "en": "⚠ One or more results are at a dangerous level. Please see a doctor today.",
    "ur": "⚠ ایک یا زیادہ نتائج خطرناک سطح پر ہیں۔ براہ کرم آج ہی ڈاکٹر سے ملیں۔",
}

DOCTOR_NOTE: dict[Lang, str] = {
    "en": "Only a licensed doctor can diagnose.",
    "ur": "صرف لائسنس یافتہ ڈاکٹر ہی تشخیص کر سکتا ہے۔",
}

PRIVACY_REFUSAL: dict[Lang, str] = {
    "en": (
        "I can only discuss the report currently open. Sharing another patient's results is not "
        "allowed (CityLab Safety Rule 1: Privacy)."
    ),
    "ur": (
        "میں صرف اسی رپورٹ کے بارے میں بات کر سکتا ہوں جو ابھی کھلی ہے۔ کسی دوسرے مریض کے نتائج بتانے "
        "کی اجازت نہیں ہے (CityLab Safety Rule 1: Privacy)۔"
    ),
}

NO_DIAGNOSIS: dict[Lang, str] = {
    "en": "I can't tell you whether you have any disease — only a licensed doctor can diagnose. Here is what the numbers show:",
    "ur": "میں یہ نہیں بتا سکتا کہ آپ کو کوئی بیماری ہے یا نہیں — صرف لائسنس یافتہ ڈاکٹر ہی تشخیص کر سکتا ہے۔ نمبر یہ بتاتے ہیں:",
}

LANGUAGE_NAME: dict[Lang, str] = {"en": "simple English", "ur": "simple Urdu (اردو)"}
