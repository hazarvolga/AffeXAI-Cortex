export type SiteSettings = {
    companyName: string;
    domain: string;
    logoId?: string;
    logoDarkId?: string;
    logoUrl?: string;
    logoDarkUrl?: string;
    contact: {
        address: string;
        phone: string;
        email: string;
    };
    socialMedia: {
        [key: string]: string;
    };
    seo: {
        defaultTitle: string;
        defaultDescription: string;
    };
};

export const siteSettingsData: SiteSettings = {
    "companyName": "AffeXAI Corp.",
    "domain": "affexai.com",
    "logoUrl": "https://placehold.co/140x40/f7f7f7/1a1a1a?text=Aluplan",
    "logoDarkUrl": "https://placehold.co/140x40/171717/f0f0f0?text=Aluplan",
    "contact": {
        "address": "Örnek Mah. Teknoloji Cad. No:123, Ataşehir/İstanbul",
        "phone": "+90 216 123 45 67",
        "email": "info@aluplan.com.tr"
    },
    "socialMedia": {
        "facebook": "https://www.facebook.com/aluplan",
        "linkedin": "https://www.linkedin.com/company/aluplan",
        "twitter": "",
        "youtube": "https://www.youtube.com/aluplan",
        "instagram": "https://www.instagram.com/aluplan"
    },
    "seo": {
        "defaultTitle": "Aluplan Digital - AEC Çözümleri",
        "defaultDescription": "AEC profesyonelleri için en gelişmiş dijital çözümler ve uzman desteği."
    }
};